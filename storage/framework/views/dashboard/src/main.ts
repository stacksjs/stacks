import { createPinia } from 'pinia'
import { setupLayouts } from 'virtual:generated-layouts'
import { ViteSSG } from 'vite-ssg'
import { routes } from 'vue-router/auto-routes'
import App from './App.vue'
import '@unocss/reset/tailwind.css'
import 'uno.css'
import './styles/main.css'

export const createApp = ViteSSG(
  App,
  {
    routes: setupLayouts(routes),
    base: import.meta.env.BASE_URL,
  },
  (ctx) => {
    // Install Pinia for state management
    const pinia = createPinia()
    ctx.app.use(pinia)

    ctx.router.beforeEach((to, from, next) => {
      const isLoggedIn = !!localStorage.getItem('token')

      if (to.meta.requiresAuth && !isLoggedIn) {
        next('/login')
      }
      else {
        next()
      }
    })

    // Install all modules under `modules/` if they exist
    Object.values(import.meta.glob<{ install: any }>('./modules/*.ts', { eager: true }))
      .forEach(i => i.install?.(ctx))
  },
)
