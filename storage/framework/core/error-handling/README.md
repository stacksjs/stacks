# Stacks Error Handling

Similar to the way Rust handles errors and other functional programming languages.

>Encode failure into your program. This package contains a Result type that represents either success (`Ok`) or failure (`Err`).
>
>For asynchronous tasks, this package offers a `ResultAsync` class which wraps a `Promise<Result<T, E>>` and gives you the same level of expressivity and control as a regular `Result<T, E>`.
>
>`ResultAsync` is "thenable" meaning it behaves exactly like a native `Promise<Result>`, except you have access to the same methods that Result provides without having to `await` or `.then` the promise. _- neverthrow_

Read more about the API in the documentation [here](https://github.com/supermacro/neverthrow).

## ☘️ Features

Currently, a wrapper of the `neverthrow` API.

- Type-Safe Errors
- Encode failure into your program

## 🤖 Usage

```bash
bun install -d @stacksjs/error-handling
```

You can now use it in your project:

```js
import {
  Err,
  err,
  errAsync,
  fromPromise,
  fromSafePromise,
  fromThrowable,
  Ok,
  ok,
  okAsync,
  Result,
  ResultAsync,
} from '@stacksjs/error-handling'

// ...
```

### Example #1

```js
const result = ok({ myData: 'test' }) // instance of `Ok`

result.isOk() // true
result.isErr() // false
```

### Example #2

```js
const command = 'bunx --bun rimraf ./bun.lock ./node_modules ./core/**/dist'
const result = await runCommand(command, options)

if (result.isOk()) {
  log.success('Cleaned up')
  process.exit(ExitCode.Success)
}

log.error(result.error)
process.exit(ExitCode.FatalError)
```

Learn more in the [docs](https://github.com/supermacro/neverthrow/wiki).

## 🧪 Testing

```bash
bun test
```

## 🤗 Motivation

As from the [HackerNews thread](https://news.ycombinator.com/item?id=26191006) relating to "Where Everything Went Wrong: Error Handling and Error Messages in Rust (2020)":

```
Error handling has been wrong since the beginning, and has continued to be wrong ever since.

First, we had error codes. Except these were wrong because people forget all the time to check them.

Then we had exceptions, which solved the problem of people forgetting to check by crashing the app.

Then the Java team got the bright idea to have checked exceptions, which at first helped to mitigate crashes
from uncaught exception, but caused an explosion in thrown exception signatures, culminating in "catch Throwable".

Back to square one.

Then we got multi-return error objects, maybes, panics, and all sorts of bright ideas that fail to understand the basic premises of errors:

  Any error system that relies upon developer discipline will fail because errors will be missed.

  Any error system that handles all errors the same way will fail because there are some errors we can ignore,
  and some errors we must not ignore. And what's ignorable/retriable to one project is not ignorable/retriable to another.

Attempting to get the complete set of error types that any given call may raise is a fool's errand because of the halting
problem it eventually invokes. Forcing people to provide such a list results in the Java problem for the same reason.

It's a hard problem, which is why no one has solved it yet.
```

Quote from user [kstenerud](https://news.ycombinator.com/user?id=kstenerud).

## 📈 Changelog

Please see our [releases](https://github.com/stacksjs/stacks/releases) page for more information on what has changed recently.

## 🚜 Contributing

Please review the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://discord.gg/stacksjs)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
