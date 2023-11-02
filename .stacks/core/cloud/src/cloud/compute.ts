/* eslint-disable no-new */
import type { aws_certificatemanager as acm, aws_efs as efs } from 'aws-cdk-lib'
import { Duration, CfnOutput as Output, Stack, aws_dynamodb as dynamodb, aws_ec2 as ec2, aws_ecs as ecs, aws_elasticloadbalancingv2 as elbv2, aws_iam as iam, aws_logs as logs, aws_route53 as route53, aws_route53_targets as route53Targets } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'

export interface ComputeStackProps extends NestedCloudProps {
  vpc: ec2.Vpc
  fileSystem: efs.FileSystem
  zone: route53.IHostedZone
  certificate: acm.Certificate
}

export class ComputeStack {
  lb: elbv2.ApplicationLoadBalancer

  constructor(scope: Construct, props: ComputeStackProps) {
    const vpc = props.vpc
    const fileSystem = props.fileSystem

    if (!fileSystem)
      throw new Error('The file system is missing. Please make sure it was created properly.')

    const ecsCluster = new ecs.Cluster(scope, 'DefaultEcsCluster', {
      clusterName: `${props.appName}-${props.appEnv}-ecs-cluster`,
      containerInsights: true,
      vpc,
    })

    fileSystem.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['elasticfilesystem:ClientMount'],
        principals: [new iam.AnyPrincipal()],
        conditions: {
          Bool: {
            'elasticfilesystem:AccessedViaMountTarget': 'true',
          },
        },
      }),
    )

    const cacheTable = new dynamodb.Table(scope, 'CacheTable', {
      partitionKey: { name: 'counter', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    })

    const taskRole = new iam.Role(scope, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      inlinePolicies: {
        AccessToHitCounterTable: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['dynamodb:Get*', 'dynamodb:UpdateItem'],
              resources: [cacheTable.tableArn],
              conditions: {
                ArnLike: {
                  'aws:SourceArn': `arn:aws:ecs:${Stack.of(scope).region}:${Stack.of(scope).account}:*`,
                },
                StringEquals: {
                  'aws:SourceAccount': Stack.of(scope).account,
                },
              },
            }),
          ],
        }),
      },
    })

    const taskDefinition = new ecs.FargateTaskDefinition(scope, 'FargateTaskDefinition', {
      memoryLimitMiB: 512, // TODO: make configurable in cloud.compute
      cpu: 256, // TODO: make configurable in cloud.compute
      volumes: [
        {
          name: 'stacks-efs',
          efsVolumeConfiguration: {
            fileSystemId: fileSystem.fileSystemId,
          },
        },
      ],
      taskRole,
      executionRole: new iam.Role(scope, 'ExecutionRole', {
        assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      }),
    })

    const containerDef = taskDefinition.addContainer('WebContainer', {
      containerName: `${props.appName}-${props.appEnv}-web-container`,
      image: ecs.ContainerImage.fromRegistry('public.ecr.aws/docker/library/nginx:latest'),
      logging: new ecs.AwsLogDriver({
        streamPrefix: `${props.appName}-${props.appEnv}-web`,
        logGroup: new logs.LogGroup(scope, 'LogGroup'),
      }),
      // gpuCount: 0,
    })

    containerDef.addMountPoints(
      {
        sourceVolume: 'stacks-efs',
        containerPath: '/mnt/efs',
        readOnly: false,
      },
    )

    containerDef.addPortMappings({ containerPort: 80 })

    const serviceSecurityGroup = new ec2.SecurityGroup(scope, 'ServiceSecurityGroup', {
      securityGroupName: `${props.appName}-${props.appEnv}-service-sg`,
      vpc,
      description: 'Security group for service',
    })

    const publicLoadBalancerSG = new ec2.SecurityGroup(scope, 'PublicLoadBalancerSG', {
      securityGroupName: `${props.appName}-${props.appEnv}-public-load-balancer-sg`,
      vpc,
      description: 'Access to the public facing load balancer',
    })

    // Assuming serviceSecurityGroup and publicLoadBalancerSG are already defined
    serviceSecurityGroup.addIngressRule(publicLoadBalancerSG, ec2.Port.allTraffic(), 'Ingress from the public ALB')

    this.lb = new elbv2.ApplicationLoadBalancer(scope, 'ApplicationLoadBalancer', {
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

    const serviceTargetGroup = new elbv2.ApplicationTargetGroup(scope, 'ServiceTargetGroup', {
      // targetGroupName: `${props.appName}-${props.appEnv}-service-tg`,
      vpc,
      targetType: elbv2.TargetType.IP,
      protocol: elbv2.ApplicationProtocol.HTTP,
      port: 80,
      healthCheck: {
        interval: Duration.seconds(6),
        path: '/',
        timeout: Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 10,
      },
    })

    this.lb.addListener('HttpListener', {
      port: 80,
      defaultAction: elbv2.ListenerAction.forward([serviceTargetGroup]),
    })

    this.lb.addListener('HttpsListener', {
      port: 443,
      certificates: [props.certificate],
      defaultAction: elbv2.ListenerAction.forward([serviceTargetGroup]),
    })

    const service = new ecs.FargateService(scope, 'WebService', {
      serviceName: `${props.appName}-${props.appEnv}-web-service`,
      cluster: ecsCluster,
      taskDefinition,
      desiredCount: 2,
      assignPublicIp: true,
      minHealthyPercent: 75,
      securityGroups: [serviceSecurityGroup],
    })

    service.attachToApplicationTargetGroup(serviceTargetGroup)

    publicLoadBalancerSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.allTraffic())

    new route53.ARecord(scope, 'AliasApiRecord', {
      zone: props.zone,
      recordName: 'api',
      target: route53.RecordTarget.fromAlias(new route53Targets.LoadBalancerTarget(this.lb)),
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

    // this.compute.fargate.targetGroup.setAttribute('deregistration_delay.timeout_seconds', '0')

    // Allow access to EFS from Fargate ECS
    fileSystem.grantRootAccess(service.taskDefinition.taskRole.grantPrincipal)
    fileSystem.connections.allowDefaultPortFrom(service.connections)

    const apiPrefix = 'api'
    new Output(scope, 'ApiUrl', {
      value: `https://${props.domain}/${apiPrefix}`,
      description: 'The URL of the deployed application',
    })

    new Output(scope, 'LoadBalancerDNSName', {
      value: `http://${this.lb.loadBalancerDnsName}`,
      description: 'The DNS name of the load balancer',
    })
  }
}
