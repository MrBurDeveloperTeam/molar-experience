/**
 * Framework-neutral, auth-provider-neutral user identity.
 *
 * This package must never import a Supabase `User` type, a Next.js session
 * type, or any router/session library type. Hosts normalize their own
 * authentication state into this shape before passing it to
 * `MolarExperienceProvider`.
 */
export interface MolarIdentity {
  /**
   * Stable identity shared across ALL seven Snabbb apps (e.g. an SSO
   * subject). This is the ONLY id the future shared Pet domain/repository
   * keys on — see `PetSaveSnapshot.globalUserId` in `pet.ts`.
   */
  globalUserId: string;

  /**
   * The host app's OWN local project identity (e.g. that app's Supabase
   * auth uuid). Optional, and scoped to host-local concerns only (today:
   * per-app dialogue dismissal storage keys). Never used by the Pet domain.
   */
  localAppUserId?: string;

  displayName?: string;

  /** Only present if a shared UI genuinely needs to render it (e.g. a
   *  Welcome Back name-token substitution fallback). */
  email?: string;

  isAuthenticated: boolean;
}
