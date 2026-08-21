'use client';

import { SharedCatMascot } from '../cat';
import { SharedMolarAI } from '../ai';
import { SharedVirtualPet } from '../pet';

export interface MolarExperienceLayerProps {
  /** Defaults to true. Set false to opt a domain out during incremental
   *  per-app migration (see README "Incremental adoption") — a host may
   *  still be running its own local implementation for a domain it hasn't
   *  migrated yet, alongside domains it has already moved onto this layer. */
  cat?: boolean;
  ai?: boolean;
  pet?: boolean;
}

/**
 * Convenience composition of all three domains for a host that migrates
 * everything at once. Domain-by-domain migration should prefer importing
 * `SharedCatMascot` / `SharedMolarAI` / `SharedVirtualPet` individually from
 * their own subpaths instead of this layer.
 */
export function MolarExperienceLayer({ cat = true, ai = true, pet = true }: MolarExperienceLayerProps) {
  return (
    <>
      {cat && <SharedCatMascot />}
      {ai && <SharedMolarAI />}
      {pet && <SharedVirtualPet />}
    </>
  );
}
