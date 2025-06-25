import type { Ref } from 'vue'
import type { UserData } from '../../../../defaults/types/dashboard'

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $user: Ref<UserData | null>
    $isAuthenticated: Ref<boolean>
  }
} 