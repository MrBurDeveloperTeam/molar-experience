'use client';

/**
 * Generic Virtual Pet runtime — ported from Content Studio's
 * `src/VirtualPet/context/GameStateContext.tsx`.
 *
 * Every piece of business logic (offline decay formulas, the 5s game-loop
 * decay/energy-gain-while-sleeping tick, XP→level thresholds and level-up
 * rewards, buy/consume bounds checks, the 2s debounced persistence
 * sequence, localStorage key names/ordering, the sleep-state
 * "local vs remote, whichever updated_at is newer wins" tie-break, the
 * offline-decay-on-load formulas) is preserved EXACTLY — only the Supabase
 * calls themselves were replaced with calls through the host-supplied
 * `PetRepository`, and `currentUserId`/currency are now inputs (`userId`,
 * `currencyCode` props) instead of being resolved internally via
 * `supabase.auth.getSession()` / a hardcoded Content Studio pricing table.
 *
 * `soapInventory`/`setSoapInventory` from the original context type were
 * NOT carried forward — confirmed, by reading every component that
 * consumes `useGameState()`, that nothing in the actually-rendered tree
 * reads or writes it (dead state in the source being ported from).
 */
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { PetStats, RoomType, FoodItem, type PetAssetUrls } from '../internal/types';
import { BED_ITEMS, INITIAL_STATS, XP_TO_LEVEL_UP, INITIAL_INVENTORY, FOOD_ITEMS, TOY_ITEMS } from '../internal/constants';
import { DEFAULT_PET_ID, normalizePetId } from '../internal/petOptions';
import type { PetRepository } from '../../contracts/petRepository';
import type { PetSaveSnapshot } from '../../contracts/pet';

const TOY_ITEM_IDS = TOY_ITEMS.map((toy) => toy.id);
const ACTIVE_BED_KEY = 'pet_active_bed';
const ACTIVE_BED_DEFAULT_MIGRATION_KEY = 'pet_active_bed_default_none_v1';
const PET_SLEEPING_KEY = 'pet_is_sleeping';
const PET_SLEEPING_UPDATED_AT_KEY = 'pet_is_sleeping_updated_at';
const PET_ADOPTION_CONFIRMED_KEY = 'pet_adoption_confirmed';
export const DEFAULT_CURRENCY_CODE = 'USD';

export const normalizeCurrencyCode = (currency?: string | null) => {
    const normalized = (currency || '').trim().toUpperCase();
    return /^[A-Z]{3}$/.test(normalized) ? normalized : DEFAULT_CURRENCY_CODE;
};

const createStarterStats = (): PetStats => ({ ...INITIAL_STATS });
const createStarterInventory = (): Record<string, number> => ({});

const clearPetLocalStorage = () => {
    [
        'pet_stats',
        'pet_name',
        'pet_inventory',
        'pet_last_saved_at',
        'pet_active_ball',
        ACTIVE_BED_KEY,
        ACTIVE_BED_DEFAULT_MIGRATION_KEY,
        PET_SLEEPING_KEY,
        PET_SLEEPING_UPDATED_AT_KEY,
        PET_ADOPTION_CONFIRMED_KEY,
        'virtual_pet_bathroom_soap_inventory'
    ].forEach((key) => localStorage.removeItem(key));
};

interface GameStateContextType {
    stats: PetStats;
    setStats: React.Dispatch<React.SetStateAction<PetStats>>;
    petName: string;
    setPetName: (name: string) => void;
    hasAdoptedPet: boolean;
    isPetAdoptionReady: boolean;
    adoptPet: (name: string) => Promise<boolean>;
    currentRoom: RoomType;
    setCurrentRoom: (room: RoomType) => void;
    isSleeping: boolean;
    setIsSleeping: (is: boolean) => void;
    isEating: boolean;
    setIsEating: (is: boolean) => void;
    isPlaying: boolean;
    setIsPlaying: (is: boolean) => void;
    inventory: Record<string, number>;
    buyItem: (itemId: string, price: number) => boolean;
    consumeItem: (itemId: string) => void;
    addXP: (amount: number) => void;
    activeBallId: string;
    setActiveBallId: (id: string) => void;
    activeBedId: string | null;
    setActiveBedId: (id: string | null) => void;
    foodItems: FoodItem[];
    isFoodLoading: boolean;
    currencyCode: string;
    currencyRate: number;
    assetUrls?: PetAssetUrls;
}

