export interface ConfigureOptions {
  aws: boolean
  profile: string
  verbose: boolean
}

export type ConfigureConfig = Partial<ConfigureOptions>
