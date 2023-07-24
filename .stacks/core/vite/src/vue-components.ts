import { app } from '@stacksjs/config'
import type { ViteConfig } from '@stacksjs/types'
import { frameworkPath, libraryEntryPath, libsPath, projectPath, storagePath } from '@stacksjs/path'
import { alias } from '@stacksjs/alias'
import * as c from 'kolorist'
import type { ViteDevServer as DevServer } from 'vite'
import { autoImports, components, cssEngine, inspect, sslCertificate, uiEngine } from './stacks'
import type { ViteBuildOptions } from './'
import { defineConfig } from './'

// import { version } from '../package.json'
const version = '0.0.0'

export const vueComponentsConfig: ViteConfig = {
  root: frameworkPath('libs/components/vue'),
  envDir: projectPath(),
  envPrefix: 'FRONTEND_',
  publicDir: storagePath('public'),
  // define: {
  //   Bun,
  // },

  server: {
    https: true,
    // host: 'stacks.test',
    // host: app.url || 'stacks.test',
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
    sslCertificate(),

    // @ts-expect-error TODO: fix this
    {
      // BuildStart hook before the build starts
      buildStart(options) {
        console.log('BuildStart hook with options:', options)
      },

      // Load hook for loading individual files
      async load(id) {
        console.log('Load hook for:', id)
        return null // Return null to let Vite handle the file loading
      },

      async resolveId(source, importer) {
        console.log('ResolveId hook for source:', source, 'importer:', importer)
        return null // Return null to let Vite handle the module resolution
      },

      // Transform hook for transforming individual files
      async transform(code, id) {
        console.log('Transform hook for:', id)
        return code // Return the unmodified code
      },

      configureServer(server: DevServer) {
        // const base = server.config.base || '/'
        // const _print = server.printUrls
        server.printUrls = () => {
          console.log('here in server.printUrls')

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
      // name: library.vueComponents?.name,
      name: 'test-lib-abc',
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
      external: ['vue', '@stacksjs/path'],
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
