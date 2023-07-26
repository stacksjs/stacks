import Vue from '@vitejs/plugin-vue'
import type { Plugin } from 'vite'

export function uiEngine(isWebComponent = false): Plugin {
  console.log('running uiEngine')

  if (isWebComponent) {
    return Vue({
      include: [/\.vue$/, /\.md$/],
      template: {
        compilerOptions: {
          isCustomElement: () => true,
        },
      },
    }) as Plugin
  }

  return Vue({
    include: [/\.vue$/, /\.md$/],
  }) as Plugin
}
