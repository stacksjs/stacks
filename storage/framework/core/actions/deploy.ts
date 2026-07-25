/**
 * ts-cloud deployment functions
 * Creates real AWS infrastructure for Stacks deployments
 */
import process from 'node:process'
import { log } from '@stacksjs/cli'
import { getErrorMessage } from '@stacksjs/utils'
import type { CloudConfig } from '@ts-cloud/core'

// Load cloud config lazily to avoid import issues
async function getCloudConfig(): Promise<CloudConfig | null> {
  try {
    // Path from storage/framework/core/actions/deploy.ts to config/cloud.ts
    // 4 levels up: actions -> core -> framework -> storage -> (root)
    const cloudConfig = await import('../../../../config/cloud')
    return cloudConfig.tsCloud || null
  }
  catch {
    return null
  }
}

// Load cloud config lazily to avoid import issues
async function getProjectConfig(): Promise<{ name: string, region: string }> {
  const config = await getCloudConfig()
  return {
    name: config?.project?.name || 'stacks',
    region: config?.project?.region || 'us-east-1',
  }
}

/**
 * Map provider-agnostic instance size to AWS instance type
 */
function mapSizeToAwsInstanceType(size: string): string {
  const sizeMap: Record<string, string> = {
    nano: 't3.nano',
    micro: 't3.micro',
    small: 't3.small',
    medium: 't3.medium',
    large: 't3.large',
    xlarge: 't3.xlarge',
    '2xlarge': 't3.2xlarge',
  }
  // If it's a known size, map it; otherwise assume it's already an AWS instance type
  return sizeMap[size] || size
}

/**
 * Map provider-agnostic disk type to AWS EBS volume type
 */
function mapDiskTypeToAwsVolumeType(diskType: string): string {
  const typeMap: Record<string, string> = {
    standard: 'gp2',
    ssd: 'gp3',
    premium: 'io2',
  }
  return typeMap[diskType] || diskType
}

/**
 * Get AWS account ID for the current credentials
 */
async function getAwsAccountId(region: string): Promise<string> {
  try {
    const { AWSClient } = await import('@stacksjs/ts-cloud')
    const client = new AWSClient()

    const params = new URLSearchParams({
      Action: 'GetCallerIdentity',
      Version: '2011-06-15',
    })

    const result = await client.request({
      service: 'sts',
      region,
      method: 'POST',
      path: '/',
      body: params.toString(),
    })

    // Parse the XML response to get Account ID
    const accountMatch = String(result).match(/<Account>(\d+)<\/Account>/)
    if (accountMatch && accountMatch[1]) {
      return accountMatch[1]
    }

    // Fallback: use environment variable if STS fails
    return process.env.AWS_ACCOUNT_ID || ''
  } catch (error) {
    // Fallback to environment variable
    return process.env.AWS_ACCOUNT_ID || ''
  }
}

interface DeployStackOptions {
  environment: string
  region: string
  waitForCompletion?: boolean
  verbose?: boolean
}

interface DeployFrontendOptions {
  environment: string
  region: string
  buildDir: string
}

/**
 * Generate CloudFormation template using InfrastructureGenerator
 * Supports both server and serverless modes based on config
 */
async function generateTemplate(options: {
  environment: string
  projectName: string
}): Promise<string> {
  const { environment } = options
  const cloudConfig = await getCloudConfig()
  if (!cloudConfig) {
    throw new Error('Cloud configuration not found. Ensure config/cloud.ts exports tsCloud.')
  }

  const { InfrastructureGenerator } = await import('@stacksjs/ts-cloud')

  const generator = new InfrastructureGenerator({
    config: cloudConfig as any,
    environment: environment as 'production' | 'staging' | 'development',
  })

  // Use compact JSON to stay under CloudFormation 51200 byte inline limit
  const template = generator.generate().getBuilder().build()
  return JSON.stringify(template)
}

/**
 * Generate CloudFormation template for Serverless (ECS + S3 + CloudFront) infrastructure
 * Supports: ECS Fargate for API, S3 + CloudFront for frontend, ALB, auto-scaling
 */
