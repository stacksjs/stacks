import { alias, defineBuildConfig, entries } from '@stacksjs/development'

export default defineBuildConfig({
  alias,
  entries,

  externals: [
    '@aws-cdk/core',
    '@aws-cdk/aws-route53',
    '@stacksjs/config',
  ],

  clean: false,
  declaration: true,
})
