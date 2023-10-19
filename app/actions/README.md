# What are Actions?

Actions introduce a concept of unique code reusability. They are "functions" that can be called from anywhere in the application. For example, they may be used as a ...

- CLI Command
- HTTP Controller
- Event Listener
- Cron Job _(Queued Jobs)_

One unique Stacks feature of Actions is that they may also be called from anywhere in the frontend, dramatically simplifying API integrations.

```ts
import { action } from '@stacksjs/actions'

await runAction('NewActionName', { foo: 'bar' })
// or
await runAction('NewActionName', { foo: 'bar' }, { queue: 'default' })
```

_Please note, Actions are not limited to these use cases, but these are the most common ones._

## Get Started

The following command will create a new action file in the `app/actions` dir.

```sh
buddy make:action NewActionName
```