async function generateServerlessTemplate(options: {
  environment: string
  projectName: string
  domain?: string
  imageUri?: string
}): Promise<string> {
  const { environment, projectName, domain, imageUri } = options
  const stackSlug = `${projectName}-${environment}`

  // Load cloud config
  const cloudConfig = await getCloudConfig()
  const siteDomain = domain || cloudConfig?.infrastructure?.dns?.domain || 'stacksjs.com'
  const sslConfig = cloudConfig?.infrastructure?.ssl || { enabled: true, provider: 'acm' }
  const computeConfig = cloudConfig?.infrastructure?.compute
  const serverlessConfig = computeConfig?.serverless || {
    cpu: 512,
    memory: 1024,
    desiredCount: 2,
  }

  // Container configuration
  const cpu = serverlessConfig.cpu || 512
  const memory = serverlessConfig.memory || 1024
  const port = 3000
  const desiredCount = serverlessConfig.desiredCount || 2
  const healthCheckPath = '/health'
  const rawAutoScaling = computeConfig?.autoScaling
  const autoScalingConfig = {
    min: rawAutoScaling?.min ?? 1,
    max: rawAutoScaling?.max ?? 10,
    targetCpuUtilization: rawAutoScaling?.scaleUpThreshold ?? 70,
    targetMemoryUtilization: 80,
  }

  // DNS configuration
  const dnsConfig = cloudConfig?.infrastructure?.dns || {}
  const hostedZoneId = dnsConfig.hostedZoneId || ''
  const sslDomains = sslConfig.domains || [siteDomain, `www.${siteDomain}`]

  log.debug(`  Mode: Serverless (ECS Fargate + S3 + CloudFront)`)
  log.debug(`  Container: ${cpu} CPU, ${memory}MB memory`)
  log.debug(`  Desired count: ${desiredCount}`)
  log.debug(`  Auto Scaling: ${autoScalingConfig.min}-${autoScalingConfig.max} tasks`)

  // Build resources object
  const resources: Record<string, any> = {
    // VPC
    VPC: {
      Type: 'AWS::EC2::VPC',
      Properties: {
        CidrBlock: '10.0.0.0/16',
        EnableDnsHostnames: true,
        EnableDnsSupport: true,
        Tags: [{ Key: 'Name', Value: `${stackSlug}-vpc` }, { Key: 'Environment', Value: environment }],
      },
    },
    InternetGateway: {
      Type: 'AWS::EC2::InternetGateway',
      Properties: { Tags: [{ Key: 'Name', Value: `${stackSlug}-igw` }, { Key: 'Environment', Value: environment }] },
    },
    AttachGateway: {
      Type: 'AWS::EC2::VPCGatewayAttachment',
      Properties: { VpcId: { Ref: 'VPC' }, InternetGatewayId: { Ref: 'InternetGateway' } },
    },
    PublicSubnet1: {
      Type: 'AWS::EC2::Subnet',
      Properties: {
        VpcId: { Ref: 'VPC' },
        CidrBlock: '10.0.1.0/24',
        AvailabilityZone: { 'Fn::Select': [0, { 'Fn::GetAZs': '' }] },
        MapPublicIpOnLaunch: true,
        Tags: [{ Key: 'Name', Value: `${stackSlug}-public-1` }, { Key: 'Environment', Value: environment }],
      },
    },
    PublicSubnet2: {
      Type: 'AWS::EC2::Subnet',
      Properties: {
        VpcId: { Ref: 'VPC' },
        CidrBlock: '10.0.2.0/24',
        AvailabilityZone: { 'Fn::Select': [1, { 'Fn::GetAZs': '' }] },
        MapPublicIpOnLaunch: true,
        Tags: [{ Key: 'Name', Value: `${stackSlug}-public-2` }, { Key: 'Environment', Value: environment }],
      },
    },
    PublicRouteTable: {
      Type: 'AWS::EC2::RouteTable',
      Properties: { VpcId: { Ref: 'VPC' }, Tags: [{ Key: 'Name', Value: `${stackSlug}-public-rt` }] },
    },
    PublicRoute: {
      Type: 'AWS::EC2::Route',
      DependsOn: 'AttachGateway',
      Properties: { RouteTableId: { Ref: 'PublicRouteTable' }, DestinationCidrBlock: '0.0.0.0/0', GatewayId: { Ref: 'InternetGateway' } },
    },
    SubnetRouteTableAssociation1: {
      Type: 'AWS::EC2::SubnetRouteTableAssociation',
      Properties: { SubnetId: { Ref: 'PublicSubnet1' }, RouteTableId: { Ref: 'PublicRouteTable' } },
    },
    SubnetRouteTableAssociation2: {
      Type: 'AWS::EC2::SubnetRouteTableAssociation',
      Properties: { SubnetId: { Ref: 'PublicSubnet2' }, RouteTableId: { Ref: 'PublicRouteTable' } },
    },

    // ECR Repository is created manually before CloudFormation
    // to ensure the Docker image is available before ECS Service starts

    // ECS Cluster
    ECSCluster: {
      Type: 'AWS::ECS::Cluster',
      Properties: {
        ClusterName: `${stackSlug}-cluster`,
        Tags: [{ Key: 'Environment', Value: environment }],
      },
    },

    // IAM Role for ECS Task Execution
    ECSTaskExecutionRole: {
      Type: 'AWS::IAM::Role',
      Properties: {
        AssumeRolePolicyDocument: {
          Version: '2012-10-17',
          Statement: [{ Effect: 'Allow', Principal: { Service: 'ecs-tasks.amazonaws.com' }, Action: 'sts:AssumeRole' }],
        },
        ManagedPolicyArns: [
          'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy',
        ],
      },
    },

    // IAM Role for ECS Task (application permissions)
    ECSTaskRole: {
      Type: 'AWS::IAM::Role',
      Properties: {
        AssumeRolePolicyDocument: {
          Version: '2012-10-17',
          Statement: [{ Effect: 'Allow', Principal: { Service: 'ecs-tasks.amazonaws.com' }, Action: 'sts:AssumeRole' }],
        },
        ManagedPolicyArns: [
          'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess',
          'arn:aws:iam::aws:policy/CloudWatchLogsFullAccess',
        ],
      },
    },

    // CloudWatch Log Group
    ECSLogGroup: {
      Type: 'AWS::Logs::LogGroup',
      Properties: {
        LogGroupName: `/ecs/${stackSlug}-api`,
        RetentionInDays: 7,
      },
    },

    // ECS Task Definition
    ECSTaskDefinition: {
      Type: 'AWS::ECS::TaskDefinition',
      Properties: {
        Family: `${stackSlug}-api`,
        NetworkMode: 'awsvpc',
        RequiresCompatibilities: ['FARGATE'],
        Cpu: String(cpu),
        Memory: String(memory),
        ExecutionRoleArn: { 'Fn::GetAtt': ['ECSTaskExecutionRole', 'Arn'] },
        TaskRoleArn: { 'Fn::GetAtt': ['ECSTaskRole', 'Arn'] },
        ContainerDefinitions: [
          {
            Name: 'api',
            Image: imageUri || { 'Fn::Sub': `\${AWS::AccountId}.dkr.ecr.\${AWS::Region}.amazonaws.com/${stackSlug}-api:latest` },
            PortMappings: [{ ContainerPort: port, Protocol: 'tcp' }],
            Environment: [
              { Name: 'APP_ENV', Value: environment },
              { Name: 'NODE_ENV', Value: environment },
              { Name: 'PORT', Value: String(port) },
            ],
            LogConfiguration: {
              LogDriver: 'awslogs',
              Options: {
                'awslogs-group': { Ref: 'ECSLogGroup' },
                'awslogs-region': { Ref: 'AWS::Region' },
                'awslogs-stream-prefix': 'api',
              },
            },
            HealthCheck: {
              Command: [`CMD-SHELL`, `wget --quiet --tries=1 --spider http://localhost:${port}${healthCheckPath} || exit 1`],
              Interval: 30,
              Timeout: 5,
              Retries: 3,
              StartPeriod: 120,
            },
          },
        ],
        Tags: [{ Key: 'Environment', Value: environment }],
      },
    },

    // Application Load Balancer Security Group
    ALBSecurityGroup: {
      Type: 'AWS::EC2::SecurityGroup',
      Properties: {
        GroupDescription: 'Security group for Application Load Balancer',
        VpcId: { Ref: 'VPC' },
        SecurityGroupIngress: [
          { IpProtocol: 'tcp', FromPort: 80, ToPort: 80, CidrIp: '0.0.0.0/0' },
          { IpProtocol: 'tcp', FromPort: 443, ToPort: 443, CidrIp: '0.0.0.0/0' },
        ],
        SecurityGroupEgress: [{ IpProtocol: '-1', CidrIp: '0.0.0.0/0' }],
        Tags: [{ Key: 'Name', Value: `${stackSlug}-alb-sg` }, { Key: 'Environment', Value: environment }],
      },
    },

    // ECS Service Security Group
    ECSSecurityGroup: {
      Type: 'AWS::EC2::SecurityGroup',
      Properties: {
        GroupDescription: 'Security group for ECS tasks',
        VpcId: { Ref: 'VPC' },
        SecurityGroupIngress: [
          { IpProtocol: 'tcp', FromPort: port, ToPort: port, SourceSecurityGroupId: { Ref: 'ALBSecurityGroup' } },
        ],
        SecurityGroupEgress: [{ IpProtocol: '-1', CidrIp: '0.0.0.0/0' }],
        Tags: [{ Key: 'Name', Value: `${stackSlug}-ecs-sg` }, { Key: 'Environment', Value: environment }],
      },
    },

    // Application Load Balancer
    ApplicationLoadBalancer: {
      Type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
      Properties: {
        Name: `${stackSlug}-alb`,
        Type: 'application',
        Scheme: 'internet-facing',
        IpAddressType: 'ipv4',
        Subnets: [{ Ref: 'PublicSubnet1' }, { Ref: 'PublicSubnet2' }],
        SecurityGroups: [{ Ref: 'ALBSecurityGroup' }],
        Tags: [{ Key: 'Environment', Value: environment }],
      },
    },

    // Target Group
    ECSTargetGroup: {
      Type: 'AWS::ElasticLoadBalancingV2::TargetGroup',
      Properties: {
        Name: `${stackSlug}-tg`,
        Port: port,
        Protocol: 'HTTP',
        VpcId: { Ref: 'VPC' },
        TargetType: 'ip',
        HealthCheckEnabled: true,
        HealthCheckPath: healthCheckPath,
        HealthCheckProtocol: 'HTTP',
        HealthCheckIntervalSeconds: 30,
        HealthCheckTimeoutSeconds: 5,
        HealthyThresholdCount: 2,
        UnhealthyThresholdCount: 5,
        Matcher: { HttpCode: '200' },
        TargetGroupAttributes: [
          { Key: 'deregistration_delay.timeout_seconds', Value: '30' },
        ],
        Tags: [{ Key: 'Environment', Value: environment }],
      },
    },

    // ALB Listener (HTTP)
    ALBListener: {
      Type: 'AWS::ElasticLoadBalancingV2::Listener',
      Properties: {
        LoadBalancerArn: { Ref: 'ApplicationLoadBalancer' },
        Port: 80,
        Protocol: 'HTTP',
        DefaultActions: [
          {
            Type: 'forward',
            TargetGroupArn: { Ref: 'ECSTargetGroup' },
          },
        ],
      },
    },

    // ECS Service
    ECSService: {
      Type: 'AWS::ECS::Service',
      DependsOn: 'ALBListener',
      Properties: {
        ServiceName: `${stackSlug}-api-service`,
        Cluster: { Ref: 'ECSCluster' },
        TaskDefinition: { Ref: 'ECSTaskDefinition' },
        DesiredCount: desiredCount,
        LaunchType: 'FARGATE',
        NetworkConfiguration: {
          AwsvpcConfiguration: {
            AssignPublicIp: 'ENABLED',
            Subnets: [{ Ref: 'PublicSubnet1' }, { Ref: 'PublicSubnet2' }],
            SecurityGroups: [{ Ref: 'ECSSecurityGroup' }],
          },
        },
        LoadBalancers: [
          {
            ContainerName: 'api',
            ContainerPort: port,
            TargetGroupArn: { Ref: 'ECSTargetGroup' },
          },
        ],
        HealthCheckGracePeriodSeconds: 300,
        Tags: [{ Key: 'Environment', Value: environment }],
      },
    },

    // Auto Scaling Target
    ECSAutoScalingTarget: {
      Type: 'AWS::ApplicationAutoScaling::ScalableTarget',
      Properties: {
        MaxCapacity: autoScalingConfig.max,
        MinCapacity: autoScalingConfig.min,
        ResourceId: { 'Fn::Sub': 'service/${ECSCluster}/${ECSService.Name}' },
        RoleARN: { 'Fn::Sub': 'arn:aws:iam::${AWS::AccountId}:role/aws-service-role/ecs.application-autoscaling.amazonaws.com/AWSServiceRoleForApplicationAutoScaling_ECSService' },
        ScalableDimension: 'ecs:service:DesiredCount',
        ServiceNamespace: 'ecs',
      },
    },

    // Auto Scaling Policy - CPU
    ECSAutoScalingPolicyCPU: {
      Type: 'AWS::ApplicationAutoScaling::ScalingPolicy',
      Properties: {
        PolicyName: `${stackSlug}-cpu-scaling`,
        PolicyType: 'TargetTrackingScaling',
        ScalingTargetId: { Ref: 'ECSAutoScalingTarget' },
        TargetTrackingScalingPolicyConfiguration: {
          TargetValue: autoScalingConfig.targetCpuUtilization,
          PredefinedMetricSpecification: {
            PredefinedMetricType: 'ECSServiceAverageCPUUtilization',
          },
          ScaleInCooldown: 300,
          ScaleOutCooldown: 60,
        },
      },
    },

    // Auto Scaling Policy - Memory
    ECSAutoScalingPolicyMemory: {
      Type: 'AWS::ApplicationAutoScaling::ScalingPolicy',
      Properties: {
        PolicyName: `${stackSlug}-memory-scaling`,
        PolicyType: 'TargetTrackingScaling',
        ScalingTargetId: { Ref: 'ECSAutoScalingTarget' },
        TargetTrackingScalingPolicyConfiguration: {
          TargetValue: autoScalingConfig.targetMemoryUtilization,
          PredefinedMetricSpecification: {
            PredefinedMetricType: 'ECSServiceAverageMemoryUtilization',
          },
          ScaleInCooldown: 300,
          ScaleOutCooldown: 60,
        },
      },
    },

    // S3 Bucket for Frontend
    FrontendBucket: {
      Type: 'AWS::S3::Bucket',
      DeletionPolicy: 'Retain',
      Properties: {
        BucketName: { 'Fn::Sub': `${stackSlug}-frontend-\${AWS::AccountId}` },
        WebsiteConfiguration: {
          IndexDocument: 'index.html',
          ErrorDocument: 'index.html',
        },
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: false,
          BlockPublicPolicy: false,
          IgnorePublicAcls: false,
          RestrictPublicBuckets: false,
        },
        CorsConfiguration: {
          CorsRules: [{ AllowedHeaders: ['*'], AllowedMethods: ['GET', 'HEAD'], AllowedOrigins: ['*'], MaxAge: 3600 }],
        },
        Tags: [{ Key: 'Environment', Value: environment }],
      },
    },

    // S3 Bucket Policy for Frontend
    FrontendBucketPolicy: {
      Type: 'AWS::S3::BucketPolicy',
      Properties: {
        Bucket: { Ref: 'FrontendBucket' },
        PolicyDocument: {
          Version: '2012-10-17',
          Statement: [{ Effect: 'Allow', Principal: '*', Action: 's3:GetObject', Resource: { 'Fn::Sub': 'arn:aws:s3:::${FrontendBucket}/*' } }],
        },
      },
    },

    // S3 Bucket for Assets
    AssetsBucket: {
      Type: 'AWS::S3::Bucket',
      DeletionPolicy: 'Retain',
      Properties: {
        BucketName: { 'Fn::Sub': `${stackSlug}-assets-\${AWS::AccountId}` },
        PublicAccessBlockConfiguration: { BlockPublicAcls: false, BlockPublicPolicy: false, IgnorePublicAcls: false, RestrictPublicBuckets: false },
        CorsConfiguration: { CorsRules: [{ AllowedHeaders: ['*'], AllowedMethods: ['GET', 'HEAD'], AllowedOrigins: ['*'], MaxAge: 3600 }] },
        Tags: [{ Key: 'Environment', Value: environment }],
      },
    },

    // S3 Bucket Policy for Assets
    AssetsBucketPolicy: {
      Type: 'AWS::S3::BucketPolicy',
      Properties: {
        Bucket: { Ref: 'AssetsBucket' },
        PolicyDocument: {
          Version: '2012-10-17',
          Statement: [{ Effect: 'Allow', Principal: '*', Action: 's3:GetObject', Resource: { 'Fn::Sub': 'arn:aws:s3:::${AssetsBucket}/*' } }],
        },
      },
    },

    // S3 Bucket for Documentation
    DocsBucket: {
      Type: 'AWS::S3::Bucket',
      DeletionPolicy: 'Retain',
      Properties: {
        BucketName: { 'Fn::Sub': `${stackSlug}-docs-\${AWS::AccountId}` },
        WebsiteConfiguration: {
          IndexDocument: 'index.html',
          ErrorDocument: '404.html',
        },
        PublicAccessBlockConfiguration: { BlockPublicAcls: false, BlockPublicPolicy: false, IgnorePublicAcls: false, RestrictPublicBuckets: false },
        CorsConfiguration: { CorsRules: [{ AllowedHeaders: ['*'], AllowedMethods: ['GET', 'HEAD'], AllowedOrigins: ['*'], MaxAge: 3600 }] },
        Tags: [{ Key: 'Environment', Value: environment }, { Key: 'Purpose', Value: 'documentation' }],
      },
    },

    // CloudFront Origin Access Control for S3
    CloudFrontOAC: {
      Type: 'AWS::CloudFront::OriginAccessControl',
      Properties: {
        OriginAccessControlConfig: {
          Name: { 'Fn::Sub': `${stackSlug}-oac` },
          OriginAccessControlOriginType: 's3',
          SigningBehavior: 'always',
          SigningProtocol: 'sigv4',
        },
      },
    },

    // CloudFront Distribution
    CloudFrontDistribution: {
      Type: 'AWS::CloudFront::Distribution',
      DependsOn: ['FrontendBucket', 'ApplicationLoadBalancer'],
      Properties: {
        DistributionConfig: {
          Enabled: true,
          Comment: { 'Fn::Sub': `${stackSlug} CloudFront Distribution` },
          DefaultRootObject: 'index.html',
          PriceClass: 'PriceClass_100',
          HttpVersion: 'http2and3',
          IPV6Enabled: true,
          // Origins: S3 for frontend, S3 for docs, ALB for API
          Origins: [
            {
              Id: 'S3Origin',
              DomainName: { 'Fn::GetAtt': ['FrontendBucket', 'RegionalDomainName'] },
              S3OriginConfig: {
                OriginAccessIdentity: '',
              },
              OriginAccessControlId: { 'Fn::GetAtt': ['CloudFrontOAC', 'Id'] },
            },
            {
              Id: 'DocsS3Origin',
              DomainName: { 'Fn::GetAtt': ['DocsBucket', 'RegionalDomainName'] },
              S3OriginConfig: {
                OriginAccessIdentity: '',
              },
              OriginAccessControlId: { 'Fn::GetAtt': ['CloudFrontOAC', 'Id'] },
            },
            {
              Id: 'ALBOrigin',
              DomainName: { 'Fn::GetAtt': ['ApplicationLoadBalancer', 'DNSName'] },
              CustomOriginConfig: {
                HTTPPort: 80,
                HTTPSPort: 443,
                OriginProtocolPolicy: 'https-only',
                OriginSSLProtocols: ['TLSv1.2'],
              },
            },
          ],
          // Default behavior: serve from S3
          DefaultCacheBehavior: {
            TargetOriginId: 'S3Origin',
            ViewerProtocolPolicy: 'redirect-to-https',
            AllowedMethods: ['GET', 'HEAD', 'OPTIONS'],
            CachedMethods: ['GET', 'HEAD'],
            Compress: true,
            CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6', // CachingOptimized
            OriginRequestPolicyId: '88a5eaf4-2fd4-4709-b370-b4c650ea3fcf', // CORS-S3Origin
          },
          // Cache behaviors for API routes and docs
          CacheBehaviors: [
            {
              PathPattern: '/docs/*',
              TargetOriginId: 'DocsS3Origin',
              ViewerProtocolPolicy: 'redirect-to-https',
              AllowedMethods: ['GET', 'HEAD', 'OPTIONS'],
              CachedMethods: ['GET', 'HEAD'],
              Compress: true,
              CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6', // CachingOptimized
              OriginRequestPolicyId: '88a5eaf4-2fd4-4709-b370-b4c650ea3fcf', // CORS-S3Origin
            },
            {
              PathPattern: '/docs',
              TargetOriginId: 'DocsS3Origin',
              ViewerProtocolPolicy: 'redirect-to-https',
              AllowedMethods: ['GET', 'HEAD', 'OPTIONS'],
              CachedMethods: ['GET', 'HEAD'],
              Compress: true,
              CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6', // CachingOptimized
              OriginRequestPolicyId: '88a5eaf4-2fd4-4709-b370-b4c650ea3fcf', // CORS-S3Origin
            },
            {
              PathPattern: '/api/*',
              TargetOriginId: 'ALBOrigin',
              ViewerProtocolPolicy: 'redirect-to-https',
              AllowedMethods: ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'],
              CachedMethods: ['GET', 'HEAD'],
              CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad', // CachingDisabled
              OriginRequestPolicyId: '216adef6-5c7f-47e4-b989-5492eafa07d3', // AllViewer
            },
            {
              PathPattern: '/health',
              TargetOriginId: 'ALBOrigin',
              ViewerProtocolPolicy: 'redirect-to-https',
              AllowedMethods: ['GET', 'HEAD', 'OPTIONS'],
              CachedMethods: ['GET', 'HEAD'],
              CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad', // CachingDisabled
              OriginRequestPolicyId: '216adef6-5c7f-47e4-b989-5492eafa07d3', // AllViewer
            },
          ],
          // Custom error responses for SPA routing
          CustomErrorResponses: [
            {
              ErrorCode: 403,
              ResponseCode: 200,
              ResponsePagePath: '/index.html',
              ErrorCachingMinTTL: 10,
            },
            {
              ErrorCode: 404,
              ResponseCode: 200,
              ResponsePagePath: '/index.html',
              ErrorCachingMinTTL: 10,
            },
          ],
          // Aliases will be added dynamically if SSL certificate exists
          ViewerCertificate: {
            CloudFrontDefaultCertificate: true,
          },
        },
        Tags: [{ Key: 'Environment', Value: environment }],
      },
    },
  }

  // Update S3 bucket policy to allow CloudFront OAC access
  resources.FrontendBucketPolicy = {
    Type: 'AWS::S3::BucketPolicy',
    DependsOn: 'CloudFrontOAC',
    Properties: {
      Bucket: { Ref: 'FrontendBucket' },
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { Service: 'cloudfront.amazonaws.com' },
            Action: 's3:GetObject',
            Resource: { 'Fn::Sub': 'arn:aws:s3:::${FrontendBucket}/*' },
            Condition: {
              StringEquals: {
                'AWS:SourceArn': { 'Fn::Sub': 'arn:aws:cloudfront::${AWS::AccountId}:distribution/${CloudFrontDistribution}' },
              },
            },
          },
        ],
      },
    },
  }

  // Docs bucket policy to allow CloudFront OAC access
  resources.DocsBucketPolicy = {
    Type: 'AWS::S3::BucketPolicy',
    DependsOn: 'CloudFrontOAC',
    Properties: {
      Bucket: { Ref: 'DocsBucket' },
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { Service: 'cloudfront.amazonaws.com' },
            Action: 's3:GetObject',
            Resource: { 'Fn::Sub': 'arn:aws:s3:::${DocsBucket}/*' },
            Condition: {
              StringEquals: {
                'AWS:SourceArn': { 'Fn::Sub': 'arn:aws:cloudfront::${AWS::AccountId}:distribution/${CloudFrontDistribution}' },
              },
            },
          },
        ],
      },
    },
  }

  // Add DNS records if hosted zone is configured - point to CloudFront
  if (hostedZoneId) {
    // CloudFront hosted zone ID (global - same for all regions)
    const cloudFrontHostedZoneId = 'Z2FDTNDATAQYW2'

    resources.DNSRecord = {
      Type: 'AWS::Route53::RecordSet',
      DependsOn: 'CloudFrontDistribution',
      Properties: {
        HostedZoneId: hostedZoneId,
        Name: siteDomain,
        Type: 'A',
        AliasTarget: {
          HostedZoneId: cloudFrontHostedZoneId,
          DNSName: { 'Fn::GetAtt': ['CloudFrontDistribution', 'DomainName'] },
          EvaluateTargetHealth: false,
        },
      },
    }

    // Add www subdomain if in sslDomains
    if (sslDomains.includes(`www.${siteDomain}`)) {
      resources.DNSRecordWww = {
        Type: 'AWS::Route53::RecordSet',
        DependsOn: 'CloudFrontDistribution',
        Properties: {
          HostedZoneId: hostedZoneId,
          Name: `www.${siteDomain}`,
          Type: 'A',
          AliasTarget: {
            HostedZoneId: cloudFrontHostedZoneId,
            DNSName: { 'Fn::GetAtt': ['CloudFrontDistribution', 'DomainName'] },
            EvaluateTargetHealth: false,
          },
        },
      }
    }
  }

  // Build outputs
  const outputs: Record<string, any> = {
    VpcId: { Description: 'VPC ID', Value: { Ref: 'VPC' }, Export: { Name: { 'Fn::Sub': '${AWS::StackName}-VpcId' } } },
    ECSClusterName: { Description: 'ECS Cluster Name', Value: { Ref: 'ECSCluster' }, Export: { Name: { 'Fn::Sub': '${AWS::StackName}-ECSCluster' } } },
    // ECR Repository is created manually before CloudFormation, so URI is not in stack outputs
    LoadBalancerDNS: { Description: 'ALB DNS Name', Value: { 'Fn::GetAtt': ['ApplicationLoadBalancer', 'DNSName'] } },
    ApplicationURL: { Description: 'URL to access the API', Value: { 'Fn::Sub': 'http://${ApplicationLoadBalancer.DNSName}' } },
    CloudFrontDomainName: { Description: 'CloudFront Distribution Domain Name', Value: { 'Fn::GetAtt': ['CloudFrontDistribution', 'DomainName'] } },
    CloudFrontDistributionId: { Description: 'CloudFront Distribution ID', Value: { Ref: 'CloudFrontDistribution' } },
    FrontendBucketName: { Description: 'S3 bucket for frontend', Value: { Ref: 'FrontendBucket' }, Export: { Name: { 'Fn::Sub': '${AWS::StackName}-FrontendBucket' } } },
    FrontendURL: { Description: 'Frontend website URL', Value: { 'Fn::Sub': 'https://${CloudFrontDistribution.DomainName}' } },
    AssetsBucketName: { Description: 'S3 bucket for static assets', Value: { Ref: 'AssetsBucket' }, Export: { Name: { 'Fn::Sub': '${AWS::StackName}-AssetsBucket' } } },
    DocsBucketName: { Description: 'S3 bucket for documentation', Value: { Ref: 'DocsBucket' }, Export: { Name: { 'Fn::Sub': '${AWS::StackName}-DocsBucket' } } },
    DocsURL: { Description: 'Documentation URL', Value: { 'Fn::Sub': 'https://${CloudFrontDistribution.DomainName}/docs' } },
  }

  // Add domain URL output if DNS is configured
  if (hostedZoneId) {
    outputs.DomainURL = { Description: 'Domain URL', Value: `https://${siteDomain}` }
  }

  const template = {
    AWSTemplateFormatVersion: '2010-09-09',
    Description: `Stacks Serverless Infrastructure (ECS + S3 + CloudFront) for ${projectName} (${environment})`,
    Parameters: {
      Environment: { Type: 'String', Default: environment, Description: 'Deployment environment' },
      DomainName: { Type: 'String', Default: siteDomain, Description: 'Domain name for the application' },
    },
    Resources: resources,
    Outputs: outputs,
  }

  return JSON.stringify(template, null, 2)
}

