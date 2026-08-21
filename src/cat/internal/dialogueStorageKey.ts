/**
 * INTERNAL pure utility. Not exported publicly.
 *
 * Produces the future shared dismissal-key format:
 *   snabbb_pet_dialogue:{appId}:{userId}:{dedupeKey}
 *
 * This does NOT read or write localStorage — that lands with the runtime
 * implementation in a later phase. It also does NOT migrate or rewrite any
 * existing host app's current key format (`snabbb_pet_dialogue:{userId}:
 * {dedupeKey}`, without an appId segment) — per-app migration compatibility
 * is handled later, not by this utility.
 *
 * No sessionStorage-backed "seen" API exists anywhere in this package, and
 * none will be added — that mechanism was identified as the specific bug
 * still present in App Gallery and is not part of the shared contract.
 *
 * No logout-clearing API exists here either: the shared runtime never
 * clears dismissal state on logout under any circumstance.
 */
export function buildDialogueStorageKey(
  appId: string,
  userId: string,
  dedupeKey: string
): string {
  return `snabbb_pet_dialogue:${appId}:${userId}:${dedupeKey}`;
}
