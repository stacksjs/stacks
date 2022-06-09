export interface UserOptions {
    /**
      * File paths will be resolved against this directory.
      *
      * @default process.cwd
      */
    root?: string

    /**
      * File paths will be resolved against this directory.
      *
      * @default false
      */
    customElement?: boolean
}
