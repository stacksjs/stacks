// Legacy location for the ORM route generator.
//
// The implementation moved into `src/` so the package can publish it: an
// installed app has no `storage/framework/core/`, so a file here reaches no
// consumer but this repository. Kept because the router still probes this path
// on projects that predate the move.
export { default } from './src/routes'
