/**
 * Canonical Virtual Pet domain types.
 *
 * These field names/shapes are deliberately unchanged from the current
 * per-app `GameStateContext`/`inventory_pet` implementations audited across
 * all 7 apps (confirmed byte-identical `PetStats` shape, identical decay
 * constants, identical Supabase columns) — this file does not invent a new
 * stat, rename a field, or change a formula. It is a relocation of an
 * already-converged shape, not a redesign.
 */

export interface PetStats {
  hunger: number;
  energy: number;
  happiness: number;
  hygiene: number;
  level: number;
  xp: number;
  coins: number;
}

export interface PetIdentity {
  petName: string;
  selectedPetId: string;
  isSleeping: boolean;
  activeBallId: string | null;
  activeBedId: string | null;
}

export interface PetInventoryItem {
  itemId: string;
  quantity: number;
}

export interface PetInventory {
  items: PetInventoryItem[];
}

export interface PetCatalogItem {
  itemId: string;
  name: string;
  priceUsd: number;
  unlockLevel: number;
}

export interface FoodItem extends PetCatalogItem {
  hunger: number;
  happiness: number;
  hygiene: number;
  energyGain: number;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- deliberately empty: toys currently carry no fields beyond PetCatalogItem
export interface ToyItem extends PetCatalogItem {}

export interface BedItem extends PetCatalogItem {
  energyGain: number;
}

export interface PetSaveSnapshot {
  globalUserId: string;
  stats: PetStats;
  identity: PetIdentity;
  /** ISO timestamp. Explicit, first-class field — the future global-pet
   *  merge policy ("latest valid updated_at wins as one coherent row")
   *  keys directly on this value. Not implemented in this skeleton. */
  updatedAt: string;
}
