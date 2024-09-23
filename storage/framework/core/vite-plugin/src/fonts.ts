import type { Plugin } from 'vite'
import WebfontDownload from 'vite-plugin-webfont-dl'

// https://github.com/feat-agency/vite-plugin-webfont-dl
export function fonts(): Plugin {
  return WebfontDownload()
}
