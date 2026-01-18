# Authentication How-To

This guide covers implementing authentication in your Stacks application, including user registration, login, token management, and protected routes.

## Setting Up Authentication

### Configuration

Configure authentication in `config/auth.ts`:

```typescript
// config/auth.ts
import type { AuthConfig } from '@stacksjs/types'

export default {
  // Default authentication guard
  default: 'api',

  // Available guards
  guards: {
    api: {
      driver: 'token',
      provider: 'users',
    },
  },

  // User providers
  providers: {
    users: {
      driver: 'database',
      table: 'users',
    },
  },

  // Field names
  username: 'email',
  password: 'password',

  // Token settings
  tokenExpiry: 30 * 24 * 60 * 60 * 1000, // 30 days
  tokenRotation: 24, // hours
  defaultAbilities: ['*'],
  defaultTokenName: 'auth-token',

  // Password reset
  passwordReset: {
    expire: 60, // minutes
    throttle: 60, // seconds
  },
} satisfies AuthConfig
```

### Database Setup

Ensure your users table has the required fields:

```sql
-- database/migrations/create-users-table.sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT,
  email_verified_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tokens table for API authentication
CREATE TABLE personal_access_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  abilities TEXT,
  last_used_at DATETIME,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

Run migrations:

```bash
buddy migrate
```

## User Registration

### Registration Action

```typescript
// app/Actions/Auth/RegisterAction.ts
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { register } from '@stacksjs/auth'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'RegisterAction',
  description: 'Register a new user',
  method: 'POST',

  validations: {
    email: {
      rule: schema.string().email(),
      message: 'Please provide a valid email address.',
    },
    password: {
      rule: schema.string().min(8).max(255),
      message: 'Password must be at least 8 characters.',
    },
    password_confirmation: {
      rule: schema.string(),
      message: 'Password confirmation is required.',
    },
    name: {
      rule: schema.string().min(2).max(100),
      message: 'Name must be between 2 and 100 characters.',
    },
  },

  async handle(request: RequestInstance) {
    const email = request.get('email')
    const password = request.get('password')
    const passwordConfirmation = request.get('password_confirmation')
    const name = request.get('name')

    // Verify password confirmation
    if (password !== passwordConfirmation) {
      return response.badRequest('Passwords do not match.')
    }

    // Check if email already exists
    const existingUser = await User.where('email', email).first()
    if (existingUser) {
      return response.badRequest('Email already registered.')
    }

    // Register the user
    const result = await register({ email, password, name })

    if (result) {
      return response.json({
        message: 'Registration successful',
        token: result.token,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
        },
      }, 201)
    }

    return response.error('Registration failed')
  },
})
```

### Registration Route

```typescript
// routes/api.ts
route.post('/register', 'Actions/Auth/RegisterAction')
```

### Registration Form (Frontend)

```html
<!-- resources/components/RegisterForm.stx -->
<script server>
import { ref } from '@stacksjs/reactivity'

const form = ref({
  name: '',
  email: '',
  password: '',
  password_confirmation: '',
})
const error = ref('')
const loading = ref(false)

