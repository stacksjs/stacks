import { setupLayouts } from 'virtual:generated-layouts'
import '@unocss/reset/tailwind.css'
import 'unocss'
import { ViteSSG } from 'vite-ssg'
import { routes } from 'vue-router/auto-routes'
import '../../../../../resources/assets/styles/main.css'
import App from './App.vue'
import type { UserModule } from './types'

const apiRoutes = ['/api', '/docs']

// Function to check if a route is an API route
const isApiRoute = (path: string) => apiRoutes.some((route) => path.startsWith(route))

export const createApp = ViteSSG(
  App,
  {
    routes: setupLayouts(routes),
    base: import.meta.env.BASE_URL,
  },
  (ctx) => {
    // install all modules under `modules/`
    ;(async () => {
      const modules = import.meta.glob<{ install: UserModule }>('../../../../../resources/modules/*.ts')
      const promises = Object.values(modules).map((func) => func())
      const modulesArray = await Promise.all(promises)
      for (const module of modulesArray) module.install?.(ctx)
    })()

    const { router, isClient } = ctx

    if (isClient) {
      console.log('Client-side code running - v1')

      // Handle API routes
      const handleApiRoute = (path: string) => {
        console.log('Handling API route:', path)
        window.location.replace(path)
      }

      // Check on initial load
      if (isApiRoute(window.location.pathname)) {
        console.log('Initial load is API route')
        handleApiRoute(window.location.pathname)
      }

      // Intercept link clicks
      document.addEventListener(
        'click',
        (event) => {
          const target = event.target as HTMLAnchorElement
          if (target.tagName === 'A' && isApiRoute(new URL(target.href).pathname)) {
            console.log('Clicked API route link:', target.href)
            event.preventDefault()
            handleApiRoute(target.href)
          }
        },
        true,
      )

      // Handle popstate events (browser back/forward)
      window.addEventListener('popstate', () => {
        if (isApiRoute(window.location.pathname)) {
          console.log('Popstate detected API route')
          handleApiRoute(window.location.pathname)
        }
      })
    }

    // Router guard for API routes
    router.beforeEach((to, from, next) => {
      console.log('Router guard triggered for:', to.fullPath)
      if (isApiRoute(to.fullPath)) {
        if (isClient) {
          console.log('Router guard redirecting to API route:', to.fullPath)
          window.location.replace(to.fullPath)
          return false
        }
        // For SSR, let the server handle it
        return next()
      }
      next()
    })
  },
)
