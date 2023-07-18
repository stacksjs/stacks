import { defineConfig, loadEnv } from 'vite'
import type { ViteConfig } from '@stacksjs/types'
import { frameworkPath, libraryEntryPath, libsPath, projectPath, storagePath } from '@stacksjs/path'
import type { BuildOptions as ViteBuildOptions } from 'vite'
import { app, library } from '@stacksjs/config'
import { alias } from '@stacksjs/alias'
import mkcert from 'vite-plugin-mkcert'
import Components from 'unplugin-vue-components/vite'
import { autoImports, cssEngine, uiEngine } from '@stacksjs/vite'

export const vueComponentsConfig: ViteConfig = {
  envDir: projectPath(),
  envPrefix: 'FRONTEND_',
  publicDir: storagePath('public'),

  server: {
    https: true,
    host: app.url,
    port: app.port,
    open: true,
  },

  resolve: {
    dedupe: ['vue'],
    alias,
  },

  optimizeDeps: {
    exclude: ['stacks', 'stacks/validation', 'stacks/utils', 'vue', 'fsevents', 'emitter', 'browser-sync', '@stacksjs/utils', '@stacksjs/validation'],
  },

  plugins: [
    // preview(),
    uiEngine(),
    cssEngine(),
    autoImports(),
    Components({
      // allow auto load markdown components under `./src/components/`
      extensions: ['vue', 'md'],
      // allow auto import and register components used in markdown
      include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
      dts: 'src/components.d.ts',
    }),
    mkcert({
      hosts: ['localhost', 'stacks.test', 'api.stacks.test', 'admin.stacks.test', 'libs.stacks.test', 'docs.stacks.test'],
      autoUpgrade: true,
      savePath: frameworkPath('certs/components'),
      keyFileName: library.name ? `library-${library.name}-key.pem` : 'library-key.pem',
      certFileName: library.name ? `library-${library.name}-cert.pem` : 'library-cert.pem',
    }),
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
