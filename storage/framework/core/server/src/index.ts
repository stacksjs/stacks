import type { AutoImportsOptions } from 'bun-plugin-auto-imports'
import { plugin } from 'bun'
import { autoImports } from 'bun-plugin-auto-imports'

export { config as server } from './config'

const options: AutoImportsOptions = {
  presets: ['solid-js'], // any unimport presets are valid
  imports: [{ name: 'z', from: 'zod' }],
  dts: `./src/auto-import.d.ts`, // default is `./auto-import.d.ts`
}

plugin(autoImports(options))
