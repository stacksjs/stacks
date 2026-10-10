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
