# Dashboard Modules

This directory contains Vue plugins for the dashboard application.

## Available Plugins

### auth-plugin.ts
Handles authentication routing logic. Automatically redirects unauthenticated users to `/login` when they try to access protected routes.

### user-plugin.ts
Makes user data available globally throughout the application. **No imports needed!**

## Usage

### Accessing User Data (Recommended - No Imports!)

#### In Templates (Works Everywhere!)
```vue
<template>
  <div>
    <!-- Just use $user and $isAuthenticated directly - no imports! -->
    <p v-if="$isAuthenticated">Welcome, {{ $user?.name }}!</p>
    <p v-else>Please log in</p>
    
    <p>Email: {{ $user?.email }}</p>
    <p>User ID: {{ $user?.id }}</p>
  </div>
</template>
```

#### In Options API Components
```vue
<script>
export default {
  mounted() {
    // Access via this.$user and this.$isAuthenticated
    console.log('User:', this.$user)
    console.log('Is authenticated:', this.$isAuthenticated)
  },
  
  methods: {
    doSomething() {
      if (this.$isAuthenticated) {
        console.log('Hello', this.$user?.name)
      }
    }
  }
}
</script>
```

### Alternative Approaches (If You Prefer)

#### Composition API with inject
```vue
<script setup>
import { inject } from 'vue'

const user = inject('user')
const isAuthenticated = inject('isAuthenticated')
</script>
```

#### Direct useAuth (if auto-imported)
```vue
<script setup>
const { user, isAuthenticated } = useAuth()
</script>
```

## Why Global Properties?

The main benefit is **simplicity**:
- ✅ No imports needed
- ✅ Works in templates directly
- ✅ Works in Options API
- ✅ Works in Composition API
- ✅ Available everywhere in your app
- ✅ TypeScript support with proper declarations

## Plugin Installation

These plugins are automatically installed by the main.ts file when the application starts. They are loaded from the `modules/` directory using Vite's glob imports. 