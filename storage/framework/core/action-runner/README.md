# @stacksjs/action-runner

How a package runs an action by name, without depending on the action layer.

Running an action belongs to `@stacksjs/actions`: it resolves the action file
and spawns it. But three packages need to ask for that without *being* the
action layer:

- `@stacksjs/queue`, when a job names an action instead of handing over a function
- `@stacksjs/scheduler`, for `Schedule.action('...')`
- `@stacksjs/dns`, whose `addDomain` / `removeDomain` shell out to the domain actions

and `@stacksjs/actions` imports all three. Importing it back closed a cycle in
every case.

So the capability is declared here, in a package that depends on nothing that
can lead back to it, and `@stacksjs/actions` supplies it by the act of being
imported at all.

```ts
import { runNamedAction } from '@stacksjs/action-runner'

await runNamedAction('SendWelcomeEmail')
```

If nothing registered a runner, this falls back to importing `@stacksjs/actions`
directly, and throws if that is not available either. It never silently does
nothing: a job marked complete, or a scheduled task reported as run, with its
work undone is the one outcome these callers must never produce.