/**
 * Format resource status with color for CDK-style output
 */
function formatResourceStatus(status: string): string {
  // Use ANSI color codes for terminal output
  const colors = {
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
    reset: '\x1b[0m',
  }

  if (status.includes('COMPLETE') && !status.includes('ROLLBACK')) {
    return `${colors.green}${status}${colors.reset}`
  }
  if (status.includes('IN_PROGRESS')) {
    return `${colors.yellow}${status}${colors.reset}`
  }
  if (status.includes('FAILED') || status.includes('ROLLBACK')) {
    return `${colors.red}${status}${colors.reset}`
  }
  if (status.includes('DELETE')) {
    return `${colors.gray}${status}${colors.reset}`
  }
  return status
}

/**
 * Get short resource type name for cleaner output
 */
function getShortResourceType(resourceType: string): string {
  // Remove AWS:: prefix and simplify common types
  return resourceType
    .replace('AWS::', '')
    .replace('EC2::', '')
    .replace('ElasticLoadBalancingV2::', 'ELB::')
    .replace('AutoScaling::', 'ASG::')
    .replace('IAM::', '')
    .replace('S3::', 'S3::')
}

/**
 * Create CDK-style progress callback
 * @param filter - Optional filter: 'delete' to only show DELETE events, 'create' for CREATE, 'update' for UPDATE/CREATE
 *
 * Compatible with ts-cloud-core StackEvent: { EventId, StackName, LogicalResourceId, PhysicalResourceId?, ResourceType, Timestamp, ResourceStatus, ResourceStatusReason? }
 */
