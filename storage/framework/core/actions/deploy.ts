/**
 * ts-cloud deployment functions
 * Creates real AWS infrastructure for Stacks deployments
 */
import process from 'node:process'
import { log } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'
import type { CloudConfig } from '@ts-cloud/types'

// Load cloud config lazily to avoid import issues
async function getCloudConfig(): Promise<CloudConfig | null> {
  try {
    const cloudConfig = await import('../../../../../config/cloud')
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

interface DeployStackOptions {
  environment: string
  region: string
  waitForCompletion?: boolean
}

interface DeployFrontendOptions {
  environment: string
  region: string
  buildDir: string
}

/**
 * Generate CloudFormation template for Stacks infrastructure
 * Supports: single instance, multi-instance with ASG, mixed instance types, ALB
 */
async function generateStacksTemplate(options: {
  environment: string
  projectName: string
  domain?: string
}): Promise<string> {
  const { environment, projectName, domain } = options
  const stackSlug = `${projectName}-${environment}`

  // Load cloud config for compute settings
  const cloudConfig = await getCloudConfig()
  const siteDomain = domain || cloudConfig?.infrastructure?.dns?.domain || 'stacksjs.org'
  const sslConfig = cloudConfig?.infrastructure?.ssl || { enabled: true, provider: 'acm' }
  const loadBalancerConfig = cloudConfig?.infrastructure?.loadBalancer || { enabled: true }
  const computeConfig = cloudConfig?.infrastructure?.compute || { instances: 1, size: 'micro' }

  // Compute configuration - using streamlined provider-agnostic API
  const instanceCount = (computeConfig as any).instances || 1
  const instanceSize = (computeConfig as any).size || 'micro'
  const instanceType = mapSizeToAwsInstanceType(instanceSize)
  const fleet = (computeConfig as any).fleet || []
  const useMixedInstances = fleet.length > 0
  const useAutoScaling = instanceCount > 1 || !!(computeConfig as any).autoScaling || useMixedInstances
  const autoScalingConfig = (computeConfig as any).autoScaling || {
    min: 1,
    max: instanceCount,
    desired: instanceCount,
    scaleUpThreshold: 70,
    scaleDownThreshold: 30,
    cooldown: 300,
  }

  // Disk configuration - using streamlined provider-agnostic API
  const diskConfig = (computeConfig as any).disk || { size: 20, type: 'ssd', encrypted: true }
  const diskSize = diskConfig.size || 20
  const diskType = mapDiskTypeToAwsVolumeType(diskConfig.type || 'ssd')
  const diskEncrypted = diskConfig.encrypted !== false

  // Mixed instances/spot policy configuration - using streamlined API
  const spotConfig = (computeConfig as any).spotConfig || {}
  const onDemandBaseCapacity = spotConfig.baseCapacity ?? 1
  const onDemandPercentageAboveBase = spotConfig.onDemandPercentage ?? 100
  const spotAllocationStrategy = spotConfig.strategy || 'capacity-optimized'

  // Auto-enable load balancer when multiple instances
  const useLoadBalancer = instanceCount > 1 || useMixedInstances || loadBalancerConfig.enabled !== false
  const useLetsEncrypt = !useLoadBalancer || sslConfig.provider === 'letsencrypt'
  const letsEncryptEmail = sslConfig.letsEncrypt?.email || `admin@${siteDomain}`

  // ACM certificate ARN (only used when useLoadBalancer && !useLetsEncrypt)
  const certificateArn = sslConfig.certificateArn || ''

  log.info(`  Compute: ${useMixedInstances ? 'mixed fleet' : `${instanceCount} x ${instanceSize} (${instanceType})`}`)
  log.info(`  Auto Scaling: ${useAutoScaling ? 'enabled' : 'disabled'}`)
  log.info(`  Load Balancer: ${useLoadBalancer ? 'enabled' : 'disabled'}`)

  // Generate Let's Encrypt setup script for UserData
  function generateLetsEncryptSetup(): string {
    if (!useLetsEncrypt) return ''

    const domains = sslConfig.domains || [siteDomain, `www.${siteDomain}`]
    const domainFlags = domains.map((d: string) => `-d ${d}`).join(' ')

    return `
# Let's Encrypt Certificate Setup
dnf install -y certbot python3-certbot-dns-route53
certbot certonly --dns-route53 --non-interactive --agree-tos --email ${letsEncryptEmail} ${domainFlags}
PRIMARY_DOMAIN="${domains[0]}"
CERT_PATH="/etc/letsencrypt/live/\${PRIMARY_DOMAIN}"
if [ -f "\${CERT_PATH}/fullchain.pem" ]; then
  mkdir -p /etc/ssl/stacks
  ln -sf \${CERT_PATH}/fullchain.pem /etc/ssl/stacks/fullchain.pem
  ln -sf \${CERT_PATH}/privkey.pem /etc/ssl/stacks/privkey.pem
fi
`
  }

  // Generate the UserData script for EC2 instances
  function getUserDataScript(): string {
    return `#!/bin/bash
set -ex
export HOME=/root
dnf update -y
dnf groupinstall -y "Development Tools"
dnf install -y git unzip
export BUN_INSTALL="/root/.bun"
curl -fsSL https://bun.sh/install | bash
echo 'export BUN_INSTALL="/root/.bun"' >> /root/.bashrc
echo 'export PATH="/root/.bun/bin:$PATH"' >> /root/.bashrc
export PATH="/root/.bun/bin:$PATH"
mkdir -p /var/www
cd /var/www
git clone --depth 1 https://github.com/stacksjs/stacks.git app
cd app
cat > .env << 'ENVEOF'
APP_ENV=production
APP_URL=https://\${DomainName}
PORT=80
DEBUG=false
ENVEOF
cat > server-prod.ts << 'SERVEREOF'
const server = Bun.serve({
  port: process.env.PORT || 80,
  development: false,
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' }), { headers: { 'Content-Type': 'application/json' } })
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      try {
        const file = Bun.file('./resources/views/index.stx')
        if (await file.exists()) {
          return new Response(file, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
        }
      } catch (e) {}
    }
    return new Response(JSON.stringify({ message: 'Welcome to Stacks API!', path: url.pathname, method: request.method, timestamp: new Date().toISOString() }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
  }
})
console.log('Stacks Server running at http://localhost:' + server.port)
SERVEREOF
cat > /etc/systemd/system/stacks.service << 'SERVICEEOF'
[Unit]
Description=Stacks Bun Server
After=network.target
[Service]
Type=simple
User=root
WorkingDirectory=/var/www/app
Environment="PATH=/root/.bun/bin:/usr/local/bin:/usr/bin:/bin"
Environment="HOME=/root"
Environment="APP_ENV=production"
Environment="PORT=80"
ExecStart=/root/.bun/bin/bun run server-prod.ts
Restart=always
RestartSec=10
[Install]
WantedBy=multi-user.target
SERVICEEOF
${generateLetsEncryptSetup()}
systemctl daemon-reload
systemctl enable stacks
systemctl start stacks
echo "Setup complete!"
`
  }

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
    // IAM Role for EC2
    EC2Role: {
      Type: 'AWS::IAM::Role',
      Properties: {
        AssumeRolePolicyDocument: {
          Version: '2012-10-17',
          Statement: [{ Effect: 'Allow', Principal: { Service: 'ec2.amazonaws.com' }, Action: 'sts:AssumeRole' }],
        },
        ManagedPolicyArns: [
          'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore',
          'arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy',
          'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess',
          ...(useLetsEncrypt ? ['arn:aws:iam::aws:policy/AmazonRoute53FullAccess'] : []),
        ],
      },
    },
    EC2InstanceProfile: {
      Type: 'AWS::IAM::InstanceProfile',
      Properties: { Roles: [{ Ref: 'EC2Role' }] },
    },
    // S3 Bucket for assets
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
  }

  // Add load balancer resources if using ALB
  if (useLoadBalancer) {
    resources.ALBSecurityGroup = {
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
    }
    resources.WebServerSecurityGroup = {
      Type: 'AWS::EC2::SecurityGroup',
      Properties: {
        GroupDescription: 'Security group for Stacks web server',
        VpcId: { Ref: 'VPC' },
        SecurityGroupIngress: [
          { IpProtocol: 'tcp', FromPort: 80, ToPort: 80, SourceSecurityGroupId: { Ref: 'ALBSecurityGroup' } },
          { IpProtocol: 'tcp', FromPort: 22, ToPort: 22, CidrIp: '0.0.0.0/0' },
        ],
        SecurityGroupEgress: [{ IpProtocol: '-1', CidrIp: '0.0.0.0/0' }],
        Tags: [{ Key: 'Name', Value: `${stackSlug}-web-sg` }, { Key: 'Environment', Value: environment }],
      },
    }
    resources.ApplicationLoadBalancer = {
      Type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
      DependsOn: 'AttachGateway',
      Properties: {
        Name: `${stackSlug}-alb`,
        Type: 'application',
        Scheme: 'internet-facing',
        SecurityGroups: [{ Ref: 'ALBSecurityGroup' }],
        Subnets: [{ Ref: 'PublicSubnet1' }, { Ref: 'PublicSubnet2' }],
        Tags: [{ Key: 'Name', Value: `${stackSlug}-alb` }, { Key: 'Environment', Value: environment }],
      },
    }
    resources.WebTargetGroup = {
      Type: 'AWS::ElasticLoadBalancingV2::TargetGroup',
      Properties: {
        Name: `${stackSlug}-tg`,
        Port: 80,
        Protocol: 'HTTP',
        VpcId: { Ref: 'VPC' },
        TargetType: 'instance',
        HealthCheckPath: '/health',
        HealthCheckIntervalSeconds: 30,
        HealthyThresholdCount: 2,
        UnhealthyThresholdCount: 5,
        ...(useAutoScaling ? {} : { Targets: [{ Id: { Ref: 'WebServer' }, Port: 80 }] }),
        Tags: [{ Key: 'Environment', Value: environment }],
      },
    }
    if (certificateArn) {
      resources.HTTPSListener = {
        Type: 'AWS::ElasticLoadBalancingV2::Listener',
        Properties: {
          LoadBalancerArn: { Ref: 'ApplicationLoadBalancer' },
          Port: 443,
          Protocol: 'HTTPS',
          Certificates: [{ CertificateArn: certificateArn }],
          DefaultActions: [{ Type: 'forward', TargetGroupArn: { Ref: 'WebTargetGroup' } }],
        },
      }
      resources.HTTPListener = {
        Type: 'AWS::ElasticLoadBalancingV2::Listener',
        Properties: {
          LoadBalancerArn: { Ref: 'ApplicationLoadBalancer' },
          Port: 80,
          Protocol: 'HTTP',
          DefaultActions: [{ Type: 'redirect', RedirectConfig: { Protocol: 'HTTPS', Port: '443', StatusCode: 'HTTP_301' } }],
        },
      }
    } else {
      resources.HTTPListener = {
        Type: 'AWS::ElasticLoadBalancingV2::Listener',
        Properties: {
          LoadBalancerArn: { Ref: 'ApplicationLoadBalancer' },
          Port: 80,
          Protocol: 'HTTP',
          DefaultActions: [{ Type: 'forward', TargetGroupArn: { Ref: 'WebTargetGroup' } }],
        },
      }
    }
  } else {
    // Direct access security group (no ALB)
    resources.WebServerSecurityGroup = {
      Type: 'AWS::EC2::SecurityGroup',
      Properties: {
        GroupDescription: 'Security group for Stacks web server',
        VpcId: { Ref: 'VPC' },
        SecurityGroupIngress: [
          { IpProtocol: 'tcp', FromPort: 80, ToPort: 80, CidrIp: '0.0.0.0/0' },
          { IpProtocol: 'tcp', FromPort: 443, ToPort: 443, CidrIp: '0.0.0.0/0' },
          { IpProtocol: 'tcp', FromPort: 22, ToPort: 22, CidrIp: '0.0.0.0/0' },
        ],
        SecurityGroupEgress: [{ IpProtocol: '-1', CidrIp: '0.0.0.0/0' }],
        Tags: [{ Key: 'Name', Value: `${stackSlug}-web-sg` }, { Key: 'Environment', Value: environment }],
      },
    }
  }

  // Add ASG resources or single EC2 instance
  if (useAutoScaling) {
    resources.LaunchTemplate = {
      Type: 'AWS::EC2::LaunchTemplate',
      Properties: {
        LaunchTemplateName: `${stackSlug}-launch-template`,
        LaunchTemplateData: {
          ImageId: '{{resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64}}',
          InstanceType: instanceType,
          SecurityGroupIds: [{ Ref: 'WebServerSecurityGroup' }],
          IamInstanceProfile: { Arn: { 'Fn::GetAtt': ['EC2InstanceProfile', 'Arn'] } },
          BlockDeviceMappings: [{ DeviceName: '/dev/xvda', Ebs: { VolumeSize: diskSize, VolumeType: diskType, Encrypted: diskEncrypted } }],
          TagSpecifications: [{ ResourceType: 'instance', Tags: [{ Key: 'Name', Value: `${stackSlug}-web-server` }, { Key: 'Environment', Value: environment }] }],
          UserData: { 'Fn::Base64': { 'Fn::Sub': getUserDataScript() } },
        },
      },
    }
    resources.AutoScalingGroup = {
      Type: 'AWS::AutoScaling::AutoScalingGroup',
      DependsOn: 'AttachGateway',
      Properties: {
        AutoScalingGroupName: `${stackSlug}-asg`,
        ...(useMixedInstances ? {
          MixedInstancesPolicy: {
            LaunchTemplate: {
              LaunchTemplateSpecification: { LaunchTemplateId: { Ref: 'LaunchTemplate' }, Version: { 'Fn::GetAtt': ['LaunchTemplate', 'LatestVersionNumber'] } },
              Overrides: fleet.map((inst: any) => ({ InstanceType: mapSizeToAwsInstanceType(inst.size), WeightedCapacity: String(inst.weight || 1) })),
            },
            InstancesDistribution: {
              OnDemandBaseCapacity: onDemandBaseCapacity,
              OnDemandPercentageAboveBaseCapacity: onDemandPercentageAboveBase,
              SpotAllocationStrategy: spotAllocationStrategy,
            },
          },
        } : {
          LaunchTemplate: { LaunchTemplateId: { Ref: 'LaunchTemplate' }, Version: { 'Fn::GetAtt': ['LaunchTemplate', 'LatestVersionNumber'] } },
        }),
        MinSize: String(autoScalingConfig.min || 1),
        MaxSize: String(autoScalingConfig.max || instanceCount),
        DesiredCapacity: String(autoScalingConfig.desired || instanceCount),
        VPCZoneIdentifier: [{ Ref: 'PublicSubnet1' }, { Ref: 'PublicSubnet2' }],
        TargetGroupARNs: useLoadBalancer ? [{ Ref: 'WebTargetGroup' }] : [],
        HealthCheckType: useLoadBalancer ? 'ELB' : 'EC2',
        HealthCheckGracePeriod: 300,
        Tags: [{ Key: 'Name', Value: `${stackSlug}-web-server`, PropagateAtLaunch: true }, { Key: 'Environment', Value: environment, PropagateAtLaunch: true }],
      },
    }
    resources.ScaleUpPolicy = {
      Type: 'AWS::AutoScaling::ScalingPolicy',
      Properties: {
        AutoScalingGroupName: { Ref: 'AutoScalingGroup' },
        PolicyType: 'TargetTrackingScaling',
        TargetTrackingConfiguration: { PredefinedMetricSpecification: { PredefinedMetricType: 'ASGAverageCPUUtilization' }, TargetValue: autoScalingConfig.scaleUpThreshold || 70 },
      },
    }
  } else {
    // Single EC2 instance
    resources.WebServer = {
      Type: 'AWS::EC2::Instance',
      DependsOn: 'AttachGateway',
      Properties: {
        ImageId: '{{resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64}}',
        InstanceType: instanceType,
        SubnetId: { Ref: 'PublicSubnet1' },
        SecurityGroupIds: [{ Ref: 'WebServerSecurityGroup' }],
        IamInstanceProfile: { Ref: 'EC2InstanceProfile' },
        UserData: { 'Fn::Base64': { 'Fn::Sub': getUserDataScript() } },
        Tags: [{ Key: 'Name', Value: `${stackSlug}-web-server` }, { Key: 'Environment', Value: environment }],
      },
    }
    if (!useLoadBalancer) {
      resources.WebServerEIP = {
        Type: 'AWS::EC2::EIP',
        DependsOn: 'AttachGateway',
        Properties: { Domain: 'vpc', InstanceId: { Ref: 'WebServer' }, Tags: [{ Key: 'Name', Value: `${stackSlug}-web-eip` }, { Key: 'Environment', Value: environment }] },
      }
    }
  }

  // Build outputs
  const outputs: Record<string, any> = {
    VpcId: { Description: 'VPC ID', Value: { Ref: 'VPC' }, Export: { Name: { 'Fn::Sub': '${AWS::StackName}-VpcId' } } },
    AssetsBucketName: { Description: 'S3 bucket for static assets', Value: { Ref: 'AssetsBucket' }, Export: { Name: { 'Fn::Sub': '${AWS::StackName}-AssetsBucket' } } },
  }

  if (useLoadBalancer) {
    outputs.LoadBalancerDNS = { Description: 'ALB DNS Name', Value: { 'Fn::GetAtt': ['ApplicationLoadBalancer', 'DNSName'] } }
    outputs.ApplicationURL = { Description: 'URL to access the application', Value: { 'Fn::Sub': 'http://${ApplicationLoadBalancer.DNSName}' } }
  } else if (!useAutoScaling) {
    outputs.WebServerPublicIP = { Description: 'Public IP of the web server', Value: { Ref: 'WebServerEIP' }, Export: { Name: { 'Fn::Sub': '${AWS::StackName}-WebServerIP' } } }
    outputs.ApplicationURL = { Description: 'URL to access the application', Value: { 'Fn::Sub': 'http://${WebServerEIP}' } }
  }

  const template = {
    AWSTemplateFormatVersion: '2010-09-09',
    Description: `Stacks Cloud Infrastructure for ${projectName} (${environment})`,
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
 */
function createProgressCallback(): (event: {
  resourceId: string
  resourceType: string
  status: string
  reason?: string
  timestamp: string
}) => void {
  const maxIdLength = 35
  const maxTypeLength = 30

  return (event) => {
    const resourceId = event.resourceId.padEnd(maxIdLength).substring(0, maxIdLength)
    const resourceType = getShortResourceType(event.resourceType).padEnd(maxTypeLength).substring(0, maxTypeLength)
    const status = formatResourceStatus(event.status)

    // Format: ResourceId | ResourceType | Status
    const line = `  ${resourceId} ${resourceType} ${status}`
    console.log(line)

    // Show reason for failures
    if (event.reason && (event.status.includes('FAILED') || event.status.includes('ROLLBACK'))) {
      console.log(`    └─ ${event.reason}`)
    }
  }
}

/**
 * Setup DNS records and SSL certificate after deployment
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

  log.info('')
  log.info('Setting up DNS and SSL...')

  try {
    const { Route53Client, ACMClient, AWSClient } = await import('ts-cloud/aws')
    const r53 = new Route53Client(region)
    const acm = new ACMClient(region)
    const client = new AWSClient()

    // ALB hosted zone ID for us-east-1 (standard for all ALBs in this region)
    const albHostedZoneId = 'Z35SXDOTRQ7X7K'

    // 1. Update DNS records to point to ALB
    log.info(`  Updating DNS records for ${domain}...`)
    const dnsChanges = sslDomains.map((d: string) => ({
      Action: 'UPSERT' as const,
      ResourceRecordSet: {
        Name: d,
        Type: 'A' as const,
        AliasTarget: {
          HostedZoneId: albHostedZoneId,
          DNSName: `dualstack.${albDnsName}`,
          EvaluateTargetHealth: true,
        },
      },
    }))

    await r53.changeResourceRecordSets({
      HostedZoneId: hostedZoneId,
      ChangeBatch: {
        Comment: `Point ${domain} to ALB`,
        Changes: dnsChanges,
      },
    })
    log.success(`  DNS records updated for: ${sslDomains.join(', ')}`)

    // 2. Request SSL certificate
    log.info(`  Requesting SSL certificate for ${domain}...`)
    const certResult = await acm.requestCertificate({
      DomainName: sslDomains[0],
      SubjectAlternativeNames: sslDomains.length > 1 ? sslDomains.slice(1) : undefined,
      ValidationMethod: 'DNS',
    })
    log.info(`  Certificate ARN: ${certResult.CertificateArn}`)

    // 3. Wait for validation options
    await new Promise(r => setTimeout(r, 5000))
    const cert = await acm.describeCertificate({ CertificateArn: certResult.CertificateArn })

    // 4. Add DNS validation records
    log.info('  Adding DNS validation records...')
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
    log.success('  Validation records added')

    // 5. Wait for certificate validation
    log.info('  Waiting for certificate validation (this may take 1-5 minutes)...')
    for (let i = 0; i < 30; i++) {
      const c = await acm.describeCertificate({ CertificateArn: certResult.CertificateArn })
      if (c.Status === 'ISSUED') {
        log.success('  Certificate issued!')

        // 6. Get ALB and Target Group ARN from stack
        const { CloudFormationClient } = await import('ts-cloud/aws')
        const cf = new CloudFormationClient(region)
        const resources = await cf.listStackResources(stackName)
        const albArn = resources.StackResourceSummaries.find((r: any) => r.LogicalResourceId === 'ApplicationLoadBalancer')?.PhysicalResourceId
        const tgArn = resources.StackResourceSummaries.find((r: any) => r.LogicalResourceId === 'WebTargetGroup')?.PhysicalResourceId

        if (albArn && tgArn) {
          // 7. Create HTTPS listener
          log.info('  Creating HTTPS listener...')
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
          log.success('  HTTPS listener created!')

          // 8. Update HTTP listener to redirect to HTTPS
          log.info('  Configuring HTTP to HTTPS redirect...')
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
            log.success('  HTTP to HTTPS redirect configured!')
          }
        }

        log.info('')
        log.success(`SSL setup complete! https://${domain} should be accessible shortly.`)
        log.info('')
        return
      }

      if (c.Status === 'FAILED') {
        log.error('  Certificate validation failed!')
        return
      }

      await new Promise(r => setTimeout(r, 10000))
    }

    log.warn('  Certificate validation timed out. Please check AWS Console.')
  }
  catch (error: any) {
    log.error(`DNS/SSL setup failed: ${error.message}`)
    log.info('  You can manually set up DNS and SSL using ./buddy cloud:ssl')
  }
}

/**
 * Deploy the infrastructure stack using ts-cloud
 */
export async function deployStack(options: DeployStackOptions): Promise<void> {
  const { environment, region, waitForCompletion = true } = options

  const projectConfig = await getProjectConfig()
  const projectName = projectConfig.name
  const stackName = `stacks-cloud-${environment}`

  log.info(`Deploying infrastructure to ${environment} in ${region}...`)

  try {
    const { CloudFormationClient } = await import('ts-cloud/aws')
    const cf = new CloudFormationClient(region)

    // Generate the template (reads from config/cloud.ts)
    log.info('Generating CloudFormation template...')
    const templateBody = await generateStacksTemplate({
      environment,
      projectName,
    })

    // Check if stack exists
    let stackExists = false
    try {
      const describeResult = await cf.describeStacks({ stackName })
      if (describeResult.Stacks && describeResult.Stacks.length > 0) {
        const stack = describeResult.Stacks[0]
        log.info(`Stack ${stackName} exists with status: ${stack.StackStatus}`)
        stackExists = true

        // If stack is in a failed or rollback state, delete it first
        if (stack.StackStatus.includes('ROLLBACK') || stack.StackStatus.includes('FAILED')) {
          log.info(`Stack is in ${stack.StackStatus} state. Deleting...`)
          await cf.deleteStack(stackName)
          await cf.waitForStackWithProgress(stackName, 'stack-delete-complete', createProgressCallback())
          stackExists = false
        }
      }
    }
    catch {
      // Stack doesn't exist
      stackExists = false
    }

    if (stackExists) {
      // Update existing stack
      log.info('Updating existing stack...')
      try {
        await cf.updateStack({
          stackName,
          templateBody,
          capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
        })

        if (waitForCompletion) {
          log.info('Waiting for stack update to complete...')
          log.info('')
          await cf.waitForStackWithProgress(stackName, 'stack-update-complete', createProgressCallback())
          log.info('')
        }
      }
      catch (error: any) {
        if (error.message?.includes('No updates are to be performed')) {
          log.info('No updates needed - stack is up to date')
        }
        else {
          throw error
        }
      }
    }
    else {
      // Create new stack
      log.info('Creating new stack...')
      const result = await cf.createStack({
        stackName,
        templateBody,
        capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
        onFailure: 'ROLLBACK',
        timeoutInMinutes: 15,
      })
      log.info(`Stack creation initiated: ${result.StackId}`)

      if (waitForCompletion) {
        log.info('Waiting for stack creation to complete (this may take 5-10 minutes)...')
        log.info('')
        await cf.waitForStackWithProgress(stackName, 'stack-create-complete', createProgressCallback())
        log.info('')
      }
    }

    // Get cloud config for domain info
    const cloudConfig = await getCloudConfig()
    const siteDomain = cloudConfig?.infrastructure?.dns?.domain || 'stacksjs.org'
    const sslConfig = cloudConfig?.infrastructure?.ssl || { enabled: true, domains: [] }
    const sslDomains = sslConfig.domains || [siteDomain, `www.${siteDomain}`]

    // Get stack outputs
    const outputResult = await cf.describeStacks({ stackName })
    if (outputResult.Stacks && outputResult.Stacks.length > 0) {
      const stack = outputResult.Stacks[0]
      log.success(`Stack ${stackName} deployed successfully!`)
      log.info(`Stack status: ${stack.StackStatus}`)

      // Try to get outputs
      try {
        const outputs = await cf.getStackOutputs(stackName)

        log.info('')
        log.info('═══════════════════════════════════════════════════════════════')
        log.info('  DEPLOYMENT SUMMARY')
        log.info('═══════════════════════════════════════════════════════════════')
        log.info('')

        // Show target domain
        log.info(`  Target Domain:     https://${siteDomain}`)
        if (sslDomains.length > 1) {
          log.info(`  SSL Domains:       ${sslDomains.join(', ')}`)
        }

        if (outputs.ApplicationURL) {
          log.info(`  ALB URL:           ${outputs.ApplicationURL}`)
        }
        if (outputs.LoadBalancerDNS) {
          log.info(`  Load Balancer:     ${outputs.LoadBalancerDNS}`)
        }
        if (outputs.WebServerPublicIP) {
          log.info(`  Web Server IP:     ${outputs.WebServerPublicIP}`)
        }
        if (outputs.AssetsBucketName) {
          log.info(`  Assets Bucket:     ${outputs.AssetsBucketName}`)
        }

        log.info('')
        log.info('═══════════════════════════════════════════════════════════════')
        log.info('')

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
        else if (!sslConfig.certificateArn) {
          log.info('  NEXT STEPS:')
          log.info('  1. DNS records need to be updated to point to the ALB')
          log.info('  2. SSL certificate needs to be requested and attached')
          log.info(`     Run: ./buddy cloud:ssl to set up SSL for ${siteDomain}`)
          log.info('')
        }
      }
      catch {
        // Outputs might not be available yet
      }
    }
  }
  catch (error: any) {
    log.error(`Stack deployment failed: ${error.message}`)
    throw error
  }
}

/**
 * Deploy frontend assets to S3
 */
export async function deployFrontend(options: DeployFrontendOptions): Promise<void> {
  const { environment, region, buildDir } = options

  log.info(`Deploying frontend from ${buildDir} to ${environment} in ${region}...`)

  try {
    const { S3Client } = await import('ts-cloud/aws')
    const { CloudFormationClient } = await import('ts-cloud/aws')

    const s3 = new S3Client(region)
    const cf = new CloudFormationClient(region)

    // Get bucket name from stack outputs
    const stackName = `stacks-cloud-${environment}`
    const outputs = await cf.getStackOutputs(stackName)
    const bucketName = outputs.AssetsBucketName

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
  catch (error: any) {
    log.error(`Frontend deployment failed: ${error.message}`)
    throw error
  }
}

/**
 * Get deployment status and outputs
 */
export async function getDeploymentStatus(options: { environment: string, region: string }): Promise<{
  status: string
  outputs: Record<string, string>
}> {
  const { environment, region } = options
  const stackName = `stacks-cloud-${environment}`

  const { CloudFormationClient } = await import('ts-cloud/aws')
  const cf = new CloudFormationClient(region)

  const result = await cf.describeStacks({ stackName })
  if (!result.Stacks || result.Stacks.length === 0) {
    return { status: 'NOT_FOUND', outputs: {} }
  }

  const stack = result.Stacks[0]
  const outputs = await cf.getStackOutputs(stackName)

  return {
    status: stack.StackStatus,
    outputs,
  }
}
