# Stacks Validation

This package contains the Stacks Validation system.

## ☘️ Features

- **Validation** - Validate data against a schema

## 🤖 Usage

```bash
bun install -d @stacksjs/validation
```

Now, you can use it in your project:

```js
import { validate } from '@stacksjs/validation'

// wip
```

To view the full documentation, please visit [<https://stacksjs.com/validatio>n](https://stacksjs.com/validation).

File validators require an uploaded file object with a nonnegative safe integer byte size and string metadata when present. Plain JSON upload lookalikes and malformed metadata are rejected. Bounded enum and ID selections enforce their minimum after deduplication; their maximum also bounds the raw input. Numeric timestamps must be finite, nonnegative, and within JavaScript's valid date range, including numeric strings.

## 🧪 Testing

```bash
bun test
```

## 📈 Changelog

Please see our [releases](https://github.com/stacksjs/stacks/releases) page for more information on what has changed recently.

## 🚜 Contributing

Please review the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://stacksjs.com/discord)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙

## Custom action input

Use the narrow entry when a custom action validates JSON, route identifiers or
partial model fields:

```ts
import { readJsonObject, parsePositiveId, parseNumberInput, parseBooleanInput,
  validateModelInput } from '@stacksjs/validation/input'

const body = await readJsonObject(request)
const id = parsePositiveId(request.params.id)
const amount = parseNumberInput(body.amount, 'amount', 0, 100000, true)
const enabled = parseBooleanInput(body.enabled, 'enabled')
validateModelInput(MyModel, { amount })
```

Failures throw `InputValidationError` with HTTP `status: 422`. Numbers reject
booleans, non-finite values and unsafe integers. Optional text and numbers return
null; omitted booleans return undefined. Explicit false and zero are preserved.
Model validation checks supplied fields against their declared rules; the action
still selects writable fields and enforces required fields and relationships.

## Reusable boundary and stored-value rules

`parseTextInput(value, field, required?, maxLength?)` rejects overlong text
rather than truncating it. `parseEnumInput(value, field, choices)` requires
exact string membership; it never stringifies an object or boolean.
`storedBoolean(value, fallback)` decodes SQL/form 0/1 and false/true; the
caller explicitly chooses the fallback for missing or corrupt stored data.
Partial model validation accepts attribute names and their snake-case column
spelling, including camel-case definitions.

`positiveIdOrNull(value)` is the nullable adapter for optional identifiers and
record serializers; it uses the same safe-integer and type rules as parsePositiveId.


## Validation boundaries

`validate(data, rules)` treats plain records as application data, including fields named
`url`, `query` and `params`. Native Requests are parsed according to Content-Type and
Stacks requests use their `all()` method. Adapters exposing `jsonBody` or `formBody`
remain supported. URL/query/params-only adapters select `{ source: 'request' }` as the
third argument. `{ source: 'data' }` forces plain-data interpretation for records with
adapter-like field names.

Returned values contain declared, supplied fields only. Nested object shapes and arrays
validated with `each()` also omit undeclared fields. Inputs and reusable schemas are not
mutated. Opaque custom validators retain their accepted values. Required fields and
conditional siblings must be own properties; prototype properties never count as input.
Special names such as `__proto__` are retained safely as data and error keys.

`validateField()` discovers nested app models, honors app overrides, and matches exact
model filenames or qualified paths. Ambiguous bare names require a qualified path.
A model default excuses an omitted optional value, not a supplied invalid one. Attribute
names and snake-case column names are accepted. When both spellings are supplied,
the attribute name takes precedence, matching the ORM write path.

Database-backed `exists()` and `unique()` propagate query failures instead of approving
unchecked values. This intentionally changes the previous fail-open behavior. Use a
separate operational error response for database failures; do not treat them as success.

Custom messages use the effective rule's reported failures without executing predicates
again. Field-wide strings also cover nested errors. Where opaque rules render identical
messages for different failures, the original message is retained rather than guessing.

Validation reports use async-local state. Each public validation operation starts an
isolated report before its first await, and successful operations clear prior errors.
`getErrors()` returns a snapshot. Standalone adapters or jobs that call `reportError()`
directly can wrap their work with `withValidationContext(() => ...)` to define its scope.

Timestamp strings validate their written calendar before parsing. SQL timestamps, ISO
offsets, minute precision, expanded years and the exact 24:00 midnight notation remain
supported. File byte limits require nonnegative safe integers; invalid configuration
throws immediately.

## Conditional and input contracts

Actions, model writes and partial model input validation apply conditional rules
against supplied siblings before evaluating a field. Model contexts recognize both
attribute and column aliases; creates also include declared defaults. Partial updates
check supplied fields without fetching stored siblings. Conditions and custom messages
use the effective rule while leaving the declared schema reusable.

Numeric input rejects unsafe whole numbers even when fractions are allowed. Infinite
range endpoints explicitly mean unbounded; NaN, inverted ranges and ranges containing
no finite numbers are configuration errors. Text limits require nonnegative safe
integers. Configuration errors throw RangeError even for absent optional values.