function createProgressCallback(filter?: 'delete' | 'create' | 'update'): (event: {
  LogicalResourceId: string
  ResourceType: string
  ResourceStatus: string
  ResourceStatusReason?: string
  Timestamp: string
  EventId: string
  StackName: string
  PhysicalResourceId?: string
}) => void {
  const maxIdLength = 35
  const maxTypeLength = 30
  const seenEvents = new Set<string>()

  return (event) => {
    const eventStatus = event.ResourceStatus
    const eventResourceId = event.LogicalResourceId
    const eventResourceType = event.ResourceType
    const eventReason = event.ResourceStatusReason

    // Filter events based on type if specified
    if (filter === 'delete' && !eventStatus.includes('DELETE')) {
      return
    }
    if (filter === 'create' && !eventStatus.includes('CREATE')) {
      return
    }
    // For updates, show both UPDATE and CREATE events (new resources may be created during update)
    if (filter === 'update' && !eventStatus.includes('UPDATE') && !eventStatus.includes('CREATE')) {
      return
    }

    // Deduplicate events (same resource + status)
    const eventKey = `${eventResourceId}:${eventStatus}`
    if (seenEvents.has(eventKey)) {
      return
    }
    seenEvents.add(eventKey)

    const resourceId = eventResourceId.padEnd(maxIdLength).substring(0, maxIdLength)
    const resourceType = getShortResourceType(eventResourceType).padEnd(maxTypeLength).substring(0, maxTypeLength)
    const status = formatResourceStatus(eventStatus)

    // Format: ResourceId | ResourceType | Status
    const line = `  ${resourceId} ${resourceType} ${status}`
    console.log(line)

    // Show reason for failures
    if (eventReason && (eventStatus.includes('FAILED') || eventStatus.includes('ROLLBACK'))) {
      console.log(`    └─ ${eventReason}`)
    }
  }
}

/**
 * Setup SSL certificate after deployment
 * Note: DNS records are already set by CloudFormation to point to CloudFront
 */
