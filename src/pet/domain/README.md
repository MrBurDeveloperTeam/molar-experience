# pet/domain (reserved, internal, not yet implemented)

Will hold pure functions operating on `PetSaveSnapshot`/`PetInventory` —
offline decay, XP/level thresholds, buy/consume bounds checks — ported
unchanged from the audited `GameStateContext.tsx` business logic (confirmed
functionally identical across 6 of 7 apps; Content Studio's stricter
`PricingItemRow`/`PetInventoryRow` typing is the one improvement to carry
forward). No React, no I/O — see `pet/repository` for persistence and
`SharedVirtualPet` for the React layer.

Not implemented in the Phase 2 skeleton.
