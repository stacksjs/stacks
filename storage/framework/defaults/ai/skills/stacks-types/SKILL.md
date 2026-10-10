---
name: stacks-types
description: Use when working with TypeScript type definitions in a Stacks application - model types, request types, environment variables, event types, billing types, attribute types, or auto-imported globals. Covers storage/framework/types/ and storage/framework/core/types/src/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Types

Read the owning package's exported type before writing a parallel interface.
`@stacksjs/types` contains shared config/model/request/provider contracts;
`storage/framework/types/` contains app augmentations and generated registries.
Ambient types are not proof of runtime globals.

## Model and query types

~~~ts
import type { ModelRow, NewModelData, UpdateModelData } from '@stacksjs/orm'
import { User } from '@stacksjs/orm'

type UserRow = ModelRow<typeof User>
type UserInsert = NewModelData<typeof User>
type UserUpdate = UpdateModelData<typeof User>
~~~

ModelRow derives attributes, trait fields and relationship foreign keys from
the actual model. It is not a universal row with uuid/timestamps always present.
Use that inferred row instead of a legacy UserModel interface when custom
columns matter. NewModelData/UpdateModelData follow their real exported definitions;
do not assume every field is optional. Global compatibility aliases delegate to
those package types in orm-globals.d.ts; explicit imports keep modules portable.

DatabaseSchema augmentation and RowOf/TableName provide typed raw-table access.
ModelRegistry/ModelNames derive model-name completion from the models barrel;
empty registries may fall back to string until the app has generated its surface.
See stacks-models/stacks-query-builder for relationships and query result kinds.

## Requests, actions and registries

RequestInstance<TFields, TParams> from @stacksjs/types describes enhanced incoming
requests, with typed field access and string route params. The ambient
RequestInstance<typeof Model> compatibility alias maps a model to its ModelRow;
that generic is different from the package type's field generic.
Read core/types/src/request.ts before annotating all/validate/file/rawBody calls.

ActionPath, listener/middleware/job names and payload maps are generated from
the same discovered app/default resources their resolvers use. Route/action
helpers infer literal params; a name map is not a separately maintained count.
For custom registry augmentation use the owning package's interface. There are
no UserRequest/UserRequestModel runtime globals or a Model-suffix global variant.

## Events and environment

AppEvents is augmented on @stacksjs/events; auth and model events carry typed
payloads. Model before-events carry model objects, after-events carry rows;
the map is derived from models, not Record<string, any> for all events. Read
stacks-events for completion and cancellation semantics.

config/env.ts plus defineEnv is the schema and typing source for app variables.
The env proxy is typed/coerced and values may be undefined. Bun.env/process.env
hold raw environment strings; an old generated Bun.env augmentation is absent.
Do not copy stale MAIL_MAILER/DB_CONNECTION enums into another declaration.
Driver availability comes from config's capability registry, not a string union.
Auth tokenExpiry is milliseconds; current configured defaults are in auth.ts,
not a hard-coded thirty-day type comment. See stacks-env and stacks-auth.

## Browser globals and component metadata

STX runtime-attached names determine bare calls. The old browser manifest's
ambient declaration can disagree with runtime; read stacks-auto-imports and
stacks-composables. Imported modules need their own imports. Built-in names such
as Error/Request are preserved; import conflicting models explicitly.

Components resolve by the STX component pipeline, not a fabricated components.d.ts
global list. Editor web-types/custom-elements metadata is separate from runtime
components and package discovery. buddy generate and its typed registry commands
refresh declared resources; it cannot conjure a missing runtime export.

## Source and checks

`storage/framework/core/types/src/index.ts` exports shared declarations;
request.ts/model.ts/model-names.ts own those contracts.
`storage/framework/types/orm-globals.d.ts`, env.d.ts, models.d.ts,
model-events.d.ts and registries.d.ts connect application inference.
Read stacks-auto-imports/stacks-build for generated-declaration and runtime-export
checks. The types package no longer needs old Vite-only build/layout/SSG imports.