async function handleRegister() {
  error.value = ''
  loading.value = true

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value),
    })

    const data = await res.json()

    if (!res.ok) {
      error.value = data.message || 'Registration failed'
      return
    }

    // Store token and redirect
    localStorage.setItem('token', data.token)
    window.location.href = '/dashboard'
  } catch (e) {
    error.value = 'An error occurred. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<form onsubmit="event.preventDefault(); handleRegister()" class="space-y-4 max-w-md mx-auto">
  <h2 class="text-2xl font-bold">Create Account</h2>

  @if(error.value)
    <div class="bg-red-100 text-red-700 p-3 rounded">
      {{ error.value }}
    </div>
  @endif

  <div>
    <label class="block text-sm font-medium mb-1">Name</label>
    <input
      type="text"
      value="{{ form.value.name }}"
      oninput="form.value.name = event.target.value"
      class="w-full px-3 py-2 border rounded-lg"
      required
    />
  </div>

  <div>
    <label class="block text-sm font-medium mb-1">Email</label>
    <input
      type="email"
      value="{{ form.value.email }}"
      oninput="form.value.email = event.target.value"
      class="w-full px-3 py-2 border rounded-lg"
      required
    />
  </div>

  <div>
    <label class="block text-sm font-medium mb-1">Password</label>
    <input
      type="password"
      value="{{ form.value.password }}"
      oninput="form.value.password = event.target.value"
      class="w-full px-3 py-2 border rounded-lg"
      required
    />
  </div>

  <div>
    <label class="block text-sm font-medium mb-1">Confirm Password</label>
    <input
      type="password"
      value="{{ form.value.password_confirmation }}"
      oninput="form.value.password_confirmation = event.target.value"
      class="w-full px-3 py-2 border rounded-lg"
      required
    />
  </div>

  <button
    type="submit"
    disabled="{{ loading.value }}"
    class="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
  >
    {{ loading.value ? 'Creating account...' : 'Register' }}
  </button>

  <p class="text-center text-sm text-gray-600">
    Already have an account?
    <a href="/login" class="text-blue-500 hover:underline">Login</a>
  </p>
</form>
```

## User Login

### Login Action

```typescript
// app/Actions/Auth/LoginAction.ts
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { Auth } from '@stacksjs/auth'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'LoginAction',
  description: 'Login to the application',
  method: 'POST',

  validations: {
    email: {
      rule: schema.string().email(),
      message: 'Email must be a valid email address.',
    },
    password: {
      rule: schema.string().min(1),
      message: 'Password is required.',
    },
  },

  async handle(request: RequestInstance) {
    const email = request.get('email')
    const password = request.get('password')
    const remember = request.get('remember', false)

    const result = await Auth.login({ email, password })

    if (result) {
      return response.json({
        token: result.token,
        user: {
          id: result.user?.id,
          email: result.user?.email,
          name: result.user?.name,
        },
        // Extend token expiry if "remember me"
        expiresIn: remember ? 30 * 24 * 60 * 60 : 24 * 60 * 60,
      })
    }

    return response.unauthorized('Invalid email or password')
  },
})
```

### Login Route

```typescript
// routes/api.ts
route.post('/login', 'Actions/Auth/LoginAction')
```

### Login Form (Frontend)

```html
<!-- resources/components/LoginForm.stx -->
<script server>
import { ref } from '@stacksjs/reactivity'

