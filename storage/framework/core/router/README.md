# Stacks Router

This package contains the Stacks Router.

## ☘️ Features

wip

- ⚡️

wip

## 🤖 Usage

wip

```bash
bun install -d @stacksjs/router
```

Now, you can use it in your project:

```js
import * as router from '@stacksjs/router'

// wip
```

API servers that only need route registration and serving can use the narrow
runtime entry. The root entry remains the complete compatibility surface.

```ts
import { createStacksRouter } from '@stacksjs/router/runtime'
```

For immutable health, readiness, redirect, or configuration responses, register
the final response explicitly:

```ts
const router = createStacksRouter()

router.staticResponse('GET', '/ready', new Response('{"ready":true}', {
  headers: { 'content-type': 'application/json' },
}))
```

This is Bun's direct static dispatch. It bypasses every request-time Stacks
facility, including middleware, request IDs, CSRF, cookies, rate limits,
request context, header mutation, compression, and response formatting. The
supplied `Response` must already contain the final status, headers, and bytes.
Do not use it for a response that depends on the request.

Learn more in the docs.

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

## Bounded JSON protocols

Routes that own their wire body can opt into rejecting duplicate object keys:

```ts
import { readJsonBody } from '@stacksjs/router/body'

const input = await readJsonBody(request, 8192, { rejectDuplicateKeys: true })
```

Keep automatic body parsing disabled for this route. The reader checks the media
type, counts streamed bytes and validates UTF-8 before parsing. Duplicate keys at
any depth, including equivalent escaped spellings, produce `RequestBodyError`
with status400. The default retains normal `JSON.parse` behavior for existing
callers. Identical names in different objects remain valid, and Unicode keys are
compared after escape decoding without Unicode normalization.

`parseJsonText(text, options)` is also exported from `@stacksjs/router` and
`@stacksjs/router/json` for already-decoded JSON. It throws `SyntaxError` for
invalid JSON or a duplicate key in strict mode. This helper does not read a
request, limit bytes, authenticate a caller or validate an application schema.

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
