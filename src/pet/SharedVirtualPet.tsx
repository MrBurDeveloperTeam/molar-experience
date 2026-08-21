'use client';

import { useMolarExperienceConfig } from '../core/MolarExperienceContext';

/**
 * Public Virtual Pet entry point.
 *
 * SKELETON PHASE: no pet room, no sprite rendering, no shop, no games yet,
 * and no persistence I/O — `domain/`, `repository/`, and `games/` are
 * reserved-but-empty internal directories in this phase (see their own
 * placeholder files). Exists to prove `@snabbb/molar-experience/pet`
 * compiles and consumes the provider config safely.
 */
export function SharedVirtualPet() {
  useMolarExperienceConfig();
  return null;
}