async function setupDnsAndSsl(options: {
  region: string
  domain: string
  sslDomains: string[]
  hostedZoneId: string
  albDnsName: string
  stackName: string
}): Promise<void> {
  const { region, domain, sslDomains, hostedZoneId, albDnsName, stackName } = options

  console.log('')
  console.log('Setting up SSL certificate...')

  try {
    const { Route53Client, ACMClient, AWSClient } = await import('@stacksjs/ts-cloud')
    const r53 = new Route53Client(region)
    const acm = new ACMClient(region)
    const client = new AWSClient()

    // Note: DNS records pointing to CloudFront are already created by CloudFormation
    // We only need to request and validate SSL certificate here

    // 1. Request SSL certificate
    console.log(`  Requesting SSL certificate for ${domain}...`)
    const certResult = await acm.requestCertificate({
      DomainName: sslDomains[0] ?? domain,
      SubjectAlternativeNames: sslDomains.length > 1 ? sslDomains.slice(1) : undefined,
      ValidationMethod: 'DNS',
    })
    console.log(`  Certificate ARN: ${certResult.CertificateArn}`)

    // 3. Wait for validation options
    await new Promise(r => setTimeout(r, 5000))
    const cert = await acm.describeCertificate({ CertificateArn: certResult.CertificateArn })

    // 4. Add DNS validation records
    console.log('  Adding DNS validation records...')
    for (const opt of cert.DomainValidationOptions || []) {
      if (opt.ResourceRecord) {
        await r53.changeResourceRecordSets({
          HostedZoneId: hostedZoneId,
          ChangeBatch: {
            Changes: [{
              Action: 'UPSERT',
              ResourceRecordSet: {
                Name: opt.ResourceRecord.Name,
                Type: 'CNAME',
                TTL: 300,
                ResourceRecords: [{ Value: opt.ResourceRecord.Value }],
              },
            }],
          },
        })
      }
    }
    console.log('✓ Validation records added')

    // 5. Wait for certificate validation
    console.log('  Waiting for certificate validation (this may take 1-5 minutes)...')
    for (let i = 0; i < 30; i++) {
      const c = await acm.describeCertificate({ CertificateArn: certResult.CertificateArn })
      if (c.Status === 'ISSUED') {
        console.log('✓ Certificate issued!')

        // 6. Get ALB and Target Group ARN from stack
        const { AWSCloudFormationClient } = await import('@stacksjs/ts-cloud')
        const cf = new AWSCloudFormationClient(region)
        const resources = await cf.listStackResources(stackName)
        const albArn = resources.StackResourceSummaries.find((r: any) => r.LogicalResourceId === 'ApplicationLoadBalancer')?.PhysicalResourceId
        // Support both serverless (ECSTargetGroup) and server (WebTargetGroup) modes
        const tgArn = resources.StackResourceSummaries.find((r: any) => r.LogicalResourceId === 'ECSTargetGroup')?.PhysicalResourceId
          || resources.StackResourceSummaries.find((r: any) => r.LogicalResourceId === 'WebTargetGroup')?.PhysicalResourceId

        if (albArn && tgArn) {
          // 7. Create HTTPS listener
          console.log('  Creating HTTPS listener...')
          const createParams = new URLSearchParams({
            Action: 'CreateListener',
            LoadBalancerArn: albArn,
            Protocol: 'HTTPS',
            Port: '443',
            'Certificates.member.1.CertificateArn': certResult.CertificateArn!,
            'DefaultActions.member.1.Type': 'forward',
            'DefaultActions.member.1.TargetGroupArn': tgArn,
            Version: '2015-12-01',
          })

          await client.request({
            service: 'elasticloadbalancing',
            region,
            method: 'POST',
            path: '/',
            body: createParams.toString(),
          })
          console.log('✓ HTTPS listener created!')

          // 8. Update HTTP to HTTPS redirect...
          console.log('  Configuring HTTP to HTTPS redirect...')
          const listParams = new URLSearchParams({
            Action: 'DescribeListeners',
            LoadBalancerArn: albArn,
            Version: '2015-12-01',
          })

          const listResult = await client.request({
            service: 'elasticloadbalancing',
            region,
            method: 'POST',
            path: '/',
            body: listParams.toString(),
          })

          const listeners = listResult?.DescribeListenersResponse?.DescribeListenersResult?.Listeners?.member
            || listResult?.DescribeListenersResult?.Listeners?.member
          const listenerList = Array.isArray(listeners) ? listeners : listeners ? [listeners] : []
          const httpListener = listenerList.find((l: any) => l.Port === '80' || l.Port === 80)

          if (httpListener) {
            const modifyParams = new URLSearchParams({
              Action: 'ModifyListener',
              ListenerArn: httpListener.ListenerArn,
              'DefaultActions.member.1.Type': 'redirect',
              'DefaultActions.member.1.RedirectConfig.Protocol': 'HTTPS',
              'DefaultActions.member.1.RedirectConfig.Port': '443',
              'DefaultActions.member.1.RedirectConfig.StatusCode': 'HTTP_301',
              Version: '2015-12-01',
            })

            await client.request({
              service: 'elasticloadbalancing',
              region,
              method: 'POST',
              path: '/',
              body: modifyParams.toString(),
            })
            console.log('✓ HTTP to HTTPS redirect configured!')
          }
        }

        // 9. Update CloudFront distribution with SSL certificate and domain aliases
        const cfDistId = resources.StackResourceSummaries.find((r: any) => r.LogicalResourceId === 'CloudFrontDistribution')?.PhysicalResourceId
        if (cfDistId) {
          console.log('  Updating CloudFront distribution with SSL certificate...')

          // Get current distribution config
          const getDistResult = await client.request({
            service: 'cloudfront',
            region: 'us-east-1', // CloudFront is always us-east-1
            method: 'GET',
            path: `/2020-05-31/distribution/${cfDistId}/config`,
          })

          // Get ETag for conditional update
          const etag = getDistResult._headers?.etag || getDistResult._headers?.ETag

          // Parse the distribution config
          const distConfig = getDistResult.DistributionConfig

          if (distConfig && etag) {
            // Update the config with aliases and SSL certificate
            distConfig.Aliases = {
              Quantity: sslDomains.length,
              Items: sslDomains,
            }
            distConfig.ViewerCertificate = {
              ACMCertificateArn: certResult.CertificateArn,
              SSLSupportMethod: 'sni-only',
              MinimumProtocolVersion: 'TLSv1.2_2021',
              CloudFrontDefaultCertificate: false,
            }

            // Convert config to XML for CloudFront API
            const xmlConfig = `<?xml version="1.0" encoding="UTF-8"?>
<DistributionConfig xmlns="http://cloudfront.amazonaws.com/doc/2020-05-31/">
  <CallerReference>${distConfig.CallerReference}</CallerReference>
  <Aliases>
    <Quantity>${sslDomains.length}</Quantity>
    <Items>
${sslDomains.map(d => `      <CNAME>${d}</CNAME>`).join('\n')}
    </Items>
  </Aliases>
  <DefaultRootObject>${distConfig.DefaultRootObject || 'index.html'}</DefaultRootObject>
  <Origins>
    <Quantity>${distConfig.Origins?.Quantity || 0}</Quantity>
    <Items>
${(distConfig.Origins?.Items || []).map((o: any) => `      <Origin>
        <Id>${o.Id}</Id>
        <DomainName>${o.DomainName}</DomainName>
        ${o.OriginPath ? `<OriginPath>${o.OriginPath}</OriginPath>` : '<OriginPath></OriginPath>'}
        ${o.S3OriginConfig ? `<S3OriginConfig><OriginAccessIdentity>${o.S3OriginConfig.OriginAccessIdentity || ''}</OriginAccessIdentity></S3OriginConfig>` : ''}
        ${o.CustomOriginConfig ? `<CustomOriginConfig>
          <HTTPPort>${o.CustomOriginConfig.HTTPPort}</HTTPPort>
          <HTTPSPort>${o.CustomOriginConfig.HTTPSPort}</HTTPSPort>
          <OriginProtocolPolicy>${o.CustomOriginConfig.OriginProtocolPolicy}</OriginProtocolPolicy>
          <OriginSslProtocols><Quantity>${o.CustomOriginConfig.OriginSslProtocols?.Quantity || 1}</Quantity><Items>${(o.CustomOriginConfig.OriginSslProtocols?.Items || ['TLSv1.2']).map((p: string) => `<SslProtocol>${p}</SslProtocol>`).join('')}</Items></OriginSslProtocols>
        </CustomOriginConfig>` : ''}
        ${o.OriginAccessControlId ? `<OriginAccessControlId>${o.OriginAccessControlId}</OriginAccessControlId>` : ''}
        <ConnectionAttempts>${o.ConnectionAttempts || 3}</ConnectionAttempts>
        <ConnectionTimeout>${o.ConnectionTimeout || 10}</ConnectionTimeout>
      </Origin>`).join('\n')}
    </Items>
  </Origins>
  <DefaultCacheBehavior>
    <TargetOriginId>${distConfig.DefaultCacheBehavior?.TargetOriginId}</TargetOriginId>
    <ViewerProtocolPolicy>${distConfig.DefaultCacheBehavior?.ViewerProtocolPolicy || 'redirect-to-https'}</ViewerProtocolPolicy>
    <AllowedMethods>
      <Quantity>${distConfig.DefaultCacheBehavior?.AllowedMethods?.Quantity || 3}</Quantity>
      <Items>${(distConfig.DefaultCacheBehavior?.AllowedMethods?.Items || ['GET', 'HEAD', 'OPTIONS']).map((m: string) => `<Method>${m}</Method>`).join('')}</Items>
      <CachedMethods>
        <Quantity>${distConfig.DefaultCacheBehavior?.AllowedMethods?.CachedMethods?.Quantity || 2}</Quantity>
        <Items>${(distConfig.DefaultCacheBehavior?.AllowedMethods?.CachedMethods?.Items || ['GET', 'HEAD']).map((m: string) => `<Method>${m}</Method>`).join('')}</Items>
      </CachedMethods>
    </AllowedMethods>
    <Compress>${distConfig.DefaultCacheBehavior?.Compress !== false}</Compress>
    <CachePolicyId>${distConfig.DefaultCacheBehavior?.CachePolicyId || '658327ea-f89d-4fab-a63d-7e88639e58f6'}</CachePolicyId>
    ${distConfig.DefaultCacheBehavior?.OriginRequestPolicyId ? `<OriginRequestPolicyId>${distConfig.DefaultCacheBehavior.OriginRequestPolicyId}</OriginRequestPolicyId>` : ''}
  </DefaultCacheBehavior>
  <CacheBehaviors>
    <Quantity>${distConfig.CacheBehaviors?.Quantity || 0}</Quantity>
    ${distConfig.CacheBehaviors?.Quantity > 0 ? `<Items>
${(distConfig.CacheBehaviors?.Items || []).map((cb: any) => `      <CacheBehavior>
        <PathPattern>${cb.PathPattern}</PathPattern>
        <TargetOriginId>${cb.TargetOriginId}</TargetOriginId>
        <ViewerProtocolPolicy>${cb.ViewerProtocolPolicy}</ViewerProtocolPolicy>
        <AllowedMethods>
          <Quantity>${cb.AllowedMethods?.Quantity || 3}</Quantity>
          <Items>${(cb.AllowedMethods?.Items || ['GET', 'HEAD', 'OPTIONS']).map((m: string) => `<Method>${m}</Method>`).join('')}</Items>
          <CachedMethods>
            <Quantity>${cb.AllowedMethods?.CachedMethods?.Quantity || 2}</Quantity>
            <Items>${(cb.AllowedMethods?.CachedMethods?.Items || ['GET', 'HEAD']).map((m: string) => `<Method>${m}</Method>`).join('')}</Items>
          </CachedMethods>
        </AllowedMethods>
        <Compress>${cb.Compress !== false}</Compress>
        <CachePolicyId>${cb.CachePolicyId}</CachePolicyId>
        ${cb.OriginRequestPolicyId ? `<OriginRequestPolicyId>${cb.OriginRequestPolicyId}</OriginRequestPolicyId>` : ''}
      </CacheBehavior>`).join('\n')}
    </Items>` : ''}
  </CacheBehaviors>
  <CustomErrorResponses>
    <Quantity>${distConfig.CustomErrorResponses?.Quantity || 0}</Quantity>
    ${distConfig.CustomErrorResponses?.Quantity > 0 ? `<Items>
${(distConfig.CustomErrorResponses?.Items || []).map((e: any) => `      <CustomErrorResponse>
        <ErrorCode>${e.ErrorCode}</ErrorCode>
        <ResponsePagePath>${e.ResponsePagePath}</ResponsePagePath>
        <ResponseCode>${e.ResponseCode}</ResponseCode>
        <ErrorCachingMinTTL>${e.ErrorCachingMinTTL}</ErrorCachingMinTTL>
      </CustomErrorResponse>`).join('\n')}
    </Items>` : ''}
  </CustomErrorResponses>
  <Comment>${distConfig.Comment || ''}</Comment>
  <PriceClass>${distConfig.PriceClass || 'PriceClass_100'}</PriceClass>
  <Enabled>${distConfig.Enabled !== false}</Enabled>
  <ViewerCertificate>
    <ACMCertificateArn>${certResult.CertificateArn}</ACMCertificateArn>
    <SSLSupportMethod>sni-only</SSLSupportMethod>
    <MinimumProtocolVersion>TLSv1.2_2021</MinimumProtocolVersion>
  </ViewerCertificate>
  <HttpVersion>${distConfig.HttpVersion || 'http2and3'}</HttpVersion>
  <IsIPV6Enabled>${distConfig.IsIPV6Enabled !== false}</IsIPV6Enabled>
</DistributionConfig>`

            await client.request({
              service: 'cloudfront',
              region: 'us-east-1',
              method: 'PUT',
              path: `/2020-05-31/distribution/${cfDistId}/config`,
              headers: {
                'Content-Type': 'application/xml',
                'If-Match': etag,
              },
              body: xmlConfig,
            })
            console.log('✓ CloudFront distribution updated with SSL certificate!')
          }
        }

        console.log('')
        console.log(`✓ SSL setup complete! https://${domain} should be accessible shortly.`)
        console.log('')
        return
      }

      if (c.Status === 'FAILED') {
        console.log('✗ Certificate validation failed!')
        return
      }

      await new Promise(r => setTimeout(r, 10000))
    }

    console.log('⚠ Certificate validation timed out. Please check AWS Console.')
  }
  catch (error: unknown) {
    console.log(`✗ DNS/SSL setup failed: ${getErrorMessage(error)}`)
    console.log('  You can manually set up DNS and SSL using ./buddy cloud:ssl')
  }
}

