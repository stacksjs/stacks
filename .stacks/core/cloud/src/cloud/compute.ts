// manageCompute() {
//   const vpc = this.vpc
//   const fileSystem = this.storage.fileSystem

//   if (!fileSystem)
//     throw new Error('The file system is missing. Please make sure it was created properly.')

//   const ecsCluster = new ecs.Cluster(this, 'DefaultEcsCluster', {
//     clusterName: `${this.appName}-${appEnv}-ecs-cluster`,
//     containerInsights: true,
//     vpc,
//   })

//   fileSystem.addToResourcePolicy(
//     new iam.PolicyStatement({
//       actions: ['elasticfilesystem:ClientMount'],
//       principals: [new iam.AnyPrincipal()],
//       conditions: {
//         Bool: {
//           'elasticfilesystem:AccessedViaMountTarget': 'true',
//         },
//       },
//     }),
//   )

//   const cacheTable = new dynamodb.Table(this, 'CacheTable', {
//     partitionKey: { name: 'counter', type: dynamodb.AttributeType.STRING },
//     billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
//   })

//   const taskRole = new iam.Role(this, 'TaskRole', {
//     assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
//     inlinePolicies: {
//       AccessToHitCounterTable: new iam.PolicyDocument({
//         statements: [
//           new iam.PolicyStatement({
//             actions: ['dynamodb:Get*', 'dynamodb:UpdateItem'],
//             resources: [cacheTable.tableArn],
//             conditions: {
//               ArnLike: {
//                 'aws:SourceArn': `arn:aws:ecs:${this.region}:${this.account}:*`,
//               },
//               StringEquals: {
//                 'aws:SourceAccount': this.account,
//               },
//             },
//           }),
//         ],
//       }),
//     },
//   })

//   const taskDefinition = new ecs.FargateTaskDefinition(this, 'FargateTaskDefinition', {
//     memoryLimitMiB: 512, // TODO: make configurable in cloud.compute
//     cpu: 256, // TODO: make configurable in cloud.compute
//     volumes: [
//       {
//         name: 'stacks-efs',
//         efsVolumeConfiguration: {
//           fileSystemId: fileSystem.fileSystemId,
//         },
//       },
//     ],
//     taskRole,
//     executionRole: new iam.Role(this, 'ExecutionRole', {
//       assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
//     }),
//   })

//   const containerDef = taskDefinition.addContainer('WebContainer', {
//     containerName: `${this.appName}-${appEnv}-web-container`,
//     image: ecs.ContainerImage.fromRegistry('public.ecr.aws/docker/library/nginx:latest'),
//     logging: new ecs.AwsLogDriver({
//       streamPrefix: `${this.appName}-${appEnv}-web`,
//       logGroup: new logs.LogGroup(this, 'LogGroup'),
//     }),
//     // gpuCount: 0,
//   })

//   containerDef.addMountPoints(
//     {
//       sourceVolume: 'stacks-efs',
//       containerPath: '/mnt/efs',
//       readOnly: false,
//     },
//   )

//   containerDef.addPortMappings({ containerPort: 3000 })

//   const serviceSecurityGroup = new ec2.SecurityGroup(this, 'ServiceSecurityGroup', {
//     vpc,
//     description: 'Security group for service',
//   })

//   const publicLoadBalancerSG = new ec2.SecurityGroup(this, 'PublicLoadBalancerSG', {
//     vpc,
//     description: 'Access to the public facing load balancer',
//   })

//   // Assuming serviceSecurityGroup and publicLoadBalancerSG are already defined
//   serviceSecurityGroup.addIngressRule(publicLoadBalancerSG, ec2.Port.allTraffic(), 'Ingress from the public ALB')

//   const serviceTargetGroup = new elbv2.ApplicationTargetGroup(this, 'ServiceTargetGroup', {
//     vpc,
//     targetType: elbv2.TargetType.IP,
//     protocol: elbv2.ApplicationProtocol.HTTP,
//     port: 80,
//     healthCheck: {
//       interval: Duration.seconds(6),
//       path: '/',
//       timeout: Duration.seconds(5),
//       healthyThresholdCount: 2,
//       unhealthyThresholdCount: 10,
//     },
//   })

//   publicLoadBalancerSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.allTraffic())

//   const lb = new elbv2.ApplicationLoadBalancer(this, 'ApplicationLoadBalancer', {
//     vpc,
//     vpcSubnets: {
//       subnetType: ec2.SubnetType.PUBLIC,
//     },
//     internetFacing: true,
//     idleTimeout: Duration.seconds(30),
//     securityGroup: publicLoadBalancerSG,
//   })

//   const listener = lb.addListener('PublicLoadBalancerListener', {
//     port: 80,
//   })

//   const service = new ecs.FargateService(this, 'WebService', {
//     serviceName: `${this.appName}-${appEnv}-web-service`,
//     cluster: ecsCluster,
//     taskDefinition,
//     desiredCount: 2,
//     assignPublicIp: true,
//     minHealthyPercent: 75,
//     securityGroups: [serviceSecurityGroup],
//   })

//   this.compute.fargate = service

//   listener.addTargets('ECS', {
//     port: 80,
//     targets: [service],
//   })

//   // Setup AutoScaling policy
//   // TODO: make this configurable in cloud.compute
//   const scaling = this.compute.fargate.autoScaleTaskCount({ maxCapacity: 2 })
//   scaling.scaleOnCpuUtilization('CpuScaling', {
//     targetUtilizationPercent: 50,
//     scaleInCooldown: Duration.seconds(60),
//     scaleOutCooldown: Duration.seconds(60),
//   })
//   scaling.scaleOnMemoryUtilization('MemoryScaling', {
//     targetUtilizationPercent: 60,
//     scaleInCooldown: Duration.seconds(60),
//     scaleOutCooldown: Duration.seconds(60),
//   })

//   // this.compute.fargate.targetGroup.setAttribute('deregistration_delay.timeout_seconds', '0')

//   // Allow access to EFS from Fargate ECS
//   fileSystem.grantRootAccess(this.compute.fargate.taskDefinition.taskRole.grantPrincipal)
//   fileSystem.connections.allowDefaultPortFrom(this.compute.fargate.connections)
// }

//   new Output(this, 'ApiUrl', {
//   value: `https://${this.domain}/${this.apiPrefix}`,
//   description: 'The URL of the deployed application',
// })

// if (this.apiVanityUrl) {
//   new Output(this, 'ApiVanityUrl', {
//     value: this.apiVanityUrl,
//     description: 'The vanity URL of the deployed Stacks server.',
//   })
// }
