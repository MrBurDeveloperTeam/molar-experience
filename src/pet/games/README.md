# pet/games (reserved, internal, not yet implemented)

Will hold the three existing mini-games (PAC-CAT, Tetris, Flappy Cat) as
internal, iframed static HTML5 bundles — unchanged, not redesigned — plus
the internal `GameRewardEvent`/`GameRewardHandler` contract connecting a
game's `postMessage` score/reward event to the pet domain's coin/happiness
formulas. Never part of the public API — hosts never import this directly.

Not implemented in the Phase 2 skeleton.
