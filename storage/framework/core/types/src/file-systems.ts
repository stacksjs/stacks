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
  /** The one field every package.json has, and the one `buddy doctor` reads. */
  name?: string
  description?: string
  engines?: {
    node?: string
    pnpm?: string
  }
  version?: string
  packageManager?: string
  /** A manifest carries plenty this does not name. */
  [key: string]: unknown
}

export interface FileSystemOptions {
  default: string
  disks: {
    local: {
      driver: 'local'
      root: string
    }

    public: {
      driver: 'public'
      root: string
      visibility?: 'public'
    }

    private: {
      driver: 'private'
      root: string
      visibility?: 'private'
    }

    efs: {
      driver: 'local'
      root: string
    }

    s3: {
      driver: 's3'
      root: string
    }

    [key: string]: {
      driver: string
      root: string
      visibility?: 'public' | 'private'
    }
  }
}

export type FileSystemConfig = Partial<FileSystemOptions>
