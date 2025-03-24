import type { ViteConfig } from '@stacksjs/types'
import conf from './views'
import {config} from "@stacksjs/config";
import {path as p} from "@stacksjs/path";

export const desktopConfig: ViteConfig = {
  ...conf,
  root: p.frameworkPath('views/desktop'),

  // configs inspired on https://v2.tauri.app/start/frontend/vite/
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  server: {
    ...conf.server,
    ...{
      port: config.ports.desktop,
      strictPort: true,
      host: conf.server?.host || false,
      hmr: conf.server?.host ? {
        protocol: 'ws',
        host: `${conf.server?.host}`,
        port: 1421
      } : undefined,
      watch: {
        // tell vite to ignore watching `src-tauri`
        ignored: ['**/src-tauri/**'],
      },
    }
  },
  build: {
    ...conf.build,
    ...{
      target: process.env['TAURI_ENV_PLATFORM'] == 'windows' ? 'chrome105' : 'safari13',
      minify: !process.env['TAURI_ENV_DEBUG'] ? 'esbuild' : false,
      sourcemap: !!process.env['TAURI_ENV_DEBUG'],
    }
  }
}


export default desktopConfig
