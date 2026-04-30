// IMPORTANT: do NOT re-add `export * as config from './config'` here.
// That line creates a module-namespace object named `config` whose
// properties are non-configurable per the ESM spec (namespaces are sealed).
// Because `export *` is also exporting the real `config` proxy from
// `./config`, the namespace object would shadow the proxy under the
// `config` name — and consumers that did `import { config }` would get
// the sealed namespace, not the live proxy. The visible symptom: every
// `config.X` read returns whatever value the proxy's get trap produced
// the *first* time (typically defaults), and later mutations from
// `overridesReady` are silently ignored.
export * from './config'
