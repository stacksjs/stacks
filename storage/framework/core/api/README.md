# Stacks Fetcher

A simple, powerful HTTP client that wraps the fetch API with a more elegant interface and better TypeScript support.

## ☘️ Features

- 🚀 Simple, elegant API
- 💪 Full TypeScript support
- 🔄 JSON handling by default
- 📦 Zero dependencies (uses native fetch)
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
  ok: boolean      // Whether the request was successful
}
```

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

[Join the Stacks Discord Server](https://discord.gg/stacksjs)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