const form = ref({
  email: '',
  password: '',
  remember: false,
})
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  error.value = ''
  loading.value = true

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value),
    })

    const data = await res.json()

    if (!res.ok) {
      error.value = data.message || 'Login failed'
      return
    }

    // Store token
    localStorage.setItem('token', data.token)

    // Redirect to dashboard
    window.location.href = '/dashboard'
  } catch (e) {
    error.value = 'An error occurred. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<form onsubmit="event.preventDefault(); handleLogin()" class="space-y-4 max-w-md mx-auto">
  <h2 class="text-2xl font-bold">Login</h2>

  @if(error.value)
    <div class="bg-red-100 text-red-700 p-3 rounded">
      {{ error.value }}
    </div>
  @endif

  <div>
    <label class="block text-sm font-medium mb-1">Email</label>
    <input
      type="email"
      value="{{ form.value.email }}"
      oninput="form.value.email = event.target.value"
      class="w-full px-3 py-2 border rounded-lg"
      required
    />
  </div>

  <div>
    <label class="block text-sm font-medium mb-1">Password</label>
    <input
      type="password"
      value="{{ form.value.password }}"
      oninput="form.value.password = event.target.value"
      class="w-full px-3 py-2 border rounded-lg"
      required
    />
  </div>

  <div class="flex items-center gap-2">
    <input
      type="checkbox"
      id="remember"
      checked="{{ form.value.remember }}"
      onchange="form.value.remember = event.target.checked"
    />
    <label for="remember" class="text-sm">Remember me</label>
  </div>

  <button
    type="submit"
    disabled="{{ loading.value }}"
    class="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
  >
    {{ loading.value ? 'Logging in...' : 'Login' }}
  </button>

  <div class="flex justify-between text-sm">
    <a href="/forgot-password" class="text-blue-500 hover:underline">
      Forgot password?
    </a>
    <a href="/register" class="text-blue-500 hover:underline">
      Create account
    </a>
  </div>
</form>
```

## Token Management

### Creating API Tokens

```typescript
// app/Actions/Auth/CreateTokenAction.ts
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'CreateTokenAction',
  description: 'Create a new API token',
  method: 'POST',

  validations: {
    name: {
      rule: schema.string().min(1).max(100),
      message: 'Token name is required.',
    },
    abilities: {
      rule: schema.array().optional(),
      message: 'Abilities must be an array.',
    },
  },

  async handle(request: RequestInstance) {
    const user = request.user()
    const name = request.get('name')
    const abilities = request.get('abilities', ['*'])

    const token = await user.createToken(name, abilities)

    return response.json({
      token: token.plainTextToken,
      name: token.name,
      abilities: token.abilities,
    }, 201)
  },
})
```

### Listing Tokens

```typescript
// app/Actions/Auth/ListTokensAction.ts
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ListTokensAction',
  description: 'List user tokens',
  method: 'GET',

  async handle(request: RequestInstance) {
    const user = request.user()
    const tokens = await user.tokens()

    return response.json({
      tokens: tokens.map(token => ({
        id: token.id,
        name: token.name,
        abilities: token.abilities,
        lastUsedAt: token.last_used_at,
        createdAt: token.created_at,
      })),
    })
  },
})
```

### Revoking Tokens

```typescript
// app/Actions/Auth/RevokeTokenAction.ts
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'RevokeTokenAction',
  description: 'Revoke an API token',
  method: 'DELETE',

  async handle(request: RequestInstance) {
    const user = request.user()
    const tokenId = request.param('id')

    const token = await PersonalAccessToken.where('id', tokenId)
      .where('user_id', user.id)
      .first()

    if (!token) {
      return response.notFound('Token not found')
    }

    await token.delete()

    return response.json({ message: 'Token revoked' })
  },
})
```

### Refreshing Tokens

```typescript
// app/Actions/Auth/RefreshTokenAction.ts
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { Auth } from '@stacksjs/auth'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'RefreshTokenAction',
  description: 'Refresh authentication token',
  method: 'POST',

  async handle(request: RequestInstance) {
    const currentToken = request.bearerToken()

    if (!currentToken) {
      return response.unauthorized('No token provided')
    }

    const result = await Auth.refreshToken(currentToken)

    if (result) {
      return response.json({
        token: result.token,
        expiresIn: result.expiresIn,
      })
    }

    return response.unauthorized('Invalid or expired token')
  },
})
```

## Protected Routes

### Using Auth Middleware

```typescript
// routes/api.ts
import { route } from '@stacksjs/router'

// Public routes
route.post('/login', 'Actions/Auth/LoginAction')
route.post('/register', 'Actions/Auth/RegisterAction')
route.post('/auth/refresh', 'Actions/Auth/RefreshTokenAction')

// Protected routes - require authentication
route.group({ middleware: 'auth' }, () => {
  route.get('/me', 'Actions/Auth/AuthUserAction')
  route.post('/logout', 'Actions/Auth/LogoutAction')

  // Token management
  route.get('/tokens', 'Actions/Auth/ListTokensAction')
  route.post('/token', 'Actions/Auth/CreateTokenAction')
  route.delete('/tokens/{id}', 'Actions/Auth/RevokeTokenAction')

  // User profile
  route.put('/profile', 'Actions/User/UpdateProfileAction')
  route.put('/password', 'Actions/User/ChangePasswordAction')
})
```

### Get Authenticated User

```typescript
// app/Actions/Auth/AuthUserAction.ts
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'AuthUserAction',
  description: 'Get authenticated user',
  method: 'GET',

  async handle(request: RequestInstance) {
    const user = request.user()

    return response.json({
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerifiedAt: user.email_verified_at,
      createdAt: user.created_at,
    })
  },
})
```

### Logout Action

```typescript
// app/Actions/Auth/LogoutAction.ts
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { Auth } from '@stacksjs/auth'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'LogoutAction',
  description: 'Logout the user',
  method: 'POST',

  async handle(request: RequestInstance) {
    const token = request.bearerToken()

    if (token) {
      await Auth.revokeToken(token)
    }

    return response.json({ message: 'Logged out successfully' })
  },
})
```

## Frontend Authentication Helper

Create a reusable auth service:

```typescript
// resources/functions/auth.ts
import { reactive } from '@stacksjs/reactivity'

