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
  const siteDomain = domain || cloudConfig?.infrastructure?.dns?.domain || 'stacksjs.com'
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

  // Config details are only shown in verbose mode
  log.debug(`  Compute: ${useMixedInstances ? 'mixed fleet' : `${instanceCount} x ${instanceSize} (${instanceType})`}`)
  log.debug(`  Auto Scaling: ${useAutoScaling ? 'enabled' : 'disabled'}`)
  log.debug(`  Load Balancer: ${useLoadBalancer ? 'enabled' : 'disabled'}`)

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

# Remove linked packages from ALL package.json files (they don't exist on the server)
echo "Removing linked packages from all package.json files..."
/root/.bun/bin/bun -e "
import { Glob } from 'bun';

async function cleanPackageJson(filePath) {
  try {
    const pkg = await Bun.file(filePath).json();
    let modified = false;

    // Remove link: dependencies
    for (const key of Object.keys(pkg.dependencies || {})) {
      if (typeof pkg.dependencies[key] === 'string' && pkg.dependencies[key].startsWith('link:')) {
        console.log('[' + filePath + '] Removing linked dependency: ' + key);
        delete pkg.dependencies[key];
        modified = true;
      }
    }
    for (const key of Object.keys(pkg.devDependencies || {})) {
      if (typeof pkg.devDependencies[key] === 'string' && pkg.devDependencies[key].startsWith('link:')) {
        console.log('[' + filePath + '] Removing linked devDependency: ' + key);
        delete pkg.devDependencies[key];
        modified = true;
      }
    }
    // Also handle workspace: dependencies
    for (const key of Object.keys(pkg.dependencies || {})) {
      if (typeof pkg.dependencies[key] === 'string' && pkg.dependencies[key].startsWith('workspace:')) {
        console.log('[' + filePath + '] Removing workspace dependency: ' + key);
        delete pkg.dependencies[key];
        modified = true;
      }
    }
    for (const key of Object.keys(pkg.devDependencies || {})) {
      if (typeof pkg.devDependencies[key] === 'string' && pkg.devDependencies[key].startsWith('workspace:')) {
        console.log('[' + filePath + '] Removing workspace devDependency: ' + key);
        delete pkg.devDependencies[key];
        modified = true;
      }
    }

    if (modified) {
      await Bun.write(filePath, JSON.stringify(pkg, null, 2));
      console.log('[' + filePath + '] Cleaned');
    }
  } catch (e) {
    console.log('[' + filePath + '] Error: ' + e.message);
  }
}

// Find and clean all package.json files
const glob = new Glob('**/package.json');
for await (const file of glob.scan({ cwd: '.', absolute: true })) {
  // Skip node_modules
  if (file.includes('node_modules')) continue;
  await cleanPackageJson(file);
}
console.log('All package.json files cleaned for production install');
"

# Remove bun.lock to avoid lockfile conflicts after modifying package.json
rm -f bun.lock

# Install dependencies
echo "Installing dependencies..."
/root/.bun/bin/bun install --no-save || echo "Install completed with warnings"

echo "Building assets..."
/root/.bun/bin/bun run build || echo "Build step skipped (no build script or failed)"

# Create public/dist directory for assets if it doesn't exist
mkdir -p public/dist
mkdir -p storage/public/assets

cat > .env << 'ENVEOF'
APP_ENV=production
APP_URL=https://\${DomainName}
PORT=80
DEBUG=false
ENVEOF
cat > server-prod.ts << 'SERVEREOF'
// MIME type mapping for static assets
const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.ts': 'application/javascript; charset=utf-8',
  '.mts': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
}

function getMimeType(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase()
  return mimeTypes[ext] || 'application/octet-stream'
}

function isStaticAsset(pathname: string): boolean {
  if (pathname.startsWith('/assets/') || pathname.startsWith('/_assets/') || pathname.startsWith('/static/')) return true
  const ext = pathname.substring(pathname.lastIndexOf('.')).toLowerCase()
  return ext in mimeTypes && ext !== '.html' && ext !== '.htm'
}