const GameStateContext = createContext<GameStateContextType | undefined>(undefined);

export interface SharedPetProviderProps {
    children: React.ReactNode;
    /** Opaque host-local user identifier (e.g. Content Studio's own
     *  Supabase auth uuid) — this phase intentionally keys persistence on
     *  the SAME per-host identity Content Studio already uses today, not
     *  a future cross-app `globalUserId`. `null` means "not logged in":
     *  matches the original's exact behavior of skipping all repository
     *  I/O and using localStorage-only state until a session exists. */
    userId: string | null;
    repository: PetRepository;
    /** Host-resolved currency code (e.g. from IP geolocation) — resolving
     *  this is host-specific (network + Supabase-coupled) and stays
     *  entirely in the host's own wrapper, exactly as
     *  `VirtualPetContainer`'s `detectAndLogVisit` does today. */
    currencyCode?: string;
    /** Optional host override for this package's file-backed static
     *  assets (pet spritesheets, beds, bathroom-care images). Omitted
     *  entirely reproduces exact 0.5.0 behavior. */
    assetUrls?: PetAssetUrls;
}

export const SharedPetProvider: React.FC<SharedPetProviderProps> = ({
    children,
    userId,
    repository,
    currencyCode: initialCurrencyCode = DEFAULT_CURRENCY_CODE,
    assetUrls,
}) => {
    const [stats, setStats] = useState<PetStats>(INITIAL_STATS);
    const [petName, _setPetName] = useState(DEFAULT_PET_ID);
    const [hasAdoptedPet, setHasAdoptedPet] = useState(false);
    const [isPetAdoptionReady, setIsPetAdoptionReady] = useState(false);
    const setPetName = (name: string) => {
        if (!hasAdoptedPet) _setPetName(normalizePetId(name));
    };
    const [currentRoom, setCurrentRoom] = useState<RoomType>(RoomType.KITCHEN);
    const [inventory, setInventory] = useState<Record<string, number>>(INITIAL_INVENTORY);
    const [isSleeping, setIsSleeping] = useState(() => {
        try {
            return localStorage.getItem(PET_SLEEPING_KEY) === 'true';
        } catch {
            return false;
        }
    });
    const [isEating, setIsEating] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeBallId, setActiveBallId] = useState<string>('ball_red');
    const [activeBedId, setActiveBedId] = useState<string | null>(null);
    const [foodItems, setFoodItems] = useState<FoodItem[]>(FOOD_ITEMS);
    const [isFoodLoading, setIsFoodLoading] = useState(true);
    const [currencyCode, setCurrencyCode] = useState(() => normalizeCurrencyCode(initialCurrencyCode));
    const [currencyRate, setCurrencyRate] = useState(1);

    const isHydrated = useRef(false);
    const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Fetch shop catalog from the host's repository
    useEffect(() => {
        const fetchFoodItems = async () => {
            setIsFoodLoading(true);
            try {
                const items = await repository.loadCatalog();
                if (items && items.length > 0) {
                    setFoodItems(items);
                }
            } catch (err) {
                console.error('Failed to load shop items:', err);
            } finally {
                setIsFoodLoading(false);
            }
        };

        fetchFoodItems();
    }, [repository]);

    // Fetch currency rate via the host's repository when currencyCode changes
    useEffect(() => {
        const fetchRate = async () => {
            const requestedCurrency = normalizeCurrencyCode(initialCurrencyCode);
            if (requestedCurrency === DEFAULT_CURRENCY_CODE) {
                setCurrencyCode(DEFAULT_CURRENCY_CODE);
                setCurrencyRate(1);
                return;
            }
            try {
                const result = await repository.loadCurrencyRate(requestedCurrency);
                if (result) {
                    setCurrencyCode(normalizeCurrencyCode(result.code));
                    setCurrencyRate(Number(result.rate) || 1);
                    console.log(`[Currency] ${result.code} rate: ${result.rate}`);
                } else {
                    // Fallback to USD if not found
                    setCurrencyCode(DEFAULT_CURRENCY_CODE);
                    setCurrencyRate(1);
                }
            } catch (err) {
                console.warn('[Currency] Failed to fetch rate:', err);
                setCurrencyCode(DEFAULT_CURRENCY_CODE);
                setCurrencyRate(1);
            }
        };
        fetchRate();
    }, [initialCurrencyCode, repository]);

    // Initial data load
    useEffect(() => {
        const init = async () => {
            // Load from localStorage as fallback
            const savedStats = localStorage.getItem('pet_stats');
            const savedName = localStorage.getItem('pet_name');
            const savedPetAdoptionConfirmed = localStorage.getItem(PET_ADOPTION_CONFIRMED_KEY) === 'true';
            const savedInv = localStorage.getItem('pet_inventory');
            const savedLastSavedAt = localStorage.getItem('pet_last_saved_at');
            const savedSleeping = localStorage.getItem(PET_SLEEPING_KEY);
            const savedSleepingUpdatedAt = localStorage.getItem(PET_SLEEPING_UPDATED_AT_KEY);

            let loadedStats: PetStats | null = savedStats ? JSON.parse(savedStats) : null;

            // Apply offline decay based on elapsed time since last save
            if (loadedStats && savedLastSavedAt) {
                const elapsedMs = Date.now() - new Date(savedLastSavedAt).getTime();
                const elapsedSecs = Math.max(0, elapsedMs / 1000);
                // Decay rates per second (matching the live game loop: per 5s tick rates)
                loadedStats = {
                    ...loadedStats,
                    hunger:    Math.max(0, loadedStats.hunger    - 0.01  * elapsedSecs),
                    energy:    Math.max(0, loadedStats.energy    - 0.005 * elapsedSecs),
                    hygiene:   Math.max(0, loadedStats.hygiene   - 0.004 * elapsedSecs),
                    happiness: Math.max(0, loadedStats.happiness - 0.006 * elapsedSecs),
                };
                console.log(`[VirtualPet] Applied ${Math.round(elapsedSecs)}s of offline decay`);
            }

            if (loadedStats) setStats(loadedStats);
            if (savedSleeping !== null) setIsSleeping(savedSleeping === 'true');
            if (savedName && savedPetAdoptionConfirmed) {
                const adoptedPet = normalizePetId(savedName);
                _setPetName(adoptedPet);
                setHasAdoptedPet(true);
            }
            const savedBall = localStorage.getItem('pet_active_ball');
            if (savedBall) setActiveBallId(savedBall);
            const savedBed = localStorage.getItem(ACTIVE_BED_KEY);
            const hasMigratedDefaultBed = localStorage.getItem(ACTIVE_BED_DEFAULT_MIGRATION_KEY) === 'true';
            if (savedBed === 'bed_grey' && !hasMigratedDefaultBed) {
                localStorage.removeItem(ACTIVE_BED_KEY);
                localStorage.setItem(ACTIVE_BED_DEFAULT_MIGRATION_KEY, 'true');
            } else {
                if (savedBed) setActiveBedId(savedBed);
                if (!hasMigratedDefaultBed) {
                    localStorage.setItem(ACTIVE_BED_DEFAULT_MIGRATION_KEY, 'true');
                }
            }
            if (savedInv) setInventory(JSON.parse(savedInv));
            localStorage.removeItem('virtual_pet_bathroom_soap_inventory');

            // Load from the host repository if logged in (overriding localStorage)
            if (userId) {
                try {
                    let shouldLoadPetInventory = false;
                    const petData = await repository.loadSnapshot(userId);

                    if (!petData) {
                        const starterStats = createStarterStats();
                        const starterInventory = createStarterInventory();
                        clearPetLocalStorage();
                        setStats(starterStats);
                        setInventory(starterInventory);
                        setActiveBallId('ball_red');
                        setActiveBedId(null);
                        setIsSleeping(false);
                        _setPetName(DEFAULT_PET_ID);
                        setHasAdoptedPet(false);
                        localStorage.setItem('pet_stats', JSON.stringify(starterStats));
                        localStorage.setItem('pet_inventory', JSON.stringify(starterInventory));
                        localStorage.setItem('pet_last_saved_at', new Date().toISOString());
                    }

                    if (petData) {
                        // Apply offline decay using the repository's updated_at timestamp
                        const savedAt = petData.updatedAt ? new Date(petData.updatedAt).getTime() : null;
                        const elapsedSecs = savedAt ? Math.max(0, (Date.now() - savedAt) / 1000) : 0;

                        const baseStats = petData.stats;

                        const decayedStats: PetStats = elapsedSecs > 0 ? {
                            ...baseStats,
                            hunger:    Math.max(0, baseStats.hunger    - 0.01  * elapsedSecs),
                            energy:    Math.max(0, baseStats.energy    - 0.005 * elapsedSecs),
                            hygiene:   Math.max(0, baseStats.hygiene   - 0.004 * elapsedSecs),
                            happiness: Math.max(0, baseStats.happiness - 0.006 * elapsedSecs),
                        } : baseStats;

                        if (elapsedSecs > 0) {
                            console.log(`[VirtualPet] Applied ${Math.round(elapsedSecs)}s of offline decay (repository)`);
                        }

                        const localSleepUpdatedAt = savedSleepingUpdatedAt
                            ? new Date(savedSleepingUpdatedAt).getTime()
                            : 0;
                        const remoteUpdatedAt = petData.updatedAt
                            ? new Date(petData.updatedAt).getTime()
                            : 0;
                        const shouldUseLocalSleep =
                            savedSleeping !== null &&
                            localSleepUpdatedAt > 0 &&
                            localSleepUpdatedAt >= remoteUpdatedAt;

                        setStats(decayedStats);
                        if (petData.identity.petName) {
                            const adoptedPet = normalizePetId(petData.identity.petName);
                            _setPetName(adoptedPet);
                            setHasAdoptedPet(true);
                            localStorage.setItem('pet_name', adoptedPet);
                            localStorage.setItem(PET_ADOPTION_CONFIRMED_KEY, 'true');
                            shouldLoadPetInventory = true;
                            setIsSleeping(shouldUseLocalSleep ? savedSleeping === 'true' : !!petData.identity.isSleeping);
                            if (petData.identity.activeBallId) setActiveBallId(petData.identity.activeBallId);
                            setActiveBedId(petData.identity.activeBedId || null);
                        } else {
                            const starterStats = createStarterStats();
                            const starterInventory = createStarterInventory();
                            clearPetLocalStorage();
                            setStats(starterStats);
                            setInventory(starterInventory);
                            setActiveBallId('ball_red');
                            setActiveBedId(null);
                            _setPetName(DEFAULT_PET_ID);
                            setHasAdoptedPet(false);
                            localStorage.setItem('pet_stats', JSON.stringify(starterStats));
                            localStorage.setItem('pet_inventory', JSON.stringify(starterInventory));
                            localStorage.setItem('pet_last_saved_at', new Date().toISOString());
                        }
                    }

                    if (shouldLoadPetInventory) {
                        const invRows = await repository.loadInventoryRows(userId);
                        const newInv: Record<string, number> = {};
                        invRows.forEach((row) => {
                            if (row.itemId === 'soap' || row.itemId === 'soap2') return;
                            if (TOY_ITEM_IDS.includes(row.itemId)) {
                                newInv[row.itemId] = row.quantity > 0 ? 1 : 0;
                            } else {
                                newInv[row.itemId] = row.quantity;
                            }
                        });
                        setInventory(newInv);
                    }
                } catch (err) {
                    console.error('Failed to load from repository', err);
                }
            }

            setIsPetAdoptionReady(true);
            isHydrated.current = true;
        };

        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- ported unchanged: original ran once on mount
    }, []);

    // Sync to repository / LocalStorage
    useEffect(() => {
        if (!isHydrated.current) return;

        if (saveTimeout.current) clearTimeout(saveTimeout.current);

        saveTimeout.current = setTimeout(async () => {
            localStorage.setItem('pet_stats', JSON.stringify(stats));
            if (hasAdoptedPet) {
                localStorage.setItem('pet_name', petName);
                localStorage.setItem(PET_ADOPTION_CONFIRMED_KEY, 'true');
            } else {
                localStorage.removeItem('pet_name');
                localStorage.removeItem(PET_ADOPTION_CONFIRMED_KEY);
            }
            localStorage.setItem('pet_active_ball', activeBallId);
            if (activeBedId) {
                localStorage.setItem(ACTIVE_BED_KEY, activeBedId);
            } else {
                localStorage.removeItem(ACTIVE_BED_KEY);
            }
            localStorage.setItem('pet_inventory', JSON.stringify(inventory));
            localStorage.setItem(PET_SLEEPING_KEY, String(isSleeping));
            localStorage.setItem('pet_last_saved_at', new Date().toISOString());

            if (userId) {
                try {
                    const snapshot: PetSaveSnapshot = {
                        globalUserId: userId,
                        stats,
                        identity: {
                            petName: hasAdoptedPet ? petName : '',
                            selectedPetId: petName,
                            isSleeping,
                            activeBallId,
                            activeBedId,
                        },
                        updatedAt: new Date().toISOString(),
                    };
                    await repository.saveSnapshot(snapshot);

                    // Fast full sync for inventory: repository owns the
                    // delete-all-then-insert semantics (matches the
                    // original's `.delete().eq('user_id', userId)` then
                    // bulk insert exactly).
                    const combinedInventory: Record<string, number> = inventory;
                    const invRows = Object.entries(combinedInventory)
                        .filter(([, qty]) => qty > 0)
                        .map(([itemId, qty]) => ({
                            itemId,
                            quantity: TOY_ITEM_IDS.includes(itemId) ? 1 : qty,
                        }));

                    await repository.saveInventory(userId, invRows);
                } catch (e) {
                    console.error('Failed to sync to repository', e);
                }
            }
        }, 2000); // 2 second debounce

        return () => {
            if (saveTimeout.current) clearTimeout(saveTimeout.current);
        };
    }, [stats, petName, hasAdoptedPet, inventory, isSleeping, activeBallId, activeBedId, userId, repository]);

    useEffect(() => {
        if (!isHydrated.current) return;

        localStorage.setItem(PET_SLEEPING_KEY, String(isSleeping));
        localStorage.setItem(PET_SLEEPING_UPDATED_AT_KEY, new Date().toISOString());
        window.dispatchEvent(new CustomEvent('virtual-pet-sleep-change', { detail: isSleeping }));
    }, [isSleeping]);

    useEffect(() => {
        if (!isHydrated.current) return;

        const activePetId = normalizePetId(petName);
        if (hasAdoptedPet) {
            localStorage.setItem('pet_name', activePetId);
            localStorage.setItem(PET_ADOPTION_CONFIRMED_KEY, 'true');
        }
        window.dispatchEvent(new CustomEvent('virtual-pet-selection-change', { detail: activePetId }));
    }, [petName, hasAdoptedPet]);

    // Game Loop (Stats decay)
    useEffect(() => {
        const timer = setInterval(() => {
            setStats(prev => {
                if (isSleeping) {
                    const activeBed = foodItems.find(item => item.id === activeBedId && item.category === 'Beds');
                    const fallbackBed = BED_ITEMS.find(bed => bed.id === activeBedId);
                    return {
                        ...prev,
                        energy: Math.min(100, prev.energy + (activeBed?.energyGain || fallbackBed?.energyGain || 1)),
                        hunger: Math.max(0, prev.hunger - 0.2),
                        hygiene: Math.max(0, prev.hygiene - 0.1)
                    };
                } else {
                    return {
                        ...prev,
                        hunger: Math.max(0, prev.hunger - 0.05),
                        energy: Math.max(0, prev.energy - 0.025),
                        hygiene: Math.max(0, prev.hygiene - 0.02),
                        happiness: Math.max(0, prev.happiness - 0.03)
                    };
                }
            });
        }, 5000); // Slower decay for background sync

        return () => clearInterval(timer);
    }, [isSleeping, activeBedId, foodItems]);

    const addXP = (amount: number) => {
        setStats(prev => {
            let newXP = prev.xp + amount;
            let newLevel = prev.level;
            let newCoins = prev.coins;
            if (newXP >= XP_TO_LEVEL_UP) {
                newXP -= XP_TO_LEVEL_UP;
                newLevel += 1;
                newCoins = (prev.coins || 0) + 50;
                return {
                    ...prev,
                    level: newLevel,
                    xp: newXP,
                    happiness: 100,
                    energy: 100,
                    coins: newCoins
                };
            }
            return { ...prev, xp: newXP, level: newLevel };
        });
    };

    const adoptPet = async (name: string) => {
        if (hasAdoptedPet) return false;

        const adoptedPet = normalizePetId(name);
        const starterStats = createStarterStats();
        const starterInventory = createStarterInventory();
        const savedAt = new Date().toISOString();

        try {
            if (userId) {
                const snapshot: PetSaveSnapshot = {
                    globalUserId: userId,
                    stats: starterStats,
                    identity: {
                        petName: adoptedPet,
                        selectedPetId: adoptedPet,
                        isSleeping: false,
                        activeBallId: 'ball_red',
                        activeBedId: null,
                    },
                    updatedAt: savedAt,
                };
                await repository.saveSnapshot(snapshot);
                await repository.saveInventory(userId, []);
            }

            clearPetLocalStorage();
            setStats(starterStats);
            setInventory(starterInventory);
            setActiveBallId('ball_red');
            setActiveBedId(null);
            setIsSleeping(false);
            _setPetName(adoptedPet);
            setHasAdoptedPet(true);
            localStorage.setItem('pet_name', adoptedPet);
            localStorage.setItem(PET_ADOPTION_CONFIRMED_KEY, 'true');
            localStorage.setItem('pet_stats', JSON.stringify(starterStats));
            localStorage.setItem('pet_inventory', JSON.stringify(starterInventory));
            localStorage.setItem('pet_last_saved_at', savedAt);
            localStorage.setItem('pet_active_ball', 'ball_red');
            localStorage.setItem(PET_SLEEPING_KEY, 'false');
            localStorage.setItem(PET_SLEEPING_UPDATED_AT_KEY, savedAt);
            window.dispatchEvent(new CustomEvent('virtual-pet-selection-change', { detail: adoptedPet }));
            return true;
        } catch (err) {
            console.error('Failed to adopt pet', err);
            return false;
        }
    };

    const buyItem = (itemId: string, price: number) => {
        if (stats.coins >= price) {
            setStats(prev => ({ ...prev, coins: prev.coins - price }));
            setInventory(prev => ({
                ...prev,
                [itemId]: (prev[itemId] || 0) + 1
            }));
            return true;
        }
        return false;
    };

    const consumeItem = (itemId: string) => {
        setInventory(prev => {
            const current = prev[itemId] || 0;
            if (current <= 1) {
                const newState = { ...prev };
                delete newState[itemId];
                return newState;
            }
            return { ...prev, [itemId]: current - 1 };
        });
    };

    return (
        <GameStateContext.Provider value={{
            stats, setStats,
            petName, setPetName,
            hasAdoptedPet,
            isPetAdoptionReady,
            adoptPet,
            currentRoom, setCurrentRoom,
            isSleeping, setIsSleeping,
            isEating, setIsEating,
            isPlaying, setIsPlaying,
            inventory,
            buyItem,
            consumeItem,
            addXP,
            activeBallId,
            setActiveBallId,
            activeBedId,
            setActiveBedId,
            foodItems,
            isFoodLoading,
            currencyCode,
            currencyRate,
            assetUrls,
        }}>
            {children}
        </GameStateContext.Provider>
    );
};

export const useGameState = () => {
    const context = useContext(GameStateContext);
    if (context === undefined) {
        throw new Error('useGameState must be used within a SharedPetProvider');
    }
    return context;
};