interface User {
  id: number
  email: string
  name: string
}

export const auth = reactive({
  user: null as User | null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
})

export async function login(email: string, password: string) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.message || 'Login failed')
  }

  const data = await res.json()
  auth.token = data.token
  auth.user = data.user
  auth.isAuthenticated = true
  localStorage.setItem('token', data.token)

  return data
}

export async function logout() {
  if (auth.token) {
    await fetch('/api/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auth.token}`,
      },
    })
  }

  auth.token = null
  auth.user = null
  auth.isAuthenticated = false
  localStorage.removeItem('token')
}

export async function fetchUser() {
  if (!auth.token) return null

  const res = await fetch('/api/me', {
    headers: {
      'Authorization': `Bearer ${auth.token}`,
    },
  })

  if (res.ok) {
    auth.user = await res.json()
    return auth.user
  }

  // Token invalid, clear auth state
  await logout()
  return null
}

export function getAuthHeaders() {
  return auth.token
    ? { 'Authorization': `Bearer ${auth.token}` }
    : {}
}
```

## Password Reset

### Request Password Reset

```typescript
// app/Actions/Password/SendPasswordResetEmailAction.ts
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'SendPasswordResetEmailAction',
  description: 'Send password reset email',
  method: 'POST',

  validations: {
    email: {
      rule: schema.string().email(),
      message: 'Valid email is required.',
    },
  },

  async handle(request: RequestInstance) {
    const email = request.get('email')

    // Always return success to prevent email enumeration
    const user = await User.where('email', email).first()

    if (user) {
      // Generate reset token
      const token = await user.createPasswordResetToken()

      // Send email (using your email service)
      await sendEmail({
        to: email,
        subject: 'Reset Your Password',
        template: 'password-reset',
        data: {
          resetUrl: `${APP_URL}/reset-password?token=${token}`,
        },
      })
    }

    return response.json({
      message: 'If an account exists, a reset link has been sent.',
    })
  },
})
```

### Reset Password

```typescript
// app/Actions/Password/PasswordResetAction.ts
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { hash } from '@stacksjs/auth'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'PasswordResetAction',
  description: 'Reset user password',
  method: 'POST',

  validations: {
    token: {
      rule: schema.string(),
      message: 'Reset token is required.',
    },
    password: {
      rule: schema.string().min(8),
      message: 'Password must be at least 8 characters.',
    },
    password_confirmation: {
      rule: schema.string(),
      message: 'Password confirmation is required.',
    },
  },

  async handle(request: RequestInstance) {
    const token = request.get('token')
    const password = request.get('password')
    const passwordConfirmation = request.get('password_confirmation')

    if (password !== passwordConfirmation) {
      return response.badRequest('Passwords do not match.')
    }

    // Verify token and get user
    const resetRecord = await PasswordReset.where('token', token)
      .where('expires_at', '>', new Date())
      .first()

    if (!resetRecord) {
      return response.badRequest('Invalid or expired reset token.')
    }

    const user = await User.find(resetRecord.user_id)

    if (!user) {
      return response.badRequest('User not found.')
    }

    // Update password
    await user.update({
      password: await hash(password),
    })

    // Delete used token
    await resetRecord.delete()

    return response.json({
      message: 'Password reset successfully.',
    })
  },
})
```

## Next Steps

- [Build an API](/bootcamp/api) - Create API endpoints
- [Testing How-To](/bootcamp/how-to/testing) - Test your authentication
- [Deployment How-To](/bootcamp/how-to/deploy) - Deploy with authentication

## Related Documentation

- [Authentication Guide](/guide/auth)
- [Auth Package](/packages/auth)
- [Middleware Guide](/basics/middleware)
