/**
 * Framework/database-neutral persistence boundary for the Pet domain.
 *
 * The runtime (`src/pet/runtime/SharedPetRuntime.tsx`) depends ONLY on
 * this interface — never on `@supabase/supabase-js`, never on any host's
 * Supabase client instance. A concrete Supabase-backed implementation is
 * intentionally NOT provided in this package (see README "No default
 * PetRepository implementation") — each host writes its own thin adapter
 * over its OWN current database (e.g. Content Studio's
 * `contentStudioPetRepository.ts` maps `inventory_pet`/`pet_inventory`/
 * `aiboard_pricing_items`/`aiboard_pricing_currencies` — table names this
 * package must never know).
 *
 * PHASE 3D REVISION: `loadCatalog`/`loadCurrencies` in the Phase 2
 * skeleton were shaped before the real Content Studio source was read.
 * Content Studio's actual shop fetch returns ONE flat, mixed-category
 * list (food + beds + soap, all from `aiboard_pricing_items`) and looks
 * currency rate up ONE code at a time (`.ilike(...).maybeSingle()`), not a
 * bulk `{food,toys,beds}` split or a full currency list — this interface
 * now matches that real shape exactly. `ToyItem`/`BedItem` are NOT part of
 * the repository surface: toys are a fixed in-package catalog
 * (`TOY_ITEMS`) with no per-host pricing table today, and beds resolve
 * through the same flat `loadCatalog()` list via `category === 'Beds'`
 * (falling back to the package's own bundled `BED_ITEMS` when a host
 * hasn't configured a priced bed) — exactly as `GameStateContext`/
 * `PetRoom.getBedItem` do today.
 */
import type { FoodItem, PetInventoryItem, PetSaveSnapshot } from './pet';

export interface PetRepository {
  /** Returns `null` when no snapshot row exists yet for this user (first
   *  login) — the runtime seeds fresh starter stats in that case, exactly
   *  as Content Studio's `!petData && !petErr` branch does today. */
  loadSnapshot(userId: string): Promise<PetSaveSnapshot | null>;
  saveSnapshot(snapshot: PetSaveSnapshot): Promise<void>;
  /** Raw per-item rows — the runtime itself applies the exact same
   *  soap/soap2-exclusion and toy-quantity-clamped-to-1 mapping Content
   *  Studio's `GameStateContext` does today; the repository should not
   *  pre-apply that mapping. */
  loadInventoryRows(userId: string): Promise<PetInventoryItem[]>;
  /** Full-sync semantics: delete every existing row for `userId`, then
   *  bulk-insert exactly the given rows (an empty array means "delete
   *  all") — matches Content Studio's `pet_inventory` delete-then-insert
   *  sync exactly. Never a partial/diffed update. */
  saveInventory(userId: string, items: PetInventoryItem[]): Promise<void>;
  /** One flat, mixed-category shop catalog (food + beds + soap, ordered
   *  by unlock level ascending) — empty/rejected means "use the package's
   *  own static fallback catalog", matching Content Studio's own
   *  fallback-to-local-constants behavior on a failed/empty fetch. */
  loadCatalog(): Promise<FoodItem[]>;
  /** Single currency lookup by code (already normalized to a 3-letter
   *  uppercase code by the caller). `null` means "not configured for this
   *  host" — the runtime falls back to USD/rate 1, exactly as today. */
  loadCurrencyRate(currencyCode: string): Promise<{ code: string; rate: number } | null>;
}
