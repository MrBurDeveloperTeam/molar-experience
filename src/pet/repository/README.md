# pet/repository (reserved, internal, not yet implemented)

Will hold the package's default `PetRepository` implementation(s). No
implementation exists yet — see `contracts/petRepository.ts` for why: the
canonical global-pet Supabase project and `globalUserId` mapping strategy
have not been decided, so shipping a `defaultSupabasePetRepository` now
would silently couple the package skeleton to one of the seven current
per-app Supabase projects. The domain layer depends only on the
`PetRepository` interface, never on this directory's contents, so hosts can
supply their own implementation in the meantime.

Not implemented in the Phase 2 skeleton.
