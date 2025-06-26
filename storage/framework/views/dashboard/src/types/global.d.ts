import type { UserData } from '../../../../defaults/types/dashboard'

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $user: UserData | null
    $isAuthenticated: boolean
  }
}
