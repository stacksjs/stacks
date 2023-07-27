/**
 * The Binary/CLI Options used in `./config/binary.ts`.
 */
export interface BinaryOptions {
  name?: string
  command?: string
  description?: string
  // path?: string // TODO: add this for a configurable path where the commands are located
}

export type BinaryConfig = BinaryOptions
