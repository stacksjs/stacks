import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
  ],

  externals: [
    '@aws-cdk/core',
    '@aws-cdk/aws-route53',
    '@stacksjs/config',
  ],

  clean: true,
  declaration: true,
})
