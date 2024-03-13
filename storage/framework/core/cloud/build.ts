import { intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  target: 'bun',

  external: [
    '@aws-sdk/client-cloudformation',
    '@aws-sdk/client-cloudwatch-logs',
    '@aws-sdk/client-ec2',
    '@aws-sdk/client-efs',
    '@aws-sdk/client-iam',
    '@aws-sdk/client-ssm',
    '@aws-sdk/lambda',
    '@aws-sdk/client-route-53-domains',
    '@aws-sdk/client-s3',
    '@stacksjs/cli',
    '@stacksjs/config',
    '@stacksjs/error-handling',
    '@stacksjs/logging',
    '@stacksjs/path',
    '@stacksjs/utils',
    '@stacksjs/strings',
    '@stacksjs/storage',
    'aws-cdk-lib',
    'constructs',
    '@stacksjs/env',
    '@smithy/types',
    '@smithy/protocol-http',
    '@aws-sdk/middleware-logger',
    '@aws-sdk/middleware-recursion-detection',
    '@aws-sdk/middleware-host-header',
    '@smithy/property-provider',
    '@aws-crypto/crc32',
    '@smithy/util-hex-encoding',
    '@smithy/smithy-client',
    '@smithy/signature-v4',
    '@smithy/util-endpoints',
    '@aws-sdk/util-endpoints',
    '@smithy/util-middleware',
    '@aws-sdk/middleware-user-agent',
    '@smithy/util-config-provider',
    '@smithy/config-resolver',
    '@smithy/middleware-content-length',
    '@smithy/middleware-endpoint',
    '@smithy/util-retry',
    '@smithy/service-error-classification',
    '@smithy/middleware-retry',
    '@smithy/core',
    '@aws-sdk/core',
    '@smithy/middleware-serde',
    'fast-xml-parser',
    '@smithy/shared-ini-file-loader',
    '@smithy/credential-provider-imds',
    '@aws-sdk/credential-provider-env',
    '@aws-sdk/client-sso',
    '@aws-sdk/credential-provider-sso',
    '@aws-sdk/credential-provider-ini',
    '@aws-sdk/credential-provider-process',
    '@aws-sdk/credential-provider-web-identity',
    'universalify',
    'graceful-fs',
    'fs-extra',
    'fast-glob',
    'kleur',
    '@stacksjs/cli',
    '@aws-sdk/middleware-signing',
    '@smithy/eventstream-serde-config-resolver',
    '@aws-sdk/client-lambda',
  ],

})

// Building the edge/origin-request separately
const res = await Bun.build({
  entrypoints: ['./src/edge/origin-request.ts'],
  outdir: './dist',
  // Specify any additional options if needed
})

if (!res.success)
  throw new Error('Failed to build edge/origin-request')

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
