export type WorkflowStep = 'prepare' | 'lint' | 'typecheck' | 'test' | 'build' | 'deploy' | 'after-deploy' | 'native-build' | 'native-accept' | 'native-sign' | 'native-upload' | 'native-verify' | 'native-cleanup'

/** Application commands are argv arrays, never shell interpolation. */
export interface WorkflowConfig {
  provider: 'reviewos'
  origin: string
  repository: string
  branch?: string
  bun?: string
  pantry?: string
  runners: { checks: string[], deploy?: string[], ios?: string[] }
  secrets?: { checks?: string[], deploy?: string[], ios?: string[] }
  env?: { checks?: Record<string, string>, deploy?: Record<string, string>, ios?: Record<string, string> }
  commands?: Partial<Record<WorkflowStep, string[][]>>
  deploy?: boolean
  native?: {
    /** Simulator archive and source receipt uploaded before acceptance. */
    artifacts: string[]
    downloadDirectory: string
    archivePattern: string
    evidence?: string[]
    releaseArtifacts?: string[]
  }
  release?: {
    /** Tracked JSON holding the application version and monotonic build number. */
    versionFile: string
    versionField?: string
    buildField?: string
    /** Keep the application package version aligned with its native identity. */
    packageVersion?: 'build' | 'version' | false
    notesDirectory?: string
    locales?: string[]
  }
}
