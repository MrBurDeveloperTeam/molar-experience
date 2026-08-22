/**
 * Ported from Content Studio's `src/VirtualPet/types.ts`. `PetStats`,
 * `FoodItem`, `ToyItem`, and `BedItem` are re-exported from the public
 * `contracts/pet` module instead of being duplicated here — see that
 * file's Phase 3D revision note for why the shapes were corrected against
 * real source. `RoomType`/`GameState`/`ChatMessage`/`Bubble`/`ToolType`
 * are internal-only concepts with no cross-app-normalized meaning, so
 * they stay defined here, unchanged.
 */
export type { PetStats, FoodItem, ToyItem, BedItem } from '../../contracts/pet';

export enum RoomType {
  BEDROOM = 'BEDROOM',
  KITCHEN = 'KITCHEN',
  BATHROOM = 'BATHROOM',
  PLAYROOM = 'PLAYROOM',
  GARDEN = 'GARDEN',
  GAMES = 'GAMES',
}

export interface GameState {
  stats: import('../../contracts/pet').PetStats;
  name: string;
  isSleeping: boolean;
  lastInteraction: number;
  inventory: Record<string, number>;
}

export interface ChatMessage {
  sender: 'user' | 'pet';
  text: string;
  timestamp: number;
}

export interface Bubble {
  id: number;
  x: number;
  y: number;
  size: number;
}

export type ToolType = 'soap' | 'shower';
