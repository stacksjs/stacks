# Stacks Utils

Import individual helpers from `@stacksjs/utils/<entry>` or the package root.

- `isDeepEqual` compares cyclic structures without requiring identical sharing
  or cycle topology. Own object keys must match. Array holes differ from own
  undefined slots. Dates, Maps, Sets and binary data compare by value; host
  objects such as URLs retain identity semantics.
- `safeJsonStringify` replaces ancestor cycles with `[Circular]` and converts
  BigInts to decimal strings. Shared non-cyclic values serialize fully. The
  return type is `string | undefined`, as unsupported JSON roots yield undefined.
  User getters and `toJSON` methods can still throw.
- `debounce` and `throttle` preserve arguments and receivers. Calls return the
  latest callback result, or undefined before an invocation. Debounce `flush()`
  invokes pending work and returns its result, even with `trailing: false`.
  Reentrant callbacks retain newly queued work. Both offer `cancel()`; throttle
  cancellation resets its interval. Async results remain Promises.
- `merge` reads only own enumerable string keys. Arrays concatenate; plain
  records recursively merge. Non-plain nested values retain identity. A plain
  source record replaces a non-plain target; `__proto__` is skipped.
- `parseBytes` requires a complete decimal with an optional recognized decimal
  or binary unit. It accepts fractions and negative values, rejects unknown
  units and partial input, and rejects non-finite results.

Regression coverage lives in `tests/*state-contracts.test.ts`. `state-e2e.test.ts`
runs real HTTP and Chrome consumers with SQLite, the native request cursor
parser and memory storage. `published-state-contracts.test.ts` builds the package
and checks its runtime exports and declarations in an isolated consumer.
