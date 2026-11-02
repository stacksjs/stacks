# Stacks Fetcher

A simple, powerful HTTP client that wraps the fetch API with a more elegant interface and better TypeScript support.

## ☘️ Features

- 🚀 Simple, elegant API
- 💪 Full TypeScript support
- 🔄 JSON handling by default
- 📦 Native fetch transport with browser-compatible digest hashing
- 🎯 Type-safe requests and responses

## 🤖 Usage

### Basic Usage

```typescript
// Simple GET request
const response = await fetcher.get('/users')
console.log(response.data)

// Simple POST request
const response = await fetcher.post('/users', {
  name: 'John',
  email: 'john@example.com'
})
```

### Type-Safe Requests

The fetcher is built with TypeScript in mind and provides full type safety for both requests and responses:

```typescript
// Define your types
interface User {
  id: number
  name: string
  email: string
  created_at: string
}

// GET with array response type
const { data: users } = await fetcher.get<User[]>('/users')
users.forEach(user => console.log(user.name)) // TypeScript knows name exists

// GET single item
const { data: user } = await fetcher.get<User>('/users/1')
console.log(user.id) // TypeScript knows id exists
```

### Type-Safe POST Requests

You can type both the request data and response:

```typescript
interface CreateUserRequest {
  name: string
  email: string
}

interface User extends CreateUserRequest {
  id: number
  created_at: string
}

const { data: newUser } = await fetcher.post<User, CreateUserRequest>('/users', {
  name: 'John', // TypeScript will error if we miss required fields
  email: 'john@example.com'
})
console.log(newUser.created_at) // TypeScript knows created_at exists
```

### Response Structure

All fetcher methods return a consistent response structure:

```typescript
interface FetcherResponse<T> {
  data: T          // The response data (typed as T)
  status: number   // HTTP status code
  headers: Headers // Response headers
  isOk: boolean    // Whether the request was successful
  ok(): boolean    // Whether the status is exactly 200
}
```

### Request configuration and responses

Fluent settings apply to the next request only. Starting a request consumes its headers,
credentials, query parameters, body and attachments synchronously. Overlapping calls keep
independent settings, including when serialization, transport or response parsing fails.
Header overrides are case-insensitive. Query values are appended to existing parameters
before a fragment; null and undefined values are omitted.

Response data is parsed as JSON for `application/json` and `+json` media types. Empty
responses have `data: null`; other media types return text. Invalid declared JSON rejects.
HTTP error statuses still return a response so callers can inspect its status and data.

### Digest authentication

```typescript
const response = await fetcher
  .withDigestAuth('user', 'password')
  .withBody({ message: 'hello' })
  .post('/protected')
```

The client supports MD5 and SHA-256, their session variants, `auth`, `auth-int`, and legacy
challenges without qop. It chooses SHA-256 when offered, parses quoted challenge values,
normalizes UTF-8 credentials to NFC, and replays the exact prepared body bytes, including
multipart boundaries, once. Unsupported
challenges return the original 401. Digest hashing loads `hash-wasm` on demand and needs
WebAssembly in browsers. MD5 is supported for legacy digest servers only.

Digest requests omit ambient cookies and browser HTTP-auth credentials to let the client
handle the challenge without a native login dialog. Explicit headers still apply. Challenges
received after a redirect are not authenticated; call the final protected URL directly.

### Resource serialization

`JsonResource` and `ResourceCollection` can be returned directly from a route. Serialization
uses the public projection, including nested resources and collections, without exposing
source records or the stored request. Nested projections receive the parent request.
Conditional values are resolved at every level and missing entries are omitted from objects
and arrays. Nested arrays retain their shape. Cycles and excessive nesting throw before any
raw fallback can be serialized; the shared resolution budget is 20 object or wrapper levels.

```typescript
class UserResource extends JsonResource<User> {
  toArray() {
    return {
      id: this.resource.id,
      ...this.merge({ name: this.resource.name }),
      ...this.mergeWhen(this.resource.isPublic, { email: this.resource.email }),
    }
  }
}
```

Spread merges follow ordinary object spread ordering. Named merge placeholders and explicit
`MergeValue` instances remain supported. Special field names such as `__proto__` are retained
as data properties. Direct paginated collections retain projected rows, metadata and links.
Pagination requires positive safe integer page numbers and sizes and a nonnegative safe
integer total. Empty pages report null row bounds, and empty results have one page. Links
replace an existing `page` parameter while retaining filters, duplicate parameters and fragments.

### Generated API clients and types

The OpenAPI generators emit standalone TypeScript clients with no runtime imports.
Framework contributors regenerate the checked artifacts with `./buddy docs:artifacts`
and verify them with `./buddy docs:artifacts:check`.

Methods retain flat path/query arguments when names are unique. Duplicate names,
or collisions with a body or typed-header container that exists, use location groups:

```typescript
await client.show({ path: { id: 'alice' }, query: { id: 7 } })
await client.upload({ headers: { 'X-Tenant': 'tenant-a' }, body: file })
```

Required headers and bodies are typed and checked before transport. Request settings
merge in this order: client headers, bearer token, per-call headers, typed header inputs.
Header names are case-insensitive. Dot-only path segments are rejected before sending.
Generated method names reserve client members and stay unique after normalization.
Documentation is escaped before it is embedded in generated comments.

Query serialization supports form arrays and objects, deepObject filters with scalar
values, and space/pipe-delimited arrays. Path and header parameters support simple
serialization. Unsupported locations or styles fail during generation. Cookie parameters
are unsupported because browser fetch cannot set the Cookie header directly.

Bodies support JSON (including `+json`), URL-encoded forms, multipart objects or FormData,
and raw text/binary payloads. Select among declared formats with the second argument,
`{ contentType: 'application/x-www-form-urlencoded' }`. Multipart boundaries are set by
fetch. Custom per-part encodings and automatic XML serialization are not provided.
Responses are decoded by media type; declared binary schemas return Blob values, text
stays text, and empty/HEAD responses return null. All declared successful response
schemas contribute to the result union. HTTP error statuses return `ok: false`.

Schema generation supports local component references (including recursive models),
nullable fields, literal JSON enums, unions and intersections. Unresolved, external and
cyclic alias references fail during generation. Request schemas omit read-only fields;
response schemas omit write-only fields. `components.requestSchemas` exposes request
variants alongside response `components.schemas`.

TypeScript index signatures apply to named fields too. For schemas combining named
properties and typed additional properties, the generated index includes the named
field types and optional undefined values to remain compilable. Runtime validation
must enforce the narrower constraints on additional properties.

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
