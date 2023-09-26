/**
 * The Binary/CLI Options used in `./config/cli.ts`.
 */
export interface CliOptions {
  name: string
  command: string
  description: string
  source: string
  // path: string // TODO: add this for a configurable path where the commands are located
}

export type CliConfig = Partial<CliOptions>
