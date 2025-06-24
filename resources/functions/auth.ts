import { computed } from 'vue'
import { useStorage } from '@vueuse/core'

const TOKEN_KEY = 'auth_token'

export function useAuth() {
  // Reactive token from localStorage
  const token = useStorage<string | null>(TOKEN_KEY, null)

  // Computed authentication state
  const isAuthenticated = computed(() => !!token.value)

  // Login: set token
  function login(newToken: string) {
    token.value = newToken
  }

  // Logout: clear token
  function logout() {
    token.value = null
  }

  // Get token (for API calls, etc.)
  function getToken() {
    return token.value
  }

  return {
    isAuthenticated,
    login,
    logout,
    getToken,
    token, // expose for advanced use
  }
}

// Strict auth guard middleware
// Usage: call in setup() of page/component, or in router beforeEach
export function authGuard({ redirect }: { redirect?: (to: string) => void } = {}) {
  const { isAuthenticated } = useAuth()

  // If not authenticated, block immediately
  if (!isAuthenticated.value) {
    if (redirect) {
      redirect('/auth/login')
    } else {
      // Throw to block setup/render
      throw new Error('Not authenticated')
    }
  }
}
