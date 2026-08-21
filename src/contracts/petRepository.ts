/**
 * Framework/database-neutral persistence boundary for the Pet domain.
 *
 * The domain layer (src/pet/domain) depends ONLY on this interface — never
 * on `@supabase/supabase-js`, never on any host's Supabase client instance.
 * A concrete Supabase-backed implementation is intentionally NOT provided
 * in this skeleton (see README "No Supabase implementation yet") because
 * the canonical global-pet project/identity-mapping strategy has not been
 * decided yet — shipping one now would silently couple the package to one
 * of the seven current per-app projects.
 */
import type { FoodItem, ToyItem, BedItem, PetInventory, PetSaveSnapshot } from './pet';

export interface PetRepository {
  loadSnapshot(globalUserId: string): Promise<PetSaveSnapshot | null>;
  saveSnapshot(snapshot: PetSaveSnapshot): Promise<void>;
  loadInventory(globalUserId: string): Promise<PetInventory>;
  saveInventory(globalUserId: string, inventory: PetInventory): Promise<void>;
  loadCatalog(): Promise<{ food: FoodItem[]; toys: ToyItem[]; beds: BedItem[] }>;
  loadCurrencies(): Promise<Array<{ code: string; rate: number }>>;
  /** Optional — geo/currency visit logging, not core to gameplay. */
  recordVisit?(globalUserId: string): Promise<void>;
}
