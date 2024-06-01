export interface ConfigureOptions {
  aws: boolean
  profile: string
  project: boolean
  verbose: boolean
  accessKeyId: string
  secretAccessKey: string
  region: string
  output: string
  quiet: boolean
}

export type ConfigureConfig = Partial<ConfigureOptions>
