import { fileURLToPath } from 'node:url'

export const distDir: string = fileURLToPath(new URL('../dist', import.meta.url))
