// The config-level surface: resolving `config/library.ts` into packages, and
// the shapes generated from them.
//
// `./build` and `./publish` are deliberately NOT re-exported here. They pull
// in the stx compiler and the framework build helpers, and this module is
// reached from the `@stacksjs/actions` barrel, which the CLI loads to render
// `buddy libs`. Import them by path from the action files that run them.
export * from './entries'
export * from './globals'
export * from './manifest'
export * from './packages'
