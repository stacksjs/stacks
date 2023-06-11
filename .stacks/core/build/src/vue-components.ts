import { defineConfig } from 'vite'
import type { ViteConfig } from '@stacksjs/types'
import { frameworkPath, libraryEntryPath, libsPath, projectPath } from '@stacksjs/path'
import type { ViteDevServer as DevServer, BuildOptions as ViteBuildOptions } from 'vite'
import { app, library } from '@stacksjs/config'
import { alias } from '@stacksjs/alias'
import mkcert from 'vite-plugin-mkcert'
import c from 'picocolors'
import { autoImports, components, cssEngine, inspect, uiEngine } from './stacks'

export const vueComponentsConfig: ViteConfig = {
  root: frameworkPath('libs/components/vue'),
  envDir: projectPath(),
  envPrefix: 'FRONTEND_',

  server: {
    https: true,
    port: 3333,
    open: true,
  },

  resolve: {
    dedupe: ['vue'],
    alias,
  },

  optimizeDeps: {
    exclude: ['vue', 'fsevents'],
  },

  plugins: [
    // preview(),
    uiEngine(),
    cssEngine(),
    autoImports(),
    components(),
    inspect(),
    mkcert({
      autoUpgrade: true,
      savePath: libsPath('components/certs'),
      keyFileName: library.name ? `${library.name}-key.pem` : 'library-key.pem',
      certFileName: library.name ? `${library.name}-cert.pem` : 'library-cert.pem',
    }),
    {
      // ...
      configureServer(server: DevServer) {
        // const base = server.config.base || '/'
        // const _print = server.printUrls

        // Example: wait for a client to connect before sending a message
        server.printUrls = () => {
          // const url = server.resolvedUrls?.local[0]
          //
          // if (url) {
          //   try {
          //     const u = new URL(url)
          //     // eslint-disable-next-line no-console
          //     console.log(`${u.protocol}//${u.host}`)
          //     // const host = `${u.protocol}//${u.host}`
          //   }
          //   catch (error) {
          //     log.warn('Parse resolved url failed:', error)
          //   }
          // }

          const appUrl = app.url
          const frontendUrl = appUrl
          const backendUrl = `api.${appUrl}/`
          const libraryUrl = `library.${appUrl}/`
          const docsUrl = `docs.${appUrl}/`
          const inspectUrl = `${appUrl}/__inspect/`

          // eslint-disable-next-line no-console
          console.log(`  ${c.green('➜')}  ${c.bold('Frontend')}: ${c.green(frontendUrl)}`)
          // eslint-disable-next-line no-console
          console.log(`  ${c.green('➜')}  ${c.bold('Backend')}: ${c.green(backendUrl)}`)
          // eslint-disable-next-line no-console
          console.log(`  ${c.green('➜')}  ${c.bold('Library')}: ${c.green(libraryUrl)}`)
          // eslint-disable-next-line no-console
          console.log(`  ${c.green('➜')}  ${c.bold('Docs')}: ${c.green(docsUrl)}`)
          // eslint-disable-next-line no-console
          console.log(`  ${c.green('➜')}  ${c.bold('Inspect')}: ${c.green(inspectUrl)}`)

          // if (_open && !isCI) {
          //   // a delay is added to ensure the app page is opened first
          //   setTimeout(() => {
          //     openBrowser(`${host}${base}__inspect/`)
          //   }, 500)
          // }
        }

        // return rpcFunctions
      },
    },
  ],

  build: vueComponentsBuildOptions(),
}

export function vueComponentsBuildOptions(): ViteBuildOptions {
  return {
    outDir: libsPath('components/vue/dist'),
    emptyOutDir: true,
    lib: {
      entry: libraryEntryPath('vue-components'),
      name: library.vueComponents?.name,
      formats: ['cjs', 'es'],
      fileName: (format: string) => {
        if (format === 'es')
          return 'index.mjs'

        if (format === 'cjs')
          return 'index.cjs'

        return 'index.?.js'
      },
    },

    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue',
        },
      },
    },
  }
}

export default defineConfig(({ command }) => {
  if (command === 'serve')
    return vueComponentsConfig

  return vueComponentsConfig
})
