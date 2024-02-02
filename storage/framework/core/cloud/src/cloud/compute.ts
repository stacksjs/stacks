/* eslint-disable no-new */
import type { aws_certificatemanager as acm, aws_efs as efs, aws_lambda as lambda, aws_route53 as route53 } from 'aws-cdk-lib'
import { Duration, CfnOutput as Output, aws_ec2 as ec2, aws_ecs as ecs, aws_ecs_patterns as ecs_patterns, aws_secretsmanager as secretsmanager } from 'aws-cdk-lib'
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

    const cluster = new ecs.Cluster(scope, 'StacksCluster', {
      clusterName: `${props.slug}-${props.appEnv}-web-server-cluster`,
      vpc,
    })

    const taskDefinition = new ecs.FargateTaskDefinition(scope, 'TaskDef', {
      memoryLimitMiB: 512, // Match your Lambda memory size
      cpu: 256, // Choose an appropriate value
    })

    const container = taskDefinition.addContainer('WebServerContainer', {
      image: ecs.ContainerImage.fromAsset(p.frameworkPath('server')),
      portMappings: [{ containerPort: 80 }],
    })

    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(scope, 'FargateService', {
      serviceName: `${props.slug}-${props.appEnv}-fargate-service`,
      cluster,
      taskDefinition,
      desiredCount: 1, // Start with 1 task instance
      // Other configurations like public load balancer, domain name, etc.
      publicLoadBalancer: true,
      taskSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PUBLIC, onePerAz: true }),
      assignPublicIp: true,
      listenerPort: 80,
    })

    fargateService.targetGroup.configureHealthCheck({
      path: '/health',
      interval: Duration.seconds(60),
    })

    // ec2.Peer.securityGroupId('YOUR_SECURITY_GROUP_ID'
    props.fileSystem.connections.allowFromAnyIpv4(ec2.Port.tcp(2049))

    const volumeName = `${props.slug}-${props.appEnv}-efs`
    taskDefinition.addVolume({
      name: volumeName,
      efsVolumeConfiguration: {
        fileSystemId: props.fileSystem.fileSystemId,
      },
    })

    container.addMountPoints({
      sourceVolume: volumeName,
      containerPath: '/mnt/efs',
      readOnly: false,
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

    secrets.grantRead(fargateService.taskDefinition.executionRole!)
    container.addEnvironment('SECRETS_ARN', secrets.secretArn)

    const apiPrefix = 'api'
    new Output(scope, 'ApiUrl', {
      value: `https://${props.domain}/${apiPrefix}`,
      description: 'The URL of the deployed application',
    })

    new Output(scope, 'ApiVanityUrl', {
      value: '',
      description: 'The Vanity URL of the deployed application',
    })
  }
}
