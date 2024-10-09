import type { aws_certificatemanager as acm, aws_efs as efs } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { EnvKey } from '../../../../env'
import type { NestedCloudProps } from '../types'
import { env } from '@stacksjs/env'
import { path as p } from '@stacksjs/path'
import {
  Duration,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  CfnOutput as Output,
  RemovalPolicy,
  aws_route53 as route53,
  aws_route53_targets as route53Targets,
  aws_secretsmanager as secretsmanager,
} from 'aws-cdk-lib'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import { LogGroup } from 'aws-cdk-lib/aws-logs'

export interface ComputeStackProps extends NestedCloudProps {
  vpc: ec2.Vpc
  fileSystem: efs.FileSystem
  zone: route53.IHostedZone
  certificate: acm.Certificate
}

export class ComputeStack {
  lb: elbv2.ApplicationLoadBalancer
  cluster: ecs.Cluster
  taskDefinition: ecs.FargateTaskDefinition

  constructor(scope: Construct, props: ComputeStackProps) {
    const vpc = props.vpc
    const fileSystem = props.fileSystem

    if (!fileSystem)
      throw new Error('The file system is missing. Please make sure it was created properly.')

    this.cluster = new ecs.Cluster(scope, 'StacksCluster', {
      clusterName: `${props.slug}-${props.appEnv}-web-server-cluster`,
      vpc,
    })

    this.taskDefinition = new ecs.FargateTaskDefinition(scope, 'TaskDefinition', {
      family: `${props.appName}-${props.appEnv}-api`,
      memoryLimitMiB: 512, // Match your Lambda memory size
      cpu: 256, // Choose an appropriate value
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
      },
    })

    // const assetImage = new ecr_assets.DockerImageAsset(scope, 'DockerImageAsset', {
    //   directory: p.frameworkCloudPath(),
    // })

