import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

/**
 * Reactive Permissions API.
 *
 * @param permissionName - Name of the permission to query
 */
export function usePermission(
  permissionName: PermissionName,
): { state: Ref<PermissionState>, isSupported: Ref<boolean> } {
  const isSupported = ref(typeof navigator !== 'undefined' && 'permissions' in navigator)
  const state = ref<PermissionState>('prompt') as Ref<PermissionState>

  if (!isSupported.value)
    return { state, isSupported }

  let permissionStatus: PermissionStatus | null = null

  navigator.permissions.query({ name: permissionName }).then((status) => {
    permissionStatus = status
    state.value = status.state

    const handler = (): void => {
      state.value = status.state
    }

    status.addEventListener('change', handler)

    try {
      onUnmounted(() => {
        status.removeEventListener('change', handler)
      })
    }
    catch {
      // Not in a component context
    }
  }).catch(() => {
    // Permission query may fail
  })

  return { state, isSupported }
}
