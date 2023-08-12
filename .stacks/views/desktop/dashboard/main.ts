/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { ViteSSG } from 'vite-ssg'
import { routes } from 'vue-router/auto/routes'
import { setupLayouts } from 'virtual:generated-layouts'
import VueHighlightJS from 'vue3-highlightjs'
import App from './App.vue'
import '@unocss/reset/tailwind.css'
import 'highlight.js/styles/atom-one-light.css'
import '../../../stacks/dashboard/src/styles/main.css'

// prepare the messages object from the yaml language files
// const messages = Object.fromEntries(
//   Object.entries(
//     import.meta.glob<{ default: any }>('~/lang/*.y(a)?ml', { eager: true }))
//     .map(([key, value]) => {
//       const yaml = key.endsWith('.yaml')
//       return [key.slice(14, yaml ? -5 : -4), value.default]
//     }),
// )

export const createApp = ViteSSG(
  App,
  {
    routes: setupLayouts(routes),
    base: import.meta.env.BASE_URL,
  },
  (ctx) => {
    ctx.app.use(VueHighlightJS)
  },
)