const server = Bun.serve({
  port: process.env.PORT || 80,
  development: false,
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const pathname = url.pathname

    // Health check endpoint
    if (pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Favicon - return empty response if not found
    if (pathname === '/favicon.ico') {
      const faviconPaths = ['./public/favicon.ico', './resources/favicon.ico', './favicon.ico']
      for (const p of faviconPaths) {
        try {
          const file = Bun.file(p)
          if (await file.exists()) {
            return new Response(file, { headers: { 'Content-Type': 'image/x-icon', 'Cache-Control': 'public, max-age=86400' } })
          }
        } catch {}
      }
      return new Response('', { status: 204 })
    }

    // Handle static assets (CSS, JS, images, fonts, etc.)
    if (isStaticAsset(pathname)) {
      const assetPaths = [
        './public/dist' + pathname,
        './public' + pathname,
        './storage/public' + pathname,
        '.' + pathname,
      ]

      // For /assets/* URLs, also check resources/assets directory
      if (pathname.startsWith('/assets/')) {
        assetPaths.push('./resources' + pathname)
      }

      for (const assetPath of assetPaths) {
        try {
          const file = Bun.file(assetPath)
          if (await file.exists()) {
            // Transpile TypeScript files to JavaScript
            const ext = pathname.substring(pathname.lastIndexOf('.')).toLowerCase()
            if (ext === '.ts' || ext === '.mts') {
              const tsCode = await file.text()
              const transpiler = new Bun.Transpiler({ loader: 'ts' })
              const jsCode = transpiler.transformSync(tsCode)
              return new Response(jsCode, {
                headers: {
                  'Content-Type': 'application/javascript; charset=utf-8',
                  'Cache-Control': 'public, max-age=31536000, immutable',
                  'Access-Control-Allow-Origin': '*',
                }
              })
            }
            return new Response(file, {
              headers: {
                'Content-Type': getMimeType(pathname),
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Access-Control-Allow-Origin': '*',
              }
            })
          }
        } catch {}
      }
      // Asset not found
      return new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain' } })
    }

    // Serve index.html for root and HTML pages
    if (pathname === '/' || pathname === '/index.html' || pathname.endsWith('.html')) {
      const htmlPaths = [
        './public/dist/index.html',
        './public/index.html',
        './resources/views/index.stx',
        './resources/views/index.html',
      ]
      for (const htmlPath of htmlPaths) {
        try {
          const file = Bun.file(htmlPath)
          if (await file.exists()) {
            return new Response(file, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
          }
        } catch {}
      }
    }

    // API fallback - return JSON for unmatched routes
    return new Response(JSON.stringify({ message: 'Welcome to Stacks API!', path: pathname, method: request.method, timestamp: new Date().toISOString() }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
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

  // DNS Configuration
  const dnsConfig = cloudConfig?.infrastructure?.dns || {}
  const hostedZoneId = dnsConfig.hostedZoneId || ''
  const sslDomains = sslConfig.domains || [siteDomain, `www.${siteDomain}`]

  // Log DNS config (verbose mode only)
  if (hostedZoneId) {
    log.debug(`  DNS: Route53 (${siteDomain})`)
    log.debug(`  SSL Domains: ${sslDomains.join(', ')}`)
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

  // Add Route53 DNS records if hostedZoneId is provided
  if (hostedZoneId && useLoadBalancer) {
    // ALB hosted zone IDs by region (for ALIAS records)
    const albHostedZoneIds: Record<string, string> = {
      'us-east-1': 'Z35SXDOTRQ7X7K',
      'us-east-2': 'Z3AADJGX6KTTL2',
      'us-west-1': 'Z368ELLRRE2KJ0',
      'us-west-2': 'Z1H1FL5HABSF5',
      'eu-west-1': 'Z32O12XQLNTSW2',
      'eu-west-2': 'ZHURV8PSTC4K8',
      'eu-west-3': 'Z3Q77PNBQS71R4',
      'eu-central-1': 'Z215JYRZR1TBD5',
      'ap-northeast-1': 'Z14GRHDCWA56QT',
      'ap-northeast-2': 'ZWKZPGTI48KDX',
      'ap-southeast-1': 'Z1LMS91P8CMLE5',
      'ap-southeast-2': 'Z1GM3OXH4ZPM65',
      'ap-south-1': 'ZP97RAFLXTNZK',
      'sa-east-1': 'Z2P70J7HTTTPLU',
      'ca-central-1': 'ZQSVJUPU6J1EY',
    }

    const albHostedZoneId = albHostedZoneIds[options.environment === 'production' ? 'us-east-1' : 'us-east-1'] || 'Z35SXDOTRQ7X7K'

    // Create DNS A record for each SSL domain
    sslDomains.forEach((domain: string, index: number) => {
      const recordName = domain.startsWith('www.') ? domain : (domain === siteDomain ? siteDomain : domain)
      const resourceId = `DNSRecord${index === 0 ? '' : index + 1}`

      resources[resourceId] = {
        Type: 'AWS::Route53::RecordSet',
        DependsOn: 'ApplicationLoadBalancer',
        Properties: {
          HostedZoneId: hostedZoneId,
          Name: recordName,
          Type: 'A',
          AliasTarget: {
            HostedZoneId: { 'Fn::GetAtt': ['ApplicationLoadBalancer', 'CanonicalHostedZoneID'] },
            DNSName: { 'Fn::GetAtt': ['ApplicationLoadBalancer', 'DNSName'] },
            EvaluateTargetHealth: true,
          },
        },
      }
    })
  } else if (hostedZoneId && !useLoadBalancer && !useAutoScaling) {
    // Direct EC2 instance - create A record pointing to Elastic IP
    resources.DNSRecord = {
      Type: 'AWS::Route53::RecordSet',
      DependsOn: 'WebServerEIP',
      Properties: {
        HostedZoneId: hostedZoneId,
        Name: siteDomain,
        Type: 'A',
        TTL: '300',
        ResourceRecords: [{ Ref: 'WebServerEIP' }],
      },
    }

    // Add www subdomain if in sslDomains
    if (sslDomains.includes(`www.${siteDomain}`)) {
      resources.DNSRecordWww = {
        Type: 'AWS::Route53::RecordSet',
        DependsOn: 'WebServerEIP',
        Properties: {
          HostedZoneId: hostedZoneId,
          Name: `www.${siteDomain}`,
          Type: 'A',
          TTL: '300',
          ResourceRecords: [{ Ref: 'WebServerEIP' }],
        },
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

  // Add domain URL output if DNS is configured
  if (hostedZoneId) {
    outputs.DomainURL = { Description: 'Domain URL', Value: `https://${siteDomain}` }
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
 * @param filter - Optional filter: 'delete' to only show DELETE events, 'create' for CREATE, etc.
 */
function createProgressCallback(filter?: 'delete' | 'create' | 'update'): (event: {
  resourceId: string
  resourceType: string
  status: string
  reason?: string
  timestamp: string
}) => void {
  const maxIdLength = 35
  const maxTypeLength = 30
  const seenEvents = new Set<string>()

  return (event) => {
    // Filter events based on type if specified
    if (filter === 'delete' && !event.status.includes('DELETE')) {
      return
    }
    if (filter === 'create' && !event.status.includes('CREATE')) {
      return
    }
    if (filter === 'update' && !event.status.includes('UPDATE')) {
      return
    }

    // Deduplicate events (same resource + status)
    const eventKey = `${event.resourceId}:${event.status}`
    if (seenEvents.has(eventKey)) {
      return
    }
    seenEvents.add(eventKey)

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
  const { environment, region, waitForCompletion = true, verbose = false } = options

  const projectConfig = await getProjectConfig()
  const projectName = projectConfig.name
  const stackName = `stacks-cloud-${environment}`

  if (verbose) log.info(`Deploying infrastructure to ${environment} in ${region}...`)

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
  const stackName = `stacks-cloud-${environment}`

  console.log(`Undeploying ${stackName} from ${region}...`)
  console.log('')

  try {
    const { CloudFormationClient, AWSClient } = await import('ts-cloud/aws')
    const cf = new CloudFormationClient(region)

    // Check if stack exists
    let stackExists = false
    try {
      const describeResult = await cf.describeStacks({ stackName })
      if (describeResult.Stacks && describeResult.Stacks.length > 0) {
        const stack = describeResult.Stacks[0]
        console.log(`Current status: ${formatResourceStatus(stack.StackStatus)}`)
        stackExists = true
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

      // Get ALB from stack resources
      const resourcesResult = await cf.listStackResources(stackName)
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
    await cf.waitForStackWithProgress(stackName, 'stack-delete-complete', createProgressCallback('delete'))

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
  catch (error: any) {
    const errorStr = String(error.message || error)

    // Handle stack doesn't exist
    if (errorStr.includes('does not exist')) {
      console.log('')
      console.log('✓ Stack already deleted or does not exist.')
      return
    }

    // Handle DELETE_FAILED - need to retain some resources
    if (error.code === 'DELETE_FAILED' || errorStr.includes('DELETE_FAILED')) {
      console.log('')
      console.log('Some resources could not be deleted automatically')
      console.log('Identifying resources to retain...')

      const { CloudFormationClient } = await import('ts-cloud/aws')
      const cf = new CloudFormationClient(region)

      try {
        const resourcesResult = await cf.listStackResources(stackName)
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
          await cf.deleteStack(stackName, undefined, failedResources)
          await cf.waitForStackWithProgress(stackName, 'stack-delete-complete', createProgressCallback('delete'))

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

    console.error(`Stack deletion failed: ${error.message}`)
    throw error
  }
}
