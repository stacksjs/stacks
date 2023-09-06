/**
 * Plugin options.
 */
interface Options {
  /**
   * Relative path to the directory to search for page components.
   * @default 'src/layouts'
   */
  layoutsDirs: string | string[]
  /**
   * Valid file extensions for page components.
   * @default ['vue']
   */
  extensions: string[]
  /**
   * List of path globs to exclude when resolving pages.
   */
  exclude: string[]
  /**
   * Filename of default layout (".vue" is not needed)
   * @default 'default'
   */
  defaultLayout: string
  /**
   * Mode for importing layouts
   */
  importMode: (name: string) => 'sync' | 'async'
}

export type FileContainer = {
  path: string
  files: string[]
}
export type UserOptions = Partial<Options>

export interface ResolvedOptions extends Options {}

export interface clientSideOptions {
  /**
   * layouts dir
   * @default "src/layouts"
   */
  layoutDir?: string
  /**
   * default layout
   * @default "default"
   */
  defaultLayout?: string
  /**
   * default auto resolve
   */
  importMode: 'sync' | 'async'
}
