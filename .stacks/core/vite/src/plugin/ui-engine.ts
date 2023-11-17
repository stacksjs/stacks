import Vue from '@vitejs/plugin-vue'
import type { Plugin } from 'vite'

export function uiEngine(isWebComponent = false): Plugin {
  const include = [/\.vue$/, /\.md$/]

  if (isWebComponent) {
    return Vue({
      include,
      template: {
        compilerOptions: {
          isCustomElement: () => true,
        },
      },
    })
  }

  return Vue({
    include,
  })
}
