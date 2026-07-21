---
title: Actions Package
description: "Actions are reusable server-side business operations. Application actions live in , while framework defaults live in ."
---
# Actions

Actions are reusable server-side business operations. Application actions live in `app/Actions/`, while framework defaults live in `storage/framework/defaults/actions/`.

## Create an action

```bash
buddy make:action NotifyUser
```

```ts
export default {
  name: 'NotifyUser',
  description: 'Notify a user after registration',

  async handle(request) {
    const userId = request.get('user_id')
    return { success: true, userId }
  },
}
```

Actions receive the enhanced request object. Use `request.get()`, `request.input()`, `request.all()`, and `request.user()` to read validated input and authentication state.

## Route to an action

```ts
route.post('/users', 'Actions/CreateUser')
```

String-based action references are resolved at runtime. An action can also handle events when its `handle()` method accepts the emitted event.

## Generate REST actions from a model

```ts
defineModel({
  name: 'Product',
  traits: {
    useApi: {
      uri: 'products',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
  },
})
```

The `useApi` trait generates the standard list, create, show, update, and delete actions and registers their API routes. Prefer this path when the operation maps directly to model CRUD. Create an application action when the behavior represents domain logic.
