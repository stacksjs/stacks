// This file is for testing
import type { UserConfig } from 'unocss'
import { defineConfig, presetUno } from 'unocss'

const config: UserConfig = defineConfig({
  presets: [
    presetUno(),
  ],
  blocklist: [
    'border',
    ['bg-red-500', { message: 'Use bg-red-600 instead' }],
    [i => i.startsWith('text-'), { message: 'Use color-* instead' }],
    [i => i.endsWith('-auto'), { message: s => `Use ${s.replace(/-auto$/, '-a')} instead` }],
  ],
})

export default config
