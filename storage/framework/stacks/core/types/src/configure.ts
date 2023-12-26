export interface ConfigureOptions {
  aws: boolean
  verbose: boolean
}

export type ConfigureConfig = Partial<ConfigureOptions>
