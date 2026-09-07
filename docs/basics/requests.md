---
title: Requests
description: "The request object an Action receives: reading input, typed accessors, validation, files, route parameters and request metadata."
---
# Requests

Every Action's `handle` receives a request. It wraps the incoming HTTP request
and merges query string, JSON body, form body and route parameters into one
input bag, so `request.get('email')` finds the value wherever it arrived.

```typescript
// app/Actions/Auth/LoginAction.ts
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'LoginAction',
  description: 'Authenticate a user',

  async handle(request: RequestInstance) {
    const email = request.get('email')
    const password = request.get('password')

    // ...
  },
})
```

## Reading input

`get` and `input` are the same accessor - use whichever reads better. Both take
an optional default:

```typescript
const email = request.get('email')
const page = request.get('page', 1)
const perPage = request.input('per_page', 15)
```

Pass a type parameter when the value is not a string:

```typescript
const ids = request.get<number[]>('ids', [])
```

### Working with the whole bag

```typescript
request.all()                              // every field
request.only(['email', 'password'])        // just these
request.except(['password'])               // everything but these
request.keys()                             // the field names
request.merge({ source: 'api' })           // add fields
request.isEmpty()                          // no input at all
```

`only` and `except` accept a type parameter, which is worth using - it is what
makes the result typed rather than `any`:

```typescript
const credentials = request.only<{ email: string, password: string }>([
  'email',
  'password',
])
```

### Presence

Four predicates, and the difference between them matters:

```typescript
request.has('remember')                    // the key exists
request.has(['email', 'password'])         // all of these exist
request.hasAny(['email', 'username'])      // at least one exists
request.filled('name')                     // exists AND is not empty
request.missing('nickname')                // does not exist
```

`has` is true for an empty string; `filled` is not. For "the user actually
supplied something", reach for `filled`.

```typescript
request.whenHas('sort', value => applySort(value))
request.whenFilled('search', term => applySearch(term))
request.isValue('status', 'published')
```

## Typed accessors

Input arrives as strings. These coerce, so the rest of the Action does not have
to:

```typescript
request.string('name')                     // string
request.integer('page', 1)                 // number
request.float('price')                     // number
request.boolean('subscribed')              // boolean
request.array<number>('ids')               // T[]
request.date('published_at')               // Date | null
request.enum('status', PostStatus)         // the enum member
request.collect<Tag>('tags')               // Collection<T>
```

`boolean` understands the strings a form actually sends - `'1'`, `'true'`,
`'on'`, `'yes'` - rather than treating every non-empty string as true.

## Validation

An Action declares its rules, and `validate` applies them:

```typescript
await request.validate({
  email: { rule: schema.string().email() },
  password: { rule: schema.string().min(8) },
})

const data = request.getValidated()        // only the validated fields
const safe = request.safe()                // the same, as SafeData
```

Validation failures throw, and the error handler turns them into a 422 with the
field messages. See [Validation](/packages/validation) for the rule set.

## Route parameters

Parameters declared in the route are readable on their own, and are also part of
the input bag:

```typescript
// route.get('/posts/{id}', 'Actions/PostShowAction')
request.param('id')
request.getParam('id')
request.getParamAsInt('id')                // number | null
request.getParams()                        // all of them
request.route('id')
```

## Files

```typescript
request.file('avatar')                     // UploadedFile | null
request.getFiles('attachments')            // UploadedFile[]
request.hasFile('avatar')
request.allFiles()
```

See [Storage](/packages/storage) for writing an uploaded file somewhere.

## Request metadata

```typescript
request.header('x-request-id')
request.bearerToken()
request.ip()
request.ipForRateLimit()
request.browser()
request.getMethod()
request.json()                             // the parsed JSON body
request.user()                             // the authenticated user, if any
```

`ipForRateLimit` is deliberately separate from `ip`: it is the address a rate
limiter should key on, which is not always the one you would log.

## Old input

After a failed validation, the previous input is available for re-rendering a
form:

```typescript
request.old('email')
request.flashInput()                       // flash everything
request.flashInputOnly(['email'])
request.flashInputExcept(['password'])
```

## Typing the request

`RequestInstance` takes the field and parameter shapes, so `get`, `only` and the
typed accessors know your keys:

```typescript
interface LoginFields {
  email: string
  password: string
  remember?: boolean
}

async handle(request: RequestInstance<LoginFields>) {
  const email = request.get('email')       // string
  const remember = request.boolean('remember', false)
}
```
