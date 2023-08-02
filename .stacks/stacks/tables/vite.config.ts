import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import { type BuildOptions as ViteBuildOptions } from 'vite'
import mkcert from 'vite-plugin-mkcert'
import Components from 'unplugin-vue-components/vite'
import { type ViteConfig } from '../../core/types/src'
import { frameworkPath, libraryEntryPath, libsPath, projectPath, storagePath } from '../../core/path/src'
import { app, library } from '../../core/config/src'
import { alias } from '../../core/alias/src'
import { autoImports, cssEngine, uiEngine } from '../../core/vite/src'

export const vueComponentsConfig: ViteConfig = {
  envDir: projectPath(),
  envPrefix: 'FRONTEND_',
  publicDir: storagePath('public'),

  server: {
    https: true,
    host: app.url,
    open: true,
  },

  resolve: {
    dedupe: ['vue'],
    alias,
  },

  optimizeDeps: {
    exclude: ['stacks', 'vue', 'fsevents', 'emitter', '@stacksjs/utils', '@stacksjs/validation', '@stacksjs/vite', '@stacksjs/server', '@stacksjs/config', 'stacks/utils', 'stacks/validation'],
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
      external: ['vue', '@stacksjs/vite'],
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
