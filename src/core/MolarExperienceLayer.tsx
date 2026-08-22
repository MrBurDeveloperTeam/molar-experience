'use client';

import type { AIAdapter } from '../contracts';
import { SharedCatMascot } from '../cat';
import { SharedMolarAI } from '../ai';
import { SharedVirtualPet } from '../pet';

const NOOP_AI_ADAPTER: AIAdapter = {
  sendMessage: async () => ({ text: '' }),
};

export interface MolarExperienceLayerProps {
  /** Defaults to true. Set false to opt a domain out during incremental
   *  per-app migration (see README "Incremental adoption") — a host may
   *  still be running its own local implementation for a domain it hasn't
   *  migrated yet, alongside domains it has already moved onto this layer. */
  cat?: boolean;
  ai?: boolean;
  pet?: boolean;
  /** Required for real AI functionality when `ai` is true. Falls back to
   *  a no-op adapter (empty responses) if omitted, so this convenience
   *  layer still type-checks and renders for a host that hasn't wired AI
   *  yet — real hosts should always supply their own adapter. */
  aiAdapter?: AIAdapter;
}

/**
 * Convenience composition of all three domains for a host that migrates
 * everything at once. Domain-by-domain migration should prefer importing
 * `SharedCatMascot` / `SharedMolarAI` / `SharedVirtualPet` individually from
 * their own subpaths instead of this layer.
 */
export function MolarExperienceLayer({ cat = true, ai = true, pet = true, aiAdapter }: MolarExperienceLayerProps) {
  return (
    <>
      {cat && <SharedCatMascot />}
      {ai && <SharedMolarAI adapter={aiAdapter ?? NOOP_AI_ADAPTER} />}
      {pet && <SharedVirtualPet />}
    </>
  );
}