/**
 * Deploy the infrastructure stack using ts-cloud
 */
export async function deployStack(options: DeployStackOptions): Promise<void> {
  const { environment, region, waitForCompletion = true, verbose = false } = options

  const projectConfig = await getProjectConfig()
  const projectName = projectConfig.name
  const stackName = `${projectName}-cloud`

  if (verbose) console.log(`Deploying ${stackName} to ${region}...`)

  try {
    const { AWSCloudFormationClient } = await import('@stacksjs/ts-cloud')
    const cf = new AWSCloudFormationClient(region)

    // Check deployment mode from cloud config
    const cloudConfig = await getCloudConfig()
    const deploymentMode = cloudConfig?.infrastructure?.compute?.mode || cloudConfig?.mode || 'server'

    // Generate the template using InfrastructureGenerator
    if (verbose) console.log(`Generating CloudFormation template (${deploymentMode} mode)...`)

    const templateBody = await generateTemplate({
      environment,
      projectName,
    })

    // If template exceeds CloudFormation inline limit (51200 bytes), upload to S3
    const CF_INLINE_LIMIT = 51200
    let templateUrl: string | undefined
    if (Buffer.byteLength(templateBody, 'utf-8') > CF_INLINE_LIMIT) {
      if (verbose) console.log(`Template exceeds inline limit (${Buffer.byteLength(templateBody, 'utf-8')} bytes), uploading to S3...`)
      const { S3Client: S3, AWSClient } = await import('@stacksjs/ts-cloud')
      const s3 = new S3(region)
      const awsClient = new AWSClient()
      const templateBucket = `${projectName}-cf-templates-${region}`

      // Ensure the template bucket exists
      try {
        await awsClient.request({
          service: 's3',
          region,
          method: 'HEAD',
          path: `/${templateBucket}`,
          bucket: templateBucket,
        })
      } catch {
        // Bucket doesn't exist, create it
        const createBody = region === 'us-east-1'
          ? ''
          : `<CreateBucketConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><LocationConstraint>${region}</LocationConstraint></CreateBucketConfiguration>`
        await awsClient.request({
          service: 's3',
          region,
          method: 'PUT',
          path: `/${templateBucket}`,
          bucket: templateBucket,
          body: createBody || undefined,
        })
      }

      const templateKey = `${stackName}/template-${Date.now()}.json`
      await s3.putObject({
        bucket: templateBucket,
        key: templateKey,
        body: templateBody,
        contentType: 'application/json',
      })

      templateUrl = `https://${templateBucket}.s3.${region}.amazonaws.com/${templateKey}`
      if (verbose) console.log(`Template uploaded to: ${templateUrl}`)
    }

    // Helper to get the right template parameter for CF API calls
    const _templateParam = templateUrl
      ? { templateUrl }
      : { templateBody }

    // Check if stack exists
    let stackExists = false
    let _isUpdate = false
    try {
      const stack = (await cf.describeStacks({ stackName })).Stacks?.[0]
      if (stack && stack.StackStatus) {
        if (verbose) console.log(`Current status: ${formatResourceStatus(stack.StackStatus)}`)
        stackExists = true
        _isUpdate = true

        // If an operation is already in progress, wait for it to finish first
        if (stack.StackStatus.endsWith('_IN_PROGRESS')) {
          console.log(`Stack is busy (${stack.StackStatus}). Waiting for current operation to finish...`)
          const waitType = stack.StackStatus.startsWith('DELETE')
            ? 'stack-delete-complete' as const
            : stack.StackStatus.startsWith('CREATE')
              ? 'stack-create-complete' as const
              : 'stack-update-complete' as const
          try {
            await cf.waitForStack(stackName, waitType)
          } catch {
            // If wait fails, re-check status below
          }
          // Re-check stack state after waiting
          try {
            const refreshedStack = (await cf.describeStacks({ stackName })).Stacks?.[0]
            if (!refreshedStack || !refreshedStack.StackStatus) {
              stackExists = false
              _isUpdate = false
            } else {
              if (verbose) console.log(`Stack settled to: ${formatResourceStatus(refreshedStack.StackStatus)}`)
              // Re-evaluate with the settled status (fall through to checks below)
              stack.StackStatus = refreshedStack.StackStatus
            }
          } catch {
            stackExists = false
            _isUpdate = false
          }
        }

        // UPDATE_ROLLBACK_COMPLETE means a previous update failed but the stack
        // rolled back successfully -- it is safe to run another update.
        if (stack.StackStatus === 'UPDATE_ROLLBACK_COMPLETE') {
          console.log('Stack rolled back from a previous update. Re-deploying...')
          // stackExists stays true, _isUpdate stays true -- will run updateStack below
        }
        // DELETE_COMPLETE means the stack was fully deleted; treat as non-existent.
        else if (stack.StackStatus === 'DELETE_COMPLETE') {
          stackExists = false
          _isUpdate = false
        }
        // ROLLBACK_COMPLETE / CREATE_FAILED / ROLLBACK_FAILED mean the initial
        // creation failed. The only option is to delete and recreate.
        else if (
          stack.StackStatus === 'ROLLBACK_COMPLETE'
          || stack.StackStatus === 'ROLLBACK_FAILED'
          || stack.StackStatus === 'CREATE_FAILED'
        ) {
          console.log(`Stack is in ${stack.StackStatus} state. Deleting before recreating...`)
          await cf.deleteStack(stackName)
          await cf.waitForStack(stackName, 'stack-delete-complete')

          // Clean up any retained resources (S3 buckets with DeletionPolicy: Retain)
          console.log('Cleaning up retained resources...')
          try {
            const { S3Client } = await import('@stacksjs/ts-cloud')
            const s3 = new S3Client(region)

            // Calculate the bucket names that would have been created
            const accountId = await getAwsAccountId(region)
            const assetsBucketName = `${projectName}-${environment}-assets-${accountId}`
            const frontendBucketName = `${projectName}-${environment}-frontend-${accountId}`

            // Clean up assets bucket
            if (verbose) console.log(`  Checking bucket: ${assetsBucketName}`)
            try {
              await s3.emptyAndDeleteBucket(assetsBucketName)
              console.log(`✓ Deleted retained bucket: ${assetsBucketName}`)
            } catch (bucketError: any) {
              // Bucket might not exist, which is fine
              if (!bucketError.message?.includes('NoSuchBucket') && !bucketError.message?.includes('does not exist')) {
                console.log(`⚠ Could not delete assets bucket: ${bucketError.message}`)
              } else {
                if (verbose) console.log('  No retained assets bucket to clean up')
              }
            }

            // Clean up frontend bucket
            if (verbose) console.log(`  Checking bucket: ${frontendBucketName}`)
            try {
              await s3.emptyAndDeleteBucket(frontendBucketName)
              console.log(`✓ Deleted retained bucket: ${frontendBucketName}`)
            } catch (bucketError: any) {
              // Bucket might not exist, which is fine
              if (!bucketError.message?.includes('NoSuchBucket') && !bucketError.message?.includes('does not exist')) {
                console.log(`⚠ Could not delete frontend bucket: ${bucketError.message}`)
              } else {
                if (verbose) console.log('  No retained frontend bucket to clean up')
              }
            }
          } catch (cleanupError: any) {
            console.log(`⚠ Cleanup error: ${cleanupError.message}`)
          }

          stackExists = false
          _isUpdate = false
        }
      }
    }
    catch {
      // Stack doesn't exist
      stackExists = false
    }

    if (stackExists) {
      // Update existing stack
      console.log('Updating stack...')
      console.log('')
      try {
        // ts-cloud-core uses templateURL (not templateUrl)
        const updateParam = templateUrl
          ? { templateURL: templateUrl }
          : { templateBody }
        await cf.updateStack({
          stackName,
          ...updateParam,
          capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
          tags: [
            { Key: 'Environment', Value: environment },
            { Key: 'Project', Value: projectName },
            { Key: 'ManagedBy', Value: 'stacks' },
          ],
        })

        if (waitForCompletion) {
          // Print header for resource status table
          console.log(`  ${'Resource'.padEnd(35)} ${'Type'.padEnd(30)} Status`)
          console.log('  ' + '─'.repeat(85))

          await cf.waitForStack(stackName, 'stack-update-complete')
          console.log('')
        }
      }
      catch (error: unknown) {
        if (getErrorMessage(error)?.includes('No updates are to be performed')) {
          console.log('✓ Stack is up to date (no changes)')
        }
        else {
          throw error
        }
      }
    }
    else {
      // Before creating a new stack, clean up any retained resources from previous failed deployments
      console.log('Checking for retained resources...')
      try {
        const { S3Client } = await import('@stacksjs/ts-cloud')
        const s3 = new S3Client(region)

        // Calculate the bucket names that would be created
        const accountId = await getAwsAccountId(region)
        const assetsBucketName = `${projectName}-${environment}-assets-${accountId}`
        const frontendBucketName = `${projectName}-${environment}-frontend-${accountId}`

        // Clean up assets bucket
        if (verbose) console.log(`  Checking bucket: ${assetsBucketName}`)
        try {
          await s3.emptyAndDeleteBucket(assetsBucketName)
          console.log(`✓ Cleaned up existing bucket: ${assetsBucketName}`)
        } catch (bucketError: any) {
          // Bucket doesn't exist, which is fine
          if (!bucketError.message?.includes('NoSuchBucket') && !bucketError.message?.includes('does not exist')) {
            console.log(`⚠ Could not delete assets bucket: ${bucketError.message}`)
            // Don't fail deployment for cleanup issues
          } else {
            if (verbose) console.log('  No existing assets bucket to clean up')
          }
        }

        // Clean up frontend bucket
        if (verbose) console.log(`  Checking bucket: ${frontendBucketName}`)
        try {
          await s3.emptyAndDeleteBucket(frontendBucketName)
          console.log(`✓ Cleaned up existing bucket: ${frontendBucketName}`)
        } catch (bucketError: any) {
          // Bucket doesn't exist, which is fine
          if (!bucketError.message?.includes('NoSuchBucket') && !bucketError.message?.includes('does not exist')) {
            console.log(`⚠ Could not delete frontend bucket: ${bucketError.message}`)
            // Don't fail deployment for cleanup issues
          } else {
            if (verbose) console.log('  No existing frontend bucket to clean up')
          }
        }

        // Note: DNS records are managed by CloudFormation -- no pre-create cleanup needed
      } catch (cleanupError: any) {
        console.log(`⚠ Pre-deployment cleanup error: ${cleanupError.message}`)
        // Don't fail deployment for cleanup issues
      }

      // Create new stack
      console.log('Creating stack...')
      console.log('')
      // ts-cloud-core uses templateURL (not templateUrl)
      const createParam = templateUrl
        ? { templateURL: templateUrl }
        : { templateBody }
      const stackId = await cf.createStack({
        stackName,
        ...createParam,
        capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
        tags: [
          { Key: 'Environment', Value: environment },
          { Key: 'Project', Value: projectName },
          { Key: 'ManagedBy', Value: 'stacks' },
        ],
        onFailure: 'ROLLBACK',
        timeoutInMinutes: 30,
      })
      if (verbose) console.log(`Stack ID: ${stackId}`)

      if (waitForCompletion) {
        // Print header for resource status table
        console.log(`  ${'Resource'.padEnd(35)} ${'Type'.padEnd(30)} Status`)
        console.log('  ' + '─'.repeat(85))

        await cf.waitForStack(stackName, 'stack-create-complete')
        console.log('')
      }
    }

    // Get cloud config for domain info (reuse cloudConfig from above)
    const siteDomain = cloudConfig?.infrastructure?.dns?.domain || 'stacksjs.com'
    const sslConfig = cloudConfig?.infrastructure?.ssl || { enabled: true, domains: [] }
    const sslDomains = sslConfig.domains || [siteDomain, `www.${siteDomain}`]

    // Get stack outputs
    try {
      const stack = (await cf.describeStacks({ stackName })).Stacks?.[0]
      if (stack && stack.StackStatus) {
        // Parse outputs from stack description
        const outputs: Record<string, string> = {}
        for (const output of stack.Outputs || []) {
          if (output.OutputKey && output.OutputValue) {
            outputs[output.OutputKey] = output.OutputValue
          }
        }

        console.log('═══════════════════════════════════════════════════════════════════════════════════════')
        console.log('')
        console.log('  ✓ Infrastructure deployed successfully')
        console.log('')
        console.log(`    Stack:       ${stackName}`)
        console.log(`    Status:      ${stack.StackStatus}`)
        console.log(`    Domain:      https://${siteDomain}`)

        if (outputs.LoadBalancerDNS) {
          console.log(`    Load Balancer: ${outputs.LoadBalancerDNS}`)
        }
        if (outputs.WebServerPublicIP) {
          console.log(`    Server IP:   ${outputs.WebServerPublicIP}`)
        }
        if (outputs.AssetsBucketName && verbose) {
          console.log(`    Assets:      ${outputs.AssetsBucketName}`)
        }

        console.log('')
        console.log('═══════════════════════════════════════════════════════════════════════════════════════')
        console.log('')

        // Auto-setup DNS and SSL if configured
        if (sslConfig.enabled && cloudConfig?.infrastructure?.dns?.hostedZoneId && outputs.LoadBalancerDNS) {
          await setupDnsAndSsl({
            region,
            domain: siteDomain,
            sslDomains,
            hostedZoneId: cloudConfig.infrastructure.dns.hostedZoneId,
            albDnsName: outputs.LoadBalancerDNS,
            stackName,
          })
        }
        else if (!sslConfig.certificateArn && verbose) {
          console.log('  Next steps:')
          console.log('  1. DNS records need to be updated to point to the ALB')
          console.log('  2. SSL certificate needs to be requested and attached')
          console.log(`     Run: ./buddy cloud:ssl to set up SSL for ${siteDomain}`)
          console.log('')
        }
      }
    }
    catch {
      // Outputs might not be available yet
    }
  }
  catch (error: unknown) {
    console.error(`Stack deployment failed: ${getErrorMessage(error)}`)
    throw error
  }
}

