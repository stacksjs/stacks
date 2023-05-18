/**
 * Describes a plain-text file.
 */
export interface TextFile {
  path: string
  data: string
}

/**
 * Describes a JSON file.
 */
export interface JsonFile {
  path: string
  data: unknown
  indent: string
  newline: string | undefined
}

/**
 * Describes a package.json file.
 */
export interface PackageJson {
  packageManager: string
  // wip
}
