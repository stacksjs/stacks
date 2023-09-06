import { createHead } from 'unhead'

import { ViteSSG } from 'vite-ssg'
import { setupLayouts } from 'virtual:generated-layouts'

import type { UserModule } from '@stacksjs/types'

import App from './App.vue'
import '@unocss/reset/tailwind.css'
import 'highlight.js/styles/atom-one-light.css'
import generatedRoutes from '~pages'

import 'uno.css'

const routes = setupLayouts(generatedRoutes)

createHead()

ViteSSG(
  App,
  {
    routes,
    base: import.meta.env.APP_URL,
  },
  (ctx) => {
    Object.values(import.meta.glob<{ install: UserModule }>('../../../.stacks/core/modules/*.ts', { eager: true }))
      .forEach(i => i.install?.(ctx))
  },
)