/**
 * Deploy frontend assets to S3
 */
export async function deployFrontend(options: DeployFrontendOptions): Promise<void> {
  const { environment, region, buildDir } = options

  const projectConfig = await getProjectConfig()
  const projectName = projectConfig.name

  log.info(`Deploying frontend from ${buildDir} to ${environment} in ${region}...`)

  try {
    const { S3Client, AWSCloudFormationClient } = await import('@stacksjs/ts-cloud')

    const s3 = new S3Client(region)
    const cf = new AWSCloudFormationClient(region)

    // Get bucket name from stack outputs
    const stackName = `${projectName}-cloud`
    const stack = (await cf.describeStacks({ stackName })).Stacks?.[0]
    const bucketName = stack?.Outputs?.find((o: { OutputKey: string }) => o.OutputKey === 'AssetsBucketName')?.OutputValue

    if (!bucketName) {
      throw new Error('Assets bucket not found in stack outputs')
    }

    // Sync files to S3
    log.info(`Syncing ${buildDir} to s3://${bucketName}/...`)
    await s3.sync({
      source: buildDir,
      bucket: bucketName,
      delete: true,
      cacheControl: 'max-age=31536000',
    })

    log.success('Frontend deployment completed!')
  }
  catch (error: unknown) {
    log.error(`Frontend deployment failed: ${getErrorMessage(error)}`)
    throw error
  }
}

/**
 * Get deployment status and outputs
 */
export async function getDeploymentStatus(_options: { environment: string, region: string }): Promise<{
  status: string
  outputs: Record<string, string>
}> {
  const { environment, region } = _options
  const projectConfig = await getProjectConfig()
  const projectName = projectConfig.name
  const stackName = `${projectName}-cloud`

  const { AWSCloudFormationClient } = await import('@stacksjs/ts-cloud')
  const cf = new AWSCloudFormationClient(region)

  try {
    const stack = (await cf.describeStacks({ stackName })).Stacks?.[0]
    if (!stack || !stack.StackStatus) {
      return { status: 'NOT_FOUND', outputs: {} }
    }

    const outputs: Record<string, string> = {}
    for (const output of stack.Outputs || []) {
      if (output.OutputKey && output.OutputValue) {
        outputs[output.OutputKey] = output.OutputValue
      }
    }

    return {
      status: stack.StackStatus,
      outputs,
    }
  } catch {
    return { status: 'NOT_FOUND', outputs: {} }
  }
}

