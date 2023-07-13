import { defineConfig, loadEnv } from 'vite'
import type { ViteConfig } from '@stacksjs/types'
import { frameworkPath, libraryEntryPath, libsPath, projectPath, storagePath } from '@stacksjs/path'
import type { ViteDevServer as DevServer, BuildOptions as ViteBuildOptions } from 'vite'
import { app, library } from '@stacksjs/config'
import { alias } from '@stacksjs/alias'
import mkcert from 'vite-plugin-mkcert'
import c from 'picocolors'
import { version } from '../package.json'
import { autoImports, components, cssEngine, inspect, uiEngine } from './stacks'

export const vueComponentsConfig: ViteConfig = {
  root: frameworkPath('libs/components/vue'),
  base: frameworkPath(),
  envDir: projectPath(),
  envPrefix: 'FRONTEND_',
  publicDir: storagePath('public'),

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
    exclude: ['vue'],
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
      savePath: frameworkPath('certs/components'),
      keyFileName: library.name ? `library-${library.name}-key.pem` : 'library-key.pem',
      certFileName: library.name ? `library-${library.name}-cert.pem` : 'library-cert.pem',
    }),

    // @ts-expect-error TODO: fix this
    {
      // ...
      configureServer(server: DevServer) {
        // const base = server.config.base || '/'
        // const _print = server.printUrls
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
          const frontendUrl = `https://${appUrl}`
          const backendUrl = `https://api.${appUrl}`
          const dashboardUrl = `https://admin.${appUrl}`
          const libraryUrl = `https://libs.${appUrl}`
          const docsUrl = `https://docs.${appUrl}`
          const inspectUrl = `https://${appUrl}/__inspect/`

          // const pkg = await storage.readPackageJson(frameworkPath('./package.json')) // TODO: fix this async call placing `press h to show help` on top
          const stacksVersion = `alpha-${version}`

          // eslint-disable-next-line no-console
          console.log(`  ${c.blue(c.bold('STACKS'))} ${c.blue(stacksVersion)}`)
          // eslint-disable-next-line no-console
          console.log(`  ${c.green('➜')}  ${c.bold('Frontend')}: ${c.green(frontendUrl)}`)
          // eslint-disable-next-line no-console
          console.log(`  ${c.green('➜')}  ${c.bold('Backend')}: ${c.green(backendUrl)}`)
          // eslint-disable-next-line no-console
          console.log(`  ${c.green('➜')}  ${c.bold('Dashboard')}: ${c.green(dashboardUrl)}`)
          // eslint-disable-next-line no-console
          console.log(`  ${c.green('➜')}  ${c.bold('Library')}: ${c.green(libraryUrl)}`)
          // eslint-disable-next-line no-console
          console.log(`  ${c.green('➜')}  ${c.bold('Docs')}: ${c.green(docsUrl)}`)
          // eslint-disable-next-line no-console
          console.log(`  ${c.green('➜')}  ${c.dim('Inspect')}: ${c.green(inspectUrl)}`)
        }
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

export default defineConfig(({ command, mode }) => {
  process.env = { ...process.env, ...loadEnv(mode, projectPath(), '') }

  if (command === 'serve')
    return vueComponentsConfig

  return vueComponentsConfig
})
