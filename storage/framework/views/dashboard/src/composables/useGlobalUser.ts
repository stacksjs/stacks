import { inject, type Ref } from 'vue'

export function useGlobalUser() {
  const user = inject<Ref<any>>('user')
  const isAuthenticated = inject<Ref<boolean>>('isAuthenticated')

  if (!user || !isAuthenticated) {
    throw new Error('useGlobalUser must be used within an app that has the user plugin installed')
  }

  return {
    user,
    isAuthenticated,
  }
} 