    const container = this.taskDefinition.addContainer('WebServerContainer', {
      containerName: `${props.appName}-${props.appEnv}-api`,
      // image: ecs.ContainerImage.fromDockerImageAsset(assetImage),
      image: ecs.ContainerImage.fromAsset(p.frameworkPath('server')),
      logging: new ecs.AwsLogDriver({
        streamPrefix: `${props.appName}-${props.appEnv}-web-server-logs`,
        logGroup: new LogGroup(scope, 'StacksApiLogs', {
          logGroupName: '/aws/ecs/stacks-api',
          removalPolicy: RemovalPolicy.DESTROY, // Automatically remove logs on stack deletion
        }),
      }),
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:3000/health || exit 1'], // requires curl inside the container which isn't available in the base image. I wonder if there is a better way
        interval: Duration.seconds(10),
        timeout: Duration.seconds(5),
        retries: 3,
        startPeriod: Duration.seconds(10),
      },
    })

    container.addPortMappings({
      containerPort: 3000,
      hostPort: 3000,
    })

    const serviceSecurityGroup = new ec2.SecurityGroup(scope, 'ServiceSecurityGroup', {
      securityGroupName: `${props.appName}-${props.appEnv}-api-service-sg`,
      vpc,
      description: 'Stacks Security Group for API Service',
    })

    const publicLoadBalancerSG = new ec2.SecurityGroup(scope, 'PublicLoadBalancerSG', {
      securityGroupName: `${props.appName}-${props.appEnv}-public-load-balancer-sg`,
      vpc,
      description: 'Access to the public facing load balancer',
    })

    // Assuming serviceSecurityGroup and publicLoadBalancerSG are already defined
    serviceSecurityGroup.addIngressRule(publicLoadBalancerSG, ec2.Port.allTraffic(), 'Ingress from the public ALB')

    this.lb = new elbv2.ApplicationLoadBalancer(scope, 'ApplicationLoadBalancer', {
      http2Enabled: true,
      loadBalancerName: `${props.appName}-${props.appEnv}-alb`,
      vpc,
      vpcSubnets: {
        subnets: vpc.selectSubnets({
          subnetType: ec2.SubnetType.PUBLIC,
          onePerAz: true,
        }).subnets,
      },
      internetFacing: true,
      idleTimeout: Duration.seconds(30),
      securityGroup: publicLoadBalancerSG,
    })

    new route53.ARecord(scope, 'ApiDomainAliasRecord', {
      zone: props.zone,
      recordName: 'api',
      target: route53.RecordTarget.fromAlias(new route53Targets.LoadBalancerTarget(this.lb)),
    })

    const serviceTargetGroup = new elbv2.ApplicationTargetGroup(scope, 'ServiceTargetGroup', {
      targetGroupName: `${props.appName}-${props.appEnv}-api-tg`,
      vpc,
      targetType: elbv2.TargetType.IP,
      protocol: elbv2.ApplicationProtocol.HTTP,
      port: 3000,
      healthCheck: {
        interval: Duration.seconds(6),
        path: '/health',
        protocol: elbv2.Protocol.HTTP,
        timeout: Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 10,
      },
    })

    const service = new ecs.FargateService(scope, 'StacksApiService', {
      serviceName: `${props.appName}-${props.appEnv}-api-service`,
      cluster: this.cluster,
      taskDefinition: this.taskDefinition,
      desiredCount: 1,
      assignPublicIp: true,
      maxHealthyPercent: 200,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PUBLIC,
        onePerAz: true,
      }),
      minHealthyPercent: 75,
      securityGroups: [serviceSecurityGroup],
    })

    service.attachToApplicationTargetGroup(serviceTargetGroup)
    publicLoadBalancerSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.allTraffic())

    this.lb.addListener('HttpsListener', {
      port: 443,
      certificates: [props.certificate],
      defaultAction: elbv2.ListenerAction.forward([serviceTargetGroup]),
    })

    this.lb.addListener('HttpListener', {
      port: 80,
      defaultAction: elbv2.ListenerAction.forward([serviceTargetGroup]),
    })

    props.fileSystem.connections.allowFromAnyIpv4(ec2.Port.tcp(2049)) // port 2049 (NFS) for EFS

    const volumeName = `${props.slug}-${props.appEnv}-efs`
    this.taskDefinition.addVolume({
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

    // Setup AutoScaling policy
    // TODO: make this configurable in cloud.compute
    const scaling = service.autoScaleTaskCount({ maxCapacity: 2 })

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 50,
      scaleInCooldown: Duration.seconds(60),
      scaleOutCooldown: Duration.seconds(60),
    })

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 60,
      scaleInCooldown: Duration.seconds(60),
      scaleOutCooldown: Duration.seconds(60),
    })

    const keysToRemove = [
      '_HANDLER',
      '_X_AMZN_TRACE_ID',
      'AWS_REGION',
      'AWS_EXECUTION_ENV',
      'AWS_LAMBDA_FUNCTION_NAME',
      'AWS_LAMBDA_FUNCTION_MEMORY_SIZE',
      'AWS_LAMBDA_FUNCTION_VERSION',
      'AWS_LAMBDA_INITIALIZATION_TYPE',
      'AWS_LAMBDA_LOG_GROUP_NAME',
      'AWS_LAMBDA_LOG_STREAM_NAME',
      'AWS_ACCESS_KEY',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_SESSION_TOKEN',
      'AWS_LAMBDA_RUNTIME_API',
      'LAMBDA_TASK_ROOT',
      'LAMBDA_RUNTIME_DIR',
      '_',
    ]
    keysToRemove.forEach(key => delete env[key as EnvKey])

    const secrets = new secretsmanager.Secret(scope, 'StacksSecrets', {
      secretName: `${props.slug}-${props.appEnv}-secrets`,
      description: 'Secrets for the Stacks application',
      generateSecretString: {
        secretStringTemplate: JSON.stringify(env),
        generateStringKey: Object.keys(env).join(',').length.toString(),
      },
    })

    if (service.taskDefinition.executionRole) {
      secrets.grantRead(service.taskDefinition.executionRole)
      container.addEnvironment('SECRETS_ARN', secrets.secretArn)
    }
    else {
      throw new Error('Service task execution role is undefined.')
    }

    const apiPrefix = 'api'
    new Output(scope, 'ApiUrl', {
      value: `https://${apiPrefix}.${props.domain}/`,
      description: 'The URL of the deployed application',
    })

    new Output(scope, 'ApiVanityUrl', {
      value: `http://${this.lb.loadBalancerDnsName}`,
      description: 'The Vanity URL / DNS name of the load balancer',
    })
  }
}
