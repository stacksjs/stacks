// ts-collect is pinned to an exact 0.4.0 in this package's package.json, not a
// `^0.4.0` range. 0.4.1 and 0.4.2 ship a dist Bun cannot parse ("Exported
// binding 'o' needs to refer to a top-level declared variable"), so every
// `bun run test` on a clean install died on import here — which also held the
// CI deploy gate shut. Unpin once a release fixes that build.
export { collect } from 'ts-collect'