interface UndeployStackOptions {
  environment: string
  region: string
  verbose?: boolean
}

/**
 * Undeploy the infrastructure stack using ts-cloud with CDK-style status updates
 */
export async function undeployStack(options: UndeployStackOptions): Promise<void> {
  const { environment, region, verbose } = options

  const projectConfig = await getProjectConfig()
  const projectName = projectConfig.name
  const stackName = `${projectName}-cloud`

  console.log(`Undeploying ${stackName} from ${region}...`)
  console.log('')

  try {
    const { AWSCloudFormationClient, AWSClient } = await import('@stacksjs/ts-cloud')
    const cf = new AWSCloudFormationClient(region)

    // Check if stack exists
    let stackExists = false
    try {
      const stack = (await cf.describeStacks({ stackName })).Stacks?.[0]
      if (stack && stack.StackStatus) {
        console.log(`Current status: ${formatResourceStatus(stack.StackStatus)}`)
        stackExists = true

        // If an operation is in progress, wait for it to complete first
        if (stack.StackStatus.endsWith('_IN_PROGRESS')) {
          console.log(`Waiting for current operation (${stack.StackStatus}) to finish...`)
          const waitType = stack.StackStatus.startsWith('DELETE')
            ? 'stack-delete-complete' as const
            : stack.StackStatus.startsWith('CREATE')
              ? 'stack-create-complete' as const
              : 'stack-update-complete' as const
          try {
            await cf.waitForStack(stackName, waitType)
          } catch {
            // Ignore -- we re-check below
          }
          // Re-check after waiting
          try {
            const refreshedStack = (await cf.describeStacks({ stackName })).Stacks?.[0]
            if (!refreshedStack || !refreshedStack.StackStatus
              || refreshedStack.StackStatus === 'DELETE_COMPLETE') {
              console.log('Stack was already deleted during the in-progress operation.')
              return
            }
          } catch {
            console.log('Stack was already deleted during the in-progress operation.')
            return
          }
        }

        // Stack was already deleted
        if (stack.StackStatus === 'DELETE_COMPLETE') {
          stackExists = false
        }
      }
    }
    catch {
      stackExists = false
    }

    if (!stackExists) {
      console.log(`Stack ${stackName} does not exist. Nothing to undeploy.`)
      return
    }

    // Clean up any HTTPS listeners before deletion to avoid DELETE_FAILED
    if (verbose) console.log('Checking for resources to clean up before deletion...')
    try {
      const client = new AWSClient()

      // Get ALB from stack resources using AWSCloudFormationClient
      const { AWSCloudFormationClient: AwsCfn } = await import('@stacksjs/ts-cloud')
      const awsCfn = new AwsCfn(region)
      const resourcesResult = await awsCfn.listStackResources(stackName)
      const resources = resourcesResult.StackResourceSummaries || []

      const albResource = resources.find((r: any) => r.LogicalResourceId === 'ApplicationLoadBalancer')

      if (albResource?.PhysicalResourceId) {
        const albArn = albResource.PhysicalResourceId

        // Get all listeners
        const listParams = {
          Action: 'DescribeListeners',
          LoadBalancerArn: albArn,
          Version: '2015-12-01',
        }

        const listResult = await client.request({
          service: 'elasticloadbalancing',
          region,
          method: 'POST',
          path: '/',
          body: new URLSearchParams(listParams as any).toString(),
        })

        const listeners = listResult?.DescribeListenersResult?.Listeners?.member
          || listResult?.DescribeListenersResponse?.DescribeListenersResult?.Listeners?.member
        const listenerList = Array.isArray(listeners) ? listeners : listeners ? [listeners] : []

        // Delete any HTTPS listeners (manually added, not part of stack)
        let deletedListeners = 0
        for (const listener of listenerList) {
          if (listener.Protocol === 'HTTPS') {
            if (verbose) console.log(`  Removing HTTPS listener on port ${listener.Port}...`)
            const deleteParams = {
              Action: 'DeleteListener',
              ListenerArn: listener.ListenerArn,
              Version: '2015-12-01',
            }

            await client.request({
              service: 'elasticloadbalancing',
              region,
              method: 'POST',
              path: '/',
              body: new URLSearchParams(deleteParams as any).toString(),
            })
            deletedListeners++
          }
        }

        if (deletedListeners > 0 && verbose) {
          console.log(`✓ Cleaned up ${deletedListeners} HTTPS listener(s)`)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
    }
    catch (cleanupError: any) {
      if (verbose) {
        console.log(`Warning: ${cleanupError.message}`)
      }
    }

    // Initiate stack deletion
    console.log('Deleting stack...')
    console.log('')

    await cf.deleteStack(stackName)

    // Print header for resource status table
    console.log(`  ${'Resource'.padEnd(35)} ${'Type'.padEnd(30)} Status`)
    console.log('  ' + '─'.repeat(85))

    // Wait for deletion with progress callback - only show DELETE events
    await cf.waitForStack(stackName, 'stack-delete-complete')

    // Clean up any retained resources (S3 buckets with DeletionPolicy: Retain)
    try {
      const { S3Client } = await import('@stacksjs/ts-cloud')
      const s3 = new S3Client(region)

      // Calculate the bucket names that would have been created
      const accountId = await getAwsAccountId(region)
      const assetsBucketName = `${projectConfig.name}-${environment}-assets-${accountId}`
      const frontendBucketName = `${projectConfig.name}-${environment}-frontend-${accountId}`

      console.log(`Cleaning up retained buckets...`)

      // Try to delete the assets bucket if it exists
      try {
        await s3.emptyAndDeleteBucket(assetsBucketName)
        console.log(`✓ Assets bucket deleted successfully`)
      } catch (bucketError: any) {
        // Bucket might not exist, which is fine
        if (!bucketError.message?.includes('NoSuchBucket') && !bucketError.message?.includes('does not exist')) {
          console.log(`⚠ Could not delete assets bucket: ${bucketError.message}`)
        } else {
          console.log(`✓ No retained assets bucket to clean up`)
        }
      }

      // Try to delete the frontend bucket if it exists
      try {
        await s3.emptyAndDeleteBucket(frontendBucketName)
        console.log(`✓ Frontend bucket deleted successfully`)
      } catch (bucketError: any) {
        // Bucket might not exist, which is fine
        if (!bucketError.message?.includes('NoSuchBucket') && !bucketError.message?.includes('does not exist')) {
          console.log(`⚠ Could not delete frontend bucket: ${bucketError.message}`)
        } else {
          console.log(`✓ No retained frontend bucket to clean up`)
        }
      }
    } catch (cleanupError: any) {
      console.log(`⚠ Cleanup error: ${cleanupError.message}`)
    }

    console.log('')
    console.log('═══════════════════════════════════════════════════════════════════════════════════════')
    console.log('')
    console.log('  ✓ Infrastructure removed successfully')
    console.log('')
    console.log(`    Stack:       ${stackName}`)
    console.log(`    Environment: ${environment}`)
    console.log(`    Region:      ${region}`)
    console.log('')
    console.log('═══════════════════════════════════════════════════════════════════════════════════════')
    console.log('')
  }
  catch (error: unknown) {
    const errorStr = String(getErrorMessage(error) || error)

    // Handle stack doesn't exist
    if (errorStr.includes('does not exist')) {
      console.log('')
      console.log('✓ Stack already deleted or does not exist.')
      return
    }

    // Handle DELETE_FAILED - need to retain some resources
    if ((error as { code?: string }).code === 'DELETE_FAILED' || errorStr.includes('DELETE_FAILED')) {
      console.log('')
      console.log('Some resources could not be deleted automatically')
      console.log('Identifying resources to retain...')

      const { AWSCloudFormationClient: AwsCfnRetry } = await import('@stacksjs/ts-cloud')
      const awsCfnRetry = new AwsCfnRetry(region)

      try {
        const resourcesResult = await awsCfnRetry.listStackResources(stackName)
        const resources = resourcesResult.StackResourceSummaries || []
        const failedResources = resources
          .filter((r: any) => r.ResourceStatus === 'DELETE_FAILED')
          .map((r: any) => r.LogicalResourceId)

        if (failedResources.length > 0) {
          console.log(`Retaining ${failedResources.length} resource(s):`)
          failedResources.forEach((r: string) => console.log(`  - ${r}`))
          console.log('')

          // Retry with retained resources
          console.log('Retrying deletion with retained resources...')
          await awsCfnRetry.deleteStack(stackName, undefined, failedResources)
          const { AWSCloudFormationClient: CfRetry } = await import('@stacksjs/ts-cloud')
          const cfRetry = new CfRetry(region)
          await cfRetry.waitForStack(stackName, 'stack-delete-complete')

          console.log('')
          console.log('✓ Stack removed (with retained resources)')
          console.log('')
          console.log('Note: Some resources were retained and may need manual cleanup.')
          console.log('Run `./buddy cloud:cleanup` to clean up remaining resources.')
          return
        }
      }
      catch (retryError: any) {
        const retryErrorStr = String(retryError.message || retryError)
        if (retryErrorStr.includes('does not exist')) {
          console.log('')
          console.log('✓ Stack deleted successfully!')
          return
        }
        throw retryError
      }
    }

    console.error(`Stack deletion failed: ${getErrorMessage(error)}`)
    throw error
  }
}
