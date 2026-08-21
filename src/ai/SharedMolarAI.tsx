'use client';

import { useMolarExperienceConfig } from '../core/MolarExperienceContext';

/**
 * Public AI/Chatbox entry point.
 *
 * SKELETON PHASE: no floating button, no chat panel, no markdown rendering
 * yet. Exists to prove `@mrburdeveloperteam/molar-experience/ai` compiles and consumes
 * the provider config safely. Real chat UI lands in a later phase.
 */
export function SharedMolarAI() {
  useMolarExperienceConfig();
  return null;
}
