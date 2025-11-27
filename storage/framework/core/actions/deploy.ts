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

/**
 * Get AWS account ID for the current credentials
 */
async function getAwsAccountId(region: string): Promise<string> {
  try {
    const { AWSClient } = await import('ts-cloud/aws')
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
  const containerConfig = cloudConfig?.infrastructure?.containers?.api || {
    cpu: 512,
    memory: 1024,
    port: 3000,
    desiredCount: 2,
  }

  // Container configuration
  const cpu = containerConfig.cpu || 512
  const memory = containerConfig.memory || 1024
  const port = containerConfig.port || 3000
  const desiredCount = containerConfig.desiredCount || 2
  const healthCheckPath = containerConfig.healthCheck || '/health'
  const autoScalingConfig = containerConfig.autoScaling || {
    min: 1,
    max: 10,
    targetCpuUtilization: 70,
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
          // Origins: S3 for frontend, ALB for API
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
          // Cache behaviors for API routes
          CacheBehaviors: [
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
    // For updates, show both UPDATE and CREATE events (new resources may be created during update)
    if (filter === 'update' && !event.status.includes('UPDATE') && !event.status.includes('CREATE')) {
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
    const { Route53Client, ACMClient, AWSClient } = await import('ts-cloud/aws')
    const r53 = new Route53Client(region)
    const acm = new ACMClient(region)
    const client = new AWSClient()

    // Note: DNS records pointing to CloudFront are already created by CloudFormation
    // We only need to request and validate SSL certificate here

    // 1. Request SSL certificate
    console.log(`  Requesting SSL certificate for ${domain}...`)
    const certResult = await acm.requestCertificate({
      DomainName: sslDomains[0],
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
        const { CloudFormationClient } = await import('ts-cloud/aws')
        const cf = new CloudFormationClient(region)
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
  catch (error: any) {
    console.log(`✗ DNS/SSL setup failed: ${error.message}`)
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
  const stackName = `stacks-cloud-${environment}`

  if (verbose) console.log(`Deploying ${stackName} to ${region}...`)

  try {
    const { CloudFormationClient } = await import('ts-cloud/aws')
    const cf = new CloudFormationClient(region)

    // Check deployment mode from cloud config
    const cloudConfig = await getCloudConfig()
    const deploymentMode = cloudConfig?.infrastructure?.mode || 'server'

    // Generate the template based on deployment mode
    if (verbose) console.log(`Generating CloudFormation template (${deploymentMode} mode)...`)

    let templateBody: string
    if (deploymentMode === 'serverless') {
      // For serverless mode, we need the ECR repository URI
      // The image will be built and pushed before stack creation
      templateBody = await generateServerlessTemplate({
        environment,
        projectName,
      })
    } else {
      // Server mode (EC2-based deployment)
      templateBody = await generateStacksTemplate({
        environment,
        projectName,
      })
    }

    // Check if stack exists
    let stackExists = false
    let isUpdate = false
    try {
      const describeResult = await cf.describeStacks({ stackName })
      if (describeResult.Stacks && describeResult.Stacks.length > 0) {
        const stack = describeResult.Stacks[0]
        if (verbose) console.log(`Current status: ${formatResourceStatus(stack.StackStatus)}`)
        stackExists = true
        isUpdate = true

        // If stack is in a failed or rollback state, delete it first
        if (stack.StackStatus.includes('ROLLBACK') || stack.StackStatus.includes('FAILED')) {
          console.log(`Stack is in ${stack.StackStatus} state. Cleaning up...`)
          await cf.deleteStack(stackName)
          await cf.waitForStackWithProgress(stackName, 'stack-delete-complete', createProgressCallback('delete'))

          // Clean up any retained resources (S3 buckets with DeletionPolicy: Retain)
          console.log('Cleaning up retained resources...')
          try {
            const { S3Client } = await import('ts-cloud/aws')
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
          isUpdate = false
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
        await cf.updateStack({
          stackName,
          templateBody,
          capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
        })

        if (waitForCompletion) {
          // Print header for resource status table
          console.log(`  ${'Resource'.padEnd(35)} ${'Type'.padEnd(30)} Status`)
          console.log('  ' + '─'.repeat(85))

          await cf.waitForStackWithProgress(stackName, 'stack-update-complete', createProgressCallback('update'))
          console.log('')
        }
      }
      catch (error: any) {
        if (error.message?.includes('No updates are to be performed')) {
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
        const { S3Client } = await import('ts-cloud/aws')
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

        // Clean up DNS records from Route53 if they exist
        const cloudConfig = await getCloudConfig()
        const hostedZoneId = cloudConfig?.infrastructure?.dns?.hostedZoneId
        const siteDomain = cloudConfig?.infrastructure?.dns?.domain || 'stacksjs.com'

        if (hostedZoneId) {
          if (verbose) console.log(`  Checking DNS records in hosted zone: ${hostedZoneId}`)

          const { Route53Client } = await import('ts-cloud/aws')
          const route53 = new Route53Client(region)

          // List and delete existing A records for stacksjs.com and www.stacksjs.com
          try {
            const records = await route53.listResourceRecordSets({ HostedZoneId: hostedZoneId })
            const aRecords = (records.ResourceRecordSets || []).filter((r: any) =>
              r.Type === 'A' && (r.Name === `${siteDomain}.` || r.Name === `www.${siteDomain}.`)
            )

            if (aRecords.length > 0) {
              if (verbose) console.log(`  Found ${aRecords.length} existing DNS records to delete`)

              const changes = aRecords.map((record: any) => ({
                Action: 'DELETE',
                ResourceRecordSet: record
              }))

              await route53.changeResourceRecordSets({
                HostedZoneId: hostedZoneId,
                ChangeBatch: { Changes: changes }
              })

              if (verbose) console.log(`  ✓ Deleted DNS records for ${siteDomain}`)
            }
          } catch (dnsError: any) {
            // DNS cleanup errors shouldn't fail deployment
            if (verbose) console.log(`  ⚠ DNS cleanup warning: ${dnsError.message}`)
          }
        }
      } catch (cleanupError: any) {
        console.log(`⚠ Pre-deployment cleanup error: ${cleanupError.message}`)
        // Don't fail deployment for cleanup issues
      }

      // Create new stack
      console.log('Creating stack...')
      console.log('')
      const result = await cf.createStack({
        stackName,
        templateBody,
        capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
        onFailure: 'ROLLBACK',
        timeoutInMinutes: 15,
      })
      if (verbose) console.log(`Stack ID: ${result.StackId}`)

      if (waitForCompletion) {
        // Print header for resource status table
        console.log(`  ${'Resource'.padEnd(35)} ${'Type'.padEnd(30)} Status`)
        console.log('  ' + '─'.repeat(85))

        await cf.waitForStackWithProgress(stackName, 'stack-create-complete', createProgressCallback('create'))
        console.log('')
      }
    }

    // Get cloud config for domain info (reuse cloudConfig from above)
    const siteDomain = cloudConfig?.infrastructure?.dns?.domain || 'stacksjs.org'
    const sslConfig = cloudConfig?.infrastructure?.ssl || { enabled: true, domains: [] }
    const sslDomains = sslConfig.domains || [siteDomain, `www.${siteDomain}`]

    // Get stack outputs
    const outputResult = await cf.describeStacks({ stackName })
    if (outputResult.Stacks && outputResult.Stacks.length > 0) {
      const stack = outputResult.Stacks[0]

      // Try to get outputs
      try {
        const outputs = await cf.getStackOutputs(stackName)

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
      catch {
        // Outputs might not be available yet
      }
    }
  }
  catch (error: any) {
    console.error(`Stack deployment failed: ${error.message}`)
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

    // Clean up any retained resources (S3 buckets with DeletionPolicy: Retain)
    try {
      const { S3Client } = await import('ts-cloud/aws')
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
