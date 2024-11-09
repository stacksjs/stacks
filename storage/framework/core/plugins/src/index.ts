import type { BunPlugin } from 'bun'
import type { Plugin as VitePlugin } from 'vite'
import { plugin } from 'bun'

export { plugin }
export type { BunPlugin, VitePlugin }

export function addStack(name: string): void {

  // Add a stack to the stack list
}
