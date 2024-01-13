/* eslint-disable no-new */
import type { aws_certificatemanager as acm, aws_ec2 as ec2, aws_efs as efs, aws_route53 as route53 } from 'aws-cdk-lib'
import { Duration, CfnOutput as Output, aws_lambda as lambda, aws_logs as logs, aws_secretsmanager as secretsmanager } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import { path as p } from '@stacksjs/path'
import { env } from '@stacksjs/env'
import type { NestedCloudProps } from '../types'
import type { EnvKey } from '../../../../env'

export interface ComputeStackProps extends NestedCloudProps {
  vpc: ec2.Vpc
  fileSystem: efs.FileSystem
  zone: route53.IHostedZone
  certificate: acm.Certificate
}

export class ComputeStack {
  apiServer: lambda.Function
  apiServerUrl: lambda.FunctionUrl

  constructor(scope: Construct, props: ComputeStackProps) {
    const vpc = props.vpc
    const fileSystem = props.fileSystem

    if (!fileSystem)
      throw new Error('The file system is missing. Please make sure it was created properly.')

    // const dockerImageAsset = new ecr_assets.DockerImageAsset(scope, 'ServerBuildImage', {
    //   directory: p.cloudPath('src/server'),
    // })

    this.apiServer = new lambda.Function(scope, 'WebServer', {
      description: 'The web server for the Stacks application',
      code: lambda.Code.fromAssetImage(p.cloudPath('src/server')),
      handler: lambda.Handler.FROM_IMAGE,
      runtime: lambda.Runtime.FROM_IMAGE,
      vpc,
      memorySize: 512, // replace with your actual memory size
      timeout: Duration.minutes(5), // replace with your actual timeout
      logRetention: logs.RetentionDays.ONE_WEEK,
      architecture: lambda.Architecture.ARM_64,
      // filesystem: lambda.FileSystem.fromEfsAccessPoint(props.accessPoint, '/mnt/efs'),
    })

    const keysToRemove = ['_HANDLER', '_X_AMZN_TRACE_ID', 'AWS_REGION', 'AWS_EXECUTION_ENV', 'AWS_LAMBDA_FUNCTION_NAME', 'AWS_LAMBDA_FUNCTION_MEMORY_SIZE', 'AWS_LAMBDA_FUNCTION_VERSION', 'AWS_LAMBDA_INITIALIZATION_TYPE', 'AWS_LAMBDA_LOG_GROUP_NAME', 'AWS_LAMBDA_LOG_STREAM_NAME', 'AWS_ACCESS_KEY', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_LAMBDA_RUNTIME_API', 'LAMBDA_TASK_ROOT', 'LAMBDA_RUNTIME_DIR', '_']
    keysToRemove.forEach(key => delete env[key as EnvKey])

    const secrets = new secretsmanager.Secret(scope, 'StacksSecrets', {
      secretName: `${props.slug}-${props.appEnv}-secrets`,
      description: 'Secrets for the Stacks application',
      generateSecretString: {
        secretStringTemplate: JSON.stringify(env),
        generateStringKey: Object.keys(env).join(',').length.toString(),
      },
    })

    secrets.grantRead(this.apiServer)
    this.apiServer.addEnvironment('SECRETS_ARN', secrets.secretArn)

    this.apiServerUrl = new lambda.FunctionUrl(scope, 'StacksServerUrl', {
      function: this.apiServer,
      authType: lambda.FunctionUrlAuthType.NONE, // becomes a public API
      cors: {
        allowedOrigins: ['*'],
      },
    })

    const apiPrefix = 'api'
    new Output(scope, 'ApiUrl', {
      value: `https://${props.domain}/${apiPrefix}`,
      description: 'The URL of the deployed application',
    })

    new Output(scope, 'ApiVanityUrl', {
      value: this.apiServerUrl.url,
      description: 'The Vanity URL of the deployed application',
    })
  }
}
