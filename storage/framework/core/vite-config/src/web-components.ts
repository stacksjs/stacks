import type { UserConfig as ViteConfig } from 'vite'
import type { ViteBuildOptions } from '.'
import { alias } from '@stacksjs/alias'
import { config as c } from '@stacksjs/config'
import { libraryEntryPath, libsPath, projectPath, publicPath, resourcesPath } from '@stacksjs/path'
import { server } from '@stacksjs/server'
import { autoImports, components, cssEngine, devtools, inspect, uiEngine } from '@stacksjs/vite-plugin'

export const webComponentsConfig: ViteConfig = {
  root: libsPath('components/web'),
  envDir: projectPath(),
  envPrefix: 'FRONTEND_',
  publicDir: publicPath(),
  base: '/libs/',

  assetsInclude: [publicPath('**/*'), resourcesPath('assets/*'), resourcesPath('assets/**/*')],

  server: server({
    type: 'library',
  }),

  resolve: {
    dedupe: ['vue'],
    alias,
  },

  optimizeDeps: {
    exclude: ['vue'],
  },

  plugins: [
    uiEngine(true),
    autoImports(),
    cssEngine(),
    inspect(),
    components(),
    devtools(),
    // stacks(),
  ],

  build: webComponentsBuildOptions(),
} satisfies ViteConfig

export function webComponentsBuildOptions(): ViteBuildOptions {
  return {
    outDir: libsPath('components/web/dist'),
    emptyOutDir: true,
    lib: {
      entry: libraryEntryPath('web-components'),
      name: c.library.webComponents?.name,
      formats: ['es'],
      fileName: (format: string) => {
        if (format === 'es')
          return 'index.js'

        return 'index.?.js'
      },
    },

    // rollupOptions: {
    //   external: ['vue', '@stacksjs/path'],
    //   input: libraryEntryPath('web-components'),
    //   output: {
    //     globals: {
    //       vue: 'Vue',
    //     },
    //   },
    // },
  }
}

export default webComponentsConfig
