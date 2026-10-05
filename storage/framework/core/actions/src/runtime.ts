/**
 * Request-time action entrypoint.
 *
 * The package root is the action *layer*: it resolves and spawns action files,
 * and its barrel reaches the scaffolding (`make:*`), the generators, the lint
 * and setup actions, the dev server and the upgrade checks. Importing it costs
 * well over a hundred milliseconds and a matching slice of RSS.
 *
 * Almost nothing at request time needs any of that. Of the framework's own
 * imports of this package outside the CLI, every one but a handful is
 * `import { Action } from '@stacksjs/actions'` - the 650 default actions each
 * paying for the whole tooling graph to declare themselves. The server's
 * global injection did the same for the single `Action` binding.
 *
 * So this entry carries the action contract and nothing else, the way
 * `@stacksjs/database/runtime` carries the query facade without the migrations.
 *
 * Deliberately NOT re-exported here: the `setActionRunner()` registration the
 * root barrel performs on import. Running an action by name means resolving and
 * spawning a file, which is the full layer's job; a narrow entry that quietly
 * registered a runner it cannot honour would be worse than one that does not.
 * The packages that run actions by name (queue, scheduler, dns) already ask
 * through `@stacksjs/action-runner`, and the contexts that answer import the
 * root.
 */
export * from './action'
