/**
 * The Binary/CLI Options used in `./config/cli.ts`.
 */
export interface BinaryOptions {
  name: string
  command: string
  description: string
  source: string
  deploy: boolean
  // path: string // TODO: add this for a configurable path where the commands are located
}

export type BinaryConfig = Partial<BinaryOptions>
