/** Guard an artifact write immediately before it is installed, then record the result. */
export interface GenerationFileGuard {
  beforeWrite: (file: string) => void
  afterWrite: (file: string) => void
}
