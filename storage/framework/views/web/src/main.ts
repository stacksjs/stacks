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

// Function to handle API route navigation
const handleApiNavigation = (path: string) => {
  if (typeof window !== 'undefined') {
    window.location.replace(path)
  }
}

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
      console.log('here11')

      // Handle initial load and manual URL changes
      const handleRouteChange = () => {
        if (isApiRoute(window.location.pathname)) {
          console.log('here2')
          handleApiNavigation(window.location.pathname)
        }
      }

      // Check on initial load
      handleRouteChange()

      // Listen for popstate events (manual URL changes)
      window.addEventListener('popstate', handleRouteChange)

      // Modify how links are handled (only in the browser)
      document.addEventListener(
        'click',
        (event) => {
          console.log('here3')
          const target = event.target as HTMLAnchorElement
          if (target.tagName === 'A' && isApiRoute(target.pathname)) {
            event.preventDefault()
            handleApiNavigation(target.href)
          }
        },
        true,
      )
    }

    // Catch any navigation to API routes
    router.beforeEach((to, from, next) => {
      console.log('here4')
      if (isApiRoute(to.fullPath)) {
        console.log('here5')
        if (isClient) {
          console.log('here6')
          handleApiNavigation(to.fullPath)
          return false
        }
        // For SSR, we'll let the server handle these routes
        console.log('here7')
        return next()
      }
      console.log('here8')
      next()
    })
  },
)
