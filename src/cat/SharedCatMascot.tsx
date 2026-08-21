'use client';

import { useMolarExperienceConfig } from '../core/MolarExperienceContext';

/**
 * Public Cat entry point.
 *
 * SKELETON PHASE: this component intentionally contains no product UI yet
 * (no sprite, no dialogue bubble, no animation). It exists to prove the
 * public export compiles, consumes the provider config safely (throwing the
 * standard "rendered outside provider" error if misused, same as every
 * other domain entry point), and gives later phases a stable import path
 * (`@snabbb/molar-experience/cat`) that host apps can already reference.
 *
 * Do not treat this as a preview of final visuals.
 */
export function SharedCatMascot() {
  useMolarExperienceConfig();
  return null;
}
