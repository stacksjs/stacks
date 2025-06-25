import type { App } from 'vue'
import type { Router } from 'vue-router'

interface PluginContext {
  router: Router
  app: App
}

export function install(ctx: PluginContext) {
  // useAuth is auto-imported from defaults/functions
  const { user, isAuthenticated } = useAuth()

  // Make user available globally via $user - no imports needed!
  ctx.app.config.globalProperties.$user = user
  ctx.app.config.globalProperties.$isAuthenticated = isAuthenticated

  // Also provide it via provide/inject for Composition API (optional)
  ctx.app.provide('user', user)
  ctx.app.provide('isAuthenticated', isAuthenticated)
} 