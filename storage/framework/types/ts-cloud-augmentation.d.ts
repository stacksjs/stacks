import '@stacksjs/ts-cloud'

declare module '@stacksjs/ts-cloud' {
  interface EnvironmentConfig {
    deployBranch?: string
    domainPrefix?: string
  }
}
