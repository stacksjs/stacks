# Dashboard Modules

This directory contains plugins for the dashboard application.

## Available Plugins

### auth-plugin.ts
Handles authentication routing logic. Automatically redirects unauthenticated users to `/login` when they try to access protected routes.

### user-plugin.ts
Makes user data available globally throughout the application. **No imports needed!**

## Usage

### Accessing User Data (Recommended - No Imports!)

#### In Templates (Works Everywhere!)
```stx
<template>
  <div>
    <!-- Just use $user and $isAuthenticated directly - no imports! -->
    <p @if="$isAuthenticated">Welcome, {{ $user?.name }}!</p>
    <p @else>Please log in</p>

    <p>Email: {{ $user?.email }}</p>
    <p>User ID: {{ $user?.id }}</p>
  </div>
</template>
```

### Alternative Approaches (If You Prefer)

#### Composition API with inject
```stx
<script setup>
import { inject } from '@stacksjs/stx'

const user = inject('user')
const isAuthenticated = inject('isAuthenticated')
</script>
```

#### Direct useAuth (if auto-imported)
```stx
<script setup>
const { user, isAuthenticated } = useAuth()
</script>
```

## Why Global Properties?

The main benefit is **simplicity**:
- No imports needed
- Works in templates directly
- Works in Composition API
- Available everywhere in your app
- TypeScript support with proper declarations

## Plugin Installation

These plugins are automatically installed by the main.ts file when the application starts. They are loaded from the `modules/` directory using glob imports.
