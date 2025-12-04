import type { aws_certificatemanager as acm, aws_s3 as s3 } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'
import { config } from '@stacksjs/config'
import {
  Duration,
  aws_ec2 as ec2,
  aws_iam as iam,
  CfnOutput as Output,
  RemovalPolicy,
  aws_route53 as route53,
  aws_s3 as s3Lib,
  aws_s3_assets as s3Assets,
  aws_secretsmanager as secretsmanager,
  Stack,
  Tags,
} from 'aws-cdk-lib'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface MailServerStackProps extends NestedCloudProps {
  vpc: ec2.Vpc
  zone: route53.IHostedZone
  certificate?: acm.Certificate
  emailBucket?: s3.Bucket
}

/**
 * Mail Server Stack - Deploys the mail server on EC2
 *
 * Supports two modes:
 * - 'serverless': TypeScript/Bun IMAP-to-S3 bridge server (~$3/month on t4g.nano)
 * - 'server': Full-featured Zig mail server with IMAP, POP3, CalDAV, etc.
 *
 * This stack creates:
 * - EC2 instance running the mail server
 * - Security groups for SMTP/IMAP/POP3 ports
 * - S3 bucket for mail storage (if not using shared EmailStack bucket)
 * - Route53 records for mail subdomain
 * - IAM roles for the instance
 * - TLS certificates via Let's Encrypt
 */
export class MailServerStack {
  instance: ec2.Instance
  mailBucket: s3.Bucket
  securityGroup: ec2.SecurityGroup

  constructor(scope: Construct, props: MailServerStackProps) {
    const emailConfig = config.email
    const serverConfig = emailConfig.server

    // Skip if server is not enabled
    if (!serverConfig?.enabled) {
      console.log('Mail server not enabled, skipping EC2 deployment')
      return
    }

    const mode = serverConfig.mode || 'serverless'
    const instanceConfig = serverConfig.instance || {}
    const ports = serverConfig.ports || {}

    console.log(`Deploying mail server in '${mode}' mode`)

    // Use shared email bucket from EmailStack if provided, otherwise create new one
    if (props.emailBucket) {
      this.mailBucket = props.emailBucket
    }
    else {
      // Create S3 bucket for mail storage
      this.mailBucket = new s3Lib.Bucket(scope, 'MailStorageBucket', {
        bucketName: `${props.slug}-${props.appEnv}-mail-storage-${props.timestamp}`,
        versioned: true,
        removalPolicy: RemovalPolicy.RETAIN,
        encryption: s3Lib.BucketEncryption.S3_MANAGED,
        lifecycleRules: [
          {
            id: 'Archive old emails',
            enabled: true,
            transitions: [
              {
                storageClass: s3Lib.StorageClass.INTELLIGENT_TIERING,
                transitionAfter: Duration.days(serverConfig.storage?.archiveAfterDays || 30),
              },
            ],
          },
          {
            id: 'Delete old emails',
            enabled: serverConfig.storage?.retentionDays ? true : false,
            expiration: Duration.days(serverConfig.storage?.retentionDays || 90),
          },
        ],
      })

      Tags.of(this.mailBucket).add('daily-backup', 'true')
    }

    // Create security group for mail server
    this.securityGroup = new ec2.SecurityGroup(scope, 'MailServerSecurityGroup', {
      vpc: props.vpc,
      securityGroupName: `${props.slug}-${props.appEnv}-mail-server-sg`,
      description: `Security group for ${mode} mail server`,
      allowAllOutbound: true,
    })

    // Add ingress rules for mail ports
    const mailPorts: Array<{ port: number; name: string }> = []

    // IMAP ports for serverless mode (and server mode if enabled)
    if (mode === 'serverless' || serverConfig.features?.imap) {
      mailPorts.push({ port: ports.imap || 143, name: 'IMAP' })
      mailPorts.push({ port: ports.imaps || 993, name: 'IMAPS' })
    }

    // SMTP ports for serverless mode (relay to SES) and server mode
    // This allows mail.domain.com to be used as SMTP server with user-friendly credentials
    if (mode === 'serverless' || mode === 'server') {
      mailPorts.push({ port: ports.submission || 587, name: 'SMTP Submission' })
      mailPorts.push({ port: ports.smtps || 465, name: 'SMTPS' })
    }

    // SMTP port 25 only for server mode (receiving mail directly)
    if (mode === 'server') {
      mailPorts.push({ port: ports.smtp || 25, name: 'SMTP' })
    }

    // POP3 if enabled in server mode
    if (mode === 'server' && serverConfig.features?.pop3) {
      mailPorts.push({ port: ports.pop3 || 110, name: 'POP3' })
      mailPorts.push({ port: ports.pop3s || 995, name: 'POP3S' })
    }

    for (const { port, name } of mailPorts) {
      this.securityGroup.addIngressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(port),
        `Allow ${name} traffic`,
      )
    }

    // Allow SSH for management (optional)
    if (instanceConfig.keyPair) {
      this.securityGroup.addIngressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(22),
        'Allow SSH access',
      )
    }

    // Allow HTTP/HTTPS for Let's Encrypt certificate validation
    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP for Let\'s Encrypt',
    )
    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS for Let\'s Encrypt',
    )

    // Create IAM role for the instance
    const instanceRole = new iam.Role(scope, 'MailServerRole', {
      roleName: `${props.slug}-${props.appEnv}-mail-server-role`,
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    })

    // Grant S3 access
    this.mailBucket.grantReadWrite(instanceRole)

    // Grant SES access for sending
    instanceRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ses:SendRawEmail',
        'ses:SendEmail',
      ],
      resources: ['*'],
    }))

    // Create secrets for IMAP passwords
    const imapPasswordsSecret = new secretsmanager.Secret(scope, 'ImapPasswordsSecret', {
      secretName: `${props.slug}-${props.appEnv}-imap-passwords`,
      description: 'IMAP user passwords for mail server',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          // Default passwords - users should update these
          chris: 'changeme',
          blake: 'changeme',
          glenn: 'changeme',
        }),
        generateStringKey: 'random',
      },
    })

    imapPasswordsSecret.grantRead(instanceRole)

    // Determine instance type based on mode
    let instanceType: ec2.InstanceType
    let machineImage: ec2.IMachineImage

    if (mode === 'serverless') {
      // ARM64 for serverless (t4g.nano is ~$3/month)
      instanceType = instanceConfig.type
        ? new ec2.InstanceType(instanceConfig.type)
        : new ec2.InstanceType('t4g.nano')

      machineImage = ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.ARM_64,
      })
    }
    else {
      // x86_64 for Zig server
      instanceType = instanceConfig.type
        ? new ec2.InstanceType(instanceConfig.type)
        : new ec2.InstanceType('t3.small')

      machineImage = ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.X86_64,
      })
    }

    // Build user data based on mode
    const userData = ec2.UserData.forLinux()

    if (mode === 'serverless') {
      // TypeScript/Bun IMAP-to-S3 bridge server
      this.buildServerlessUserData(userData, props, emailConfig, imapPasswordsSecret)
    }
    else {
      // Zig mail server
      this.buildZigServerUserData(userData, props, serverConfig, ports)
    }

    // Create the EC2 instance
    this.instance = new ec2.Instance(scope, 'MailServerInstance', {
      instanceName: `${props.slug}-${props.appEnv}-mail-server`,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType,
      machineImage,
      securityGroup: this.securityGroup,
      role: instanceRole,
      userData,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(instanceConfig.diskSize || 8, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
      keyPair: instanceConfig.keyPair
        ? ec2.KeyPair.fromKeyPairName(scope, 'MailServerKeyPair', instanceConfig.keyPair)
        : undefined,
    })

    Tags.of(this.instance).add('Name', `${props.slug}-${props.appEnv}-mail-server`)
    Tags.of(this.instance).add('Service', 'mail')
    Tags.of(this.instance).add('Mode', mode)

    // Create Elastic IP for stable address
    const eip = new ec2.CfnEIP(scope, 'MailServerEIP', {
      domain: 'vpc',
      instanceId: this.instance.instanceId,
      tags: [{ key: 'Name', value: `${props.slug}-${props.appEnv}-mail-server-eip` }],
    })

    // Create Route53 records
    new route53.ARecord(scope, 'MailServerARecord', {
      zone: props.zone,
      recordName: serverConfig.subdomain || 'mail',
      target: route53.RecordTarget.fromIpAddresses(eip.attrPublicIp),
      ttl: Duration.minutes(5),
    })

    // MX record pointing to mail subdomain
    new route53.MxRecord(scope, 'MailMxRecord', {
      zone: props.zone,
      values: [
        {
          priority: 10,
          hostName: `${serverConfig.subdomain || 'mail'}.${props.domain}`,
        },
      ],
      ttl: Duration.hours(1),
    })

    // SPF record
    new route53.TxtRecord(scope, 'MailSpfRecord', {
      zone: props.zone,
      recordName: serverConfig.subdomain || 'mail',
      values: [`v=spf1 ip4:${eip.attrPublicIp} include:amazonses.com ~all`],
      ttl: Duration.hours(1),
    })

    // Outputs
    new Output(scope, 'MailServerPublicIp', {
      value: eip.attrPublicIp,
      description: 'Public IP of the mail server',
    })

    new Output(scope, 'MailServerInstanceId', {
      value: this.instance.instanceId,
      description: 'Instance ID of the mail server',
    })

    new Output(scope, 'MailStorageBucketName', {
      value: this.mailBucket.bucketName,
      description: 'S3 bucket for mail storage',
    })

    new Output(scope, 'MailServerMode', {
      value: mode,
      description: 'Mail server deployment mode (serverless or server)',
    })

    new Output(scope, 'ImapPasswordsSecretArn', {
      value: imapPasswordsSecret.secretArn,
      description: 'ARN of the secrets containing IMAP passwords',
    })
  }

  /**
   * Build user data for serverless (TypeScript/Bun) IMAP and SMTP server
   */
  private buildServerlessUserData(
    userData: ec2.UserData,
    props: MailServerStackProps,
    emailConfig: any,
    _passwordsSecret: secretsmanager.Secret,
  ): void {
    const mailboxes = emailConfig.mailboxes || []
    const domain = emailConfig.domain || props.domain

    // Generate user configuration from mailboxes
    const users: Record<string, { email: string }> = {}
    for (const mailbox of mailboxes) {
      const username = mailbox.split('@')[0]
      users[username] = { email: mailbox }
    }

    // Read the IMAP server code
    const imapServerPath = join(__dirname, '../imap/imap-server.ts')
    let imapServerCode = ''
    if (existsSync(imapServerPath)) {
      imapServerCode = readFileSync(imapServerPath, 'utf-8')
    }
    else {
      console.warn('IMAP server code not found, using placeholder')
      imapServerCode = '// IMAP server code will be deployed separately'
    }

    // Read the SMTP server code
    const smtpServerPath = join(__dirname, '../imap/smtp-server.ts')
    let smtpServerCode = ''
    if (existsSync(smtpServerPath)) {
      smtpServerCode = readFileSync(smtpServerPath, 'utf-8')
    }
    else {
      console.warn('SMTP server code not found, using placeholder')
      smtpServerCode = '// SMTP server code will be deployed separately'
    }

    // Read the AWS client modules
    const clientPath = join(__dirname, '../imap/client.ts')
    let clientCode = ''
    if (existsSync(clientPath)) {
      clientCode = readFileSync(clientPath, 'utf-8')
    }

    const s3Path = join(__dirname, '../imap/s3.ts')
    let s3Code = ''
    if (existsSync(s3Path)) {
      s3Code = readFileSync(s3Path, 'utf-8')
    }

    const sesPath = join(__dirname, '../imap/ses.ts')
    let sesCode = ''
    if (existsSync(sesPath)) {
      sesCode = readFileSync(sesPath, 'utf-8')
    }

    // Create the startup script that starts both IMAP and SMTP servers
    const startupScript = `#!/usr/bin/env bun
import * as fs from 'node:fs'
import { startImapServer } from './imap-server'
import { startSmtpServer } from './smtp-server'

async function main() {
  console.log('Starting mail server (IMAP + SMTP)...')

  const hasTlsCerts = fs.existsSync('/etc/letsencrypt/live/mail.${domain}/privkey.pem')
  console.log('TLS certificates available:', hasTlsCerts)

  // Get passwords from environment or use defaults
  const users = ${JSON.stringify(Object.fromEntries(
    Object.entries(users).map(([k, v]) => [k, { password: process.env[\`IMAP_PASSWORD_\${k.toUpperCase()}\`] || 'changeme', email: (v as any).email }])
  ), null, 2).replace(/process\.env\[`IMAP_PASSWORD_([A-Z]+)`\]/g, "process.env.IMAP_PASSWORD_$1 || 'changeme'")}

  const tlsConfig = hasTlsCerts ? {
    key: '/etc/letsencrypt/live/mail.${domain}/privkey.pem',
    cert: '/etc/letsencrypt/live/mail.${domain}/fullchain.pem',
  } : undefined

  // Start IMAP server
  const imapServer = await startImapServer({
    port: 143,
    sslPort: 993,
    host: '0.0.0.0',
    region: '${Stack.of({ node: { id: 'scope' } } as any).region || 'us-east-1'}',
    bucket: '${this.mailBucket.bucketName}',
    prefix: 'incoming/',
    domain: '${domain}',
    users,
    tls: tlsConfig,
  })
  console.log('IMAP server running on port 143' + (hasTlsCerts ? ' and 993 (TLS)' : ''))

  // Start SMTP server (relay to SES)
  const smtpServer = await startSmtpServer({
    port: 587,
    tlsPort: 465,
    host: '0.0.0.0',
    region: '${Stack.of({ node: { id: 'scope' } } as any).region || 'us-east-1'}',
    domain: '${domain}',
    users,
    tls: tlsConfig,
    sentBucket: '${this.mailBucket.bucketName}',
    sentPrefix: 'sent/',
  })
  console.log('SMTP server running on port 587' + (hasTlsCerts ? ' and 465 (TLS)' : ''))

  const shutdown = async () => {
    console.log('Shutting down...')
    await Promise.all([imapServer.stop(), smtpServer.stop()])
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch(console.error)
`

    userData.addCommands(
      '#!/bin/bash',
      'set -e',
      '',
      '# Update system',
      'dnf update -y',
      '',
      '# Install dependencies',
      'dnf install -y unzip curl certbot',
      '',
      '# Install Bun',
      'curl -fsSL https://bun.sh/install | bash',
      'export BUN_INSTALL="/root/.bun"',
      'export PATH="$BUN_INSTALL/bin:$PATH"',
      '',
      '# Create mail server directory',
      'mkdir -p /opt/imap-server',
      '',
      '# Write IMAP server code',
      `cat > /opt/imap-server/imap-server.ts << 'EOFIMAPSERVER'`,
      imapServerCode,
      'EOFIMAPSERVER',
      '',
      '# Write SMTP server code',
      `cat > /opt/imap-server/smtp-server.ts << 'EOFSMTPSERVER'`,
      smtpServerCode,
      'EOFSMTPSERVER',
      '',
      '# Write AWS client code',
      `cat > /opt/imap-server/client.ts << 'EOFCLIENT'`,
      clientCode,
      'EOFCLIENT',
      '',
      '# Write S3 client code',
      `cat > /opt/imap-server/s3.ts << 'EOFS3'`,
      s3Code,
      'EOFS3',
      '',
      '# Write SES client code',
      `cat > /opt/imap-server/ses.ts << 'EOFSES'`,
      sesCode,
      'EOFSES',
      '',
      '# Write startup script',
      `cat > /opt/imap-server/server.ts << 'EOFSERVER'`,
      startupScript,
      'EOFSERVER',
      '',
      '# Obtain TLS certificate with Let\'s Encrypt (standalone mode)',
      `certbot certonly --standalone --non-interactive --agree-tos --email admin@${domain} -d mail.${domain} || echo "Certificate already exists or failed to obtain"`,
      '',
      '# Create systemd service for mail server (IMAP + SMTP)',
      'cat > /etc/systemd/system/imap-server.service << EOF',
      '[Unit]',
      'Description=Mail Server (IMAP + SMTP)',
      'After=network.target',
      '',
      '[Service]',
      'Type=simple',
      'User=root',
      'WorkingDirectory=/opt/imap-server',
      'Environment="AWS_REGION=${Stack.of({ node: { id: 'scope' } } as any).region || 'us-east-1'}"',
      ...Object.keys(users).map(u => `Environment="IMAP_PASSWORD_${u.toUpperCase()}=changeme"`),
      'ExecStart=/root/.bun/bin/bun run /opt/imap-server/server.ts',
      'Restart=always',
      'RestartSec=10',
      '',
      '[Install]',
      'WantedBy=multi-user.target',
      'EOF',
      '',
      '# Enable and start the service',
      'systemctl daemon-reload',
      'systemctl enable imap-server',
      'systemctl start imap-server',
      '',
      '# Set up certificate renewal cron',
      'echo "0 0,12 * * * root certbot renew --quiet && systemctl restart imap-server" > /etc/cron.d/certbot-renew',
      '',
      '# Log completion',
      'echo "Mail server (IMAP + SMTP) setup complete" >> /var/log/imap-server-setup.log',
    )
  }

  /**
   * Build user data for Zig mail server
   */
  private buildZigServerUserData(
    userData: ec2.UserData,
    props: MailServerStackProps,
    serverConfig: any,
    ports: any,
  ): void {
    // Build the Zig mail server binary path
    const serverPath = serverConfig.serverPath || '/Users/chrisbreuer/Code/mail'
    const binaryPath = join(serverPath, 'zig-out/bin/x86_64-linux/smtp-server-x86_64-linux')

    // Check if the binary exists
    let mailServerAsset: s3Assets.Asset | undefined
    if (existsSync(binaryPath)) {
      mailServerAsset = new s3Assets.Asset({ node: { id: 'MailServerBinary' } } as any, 'MailServerBinary', {
        path: binaryPath,
      })
    }
    else {
      console.warn(`Mail server binary not found at ${binaryPath}`)
      console.warn('Run "zig build -Dtarget=x86_64-linux-gnu" in the mail directory first')
    }

    userData.addCommands(
      '#!/bin/bash',
      'set -e',
      '',
      '# Update system',
      'dnf update -y',
      '',
      '# Install dependencies',
      'dnf install -y sqlite',
      '',
      '# Create mail user and directories',
      'useradd -r -s /sbin/nologin mailserver || true',
      'mkdir -p /opt/mailserver',
      'mkdir -p /var/mail/new /var/mail/cur /var/mail/tmp',
      'mkdir -p /var/log/mailserver',
      'mkdir -p /etc/mailserver',
      '',
    )

    if (mailServerAsset) {
      userData.addCommands(
        '# Download mail server binary from S3',
        `aws s3 cp s3://${mailServerAsset.s3BucketName}/${mailServerAsset.s3ObjectKey} /opt/mailserver/smtp-server`,
        'chmod +x /opt/mailserver/smtp-server',
        '',
      )
    }

    userData.addCommands(
      '# Create configuration file',
      `cat > /etc/mailserver/config.toml << 'EOF'`,
      `[server]`,
      `hostname = "mail.${props.domain}"`,
      `port = ${ports.smtp || 25}`,
      `max_connections = 1000`,
      ``,
      `[tls]`,
      `enabled = false`,
      `# cert_path = "/etc/mailserver/cert.pem"`,
      `# key_path = "/etc/mailserver/key.pem"`,
      ``,
      `[storage]`,
      `path = "/var/mail"`,
      ``,
      `[logging]`,
      `level = "info"`,
      `file = "/var/log/mailserver/smtp.log"`,
      `EOF`,
      '',
      '# Set permissions',
      'chown -R mailserver:mailserver /opt/mailserver',
      'chown -R mailserver:mailserver /var/mail',
      'chown -R mailserver:mailserver /var/log/mailserver',
      'chown -R mailserver:mailserver /etc/mailserver',
      '',
      '# Create systemd service',
      'cat > /etc/systemd/system/mailserver.service << EOF',
      '[Unit]',
      'Description=Zig SMTP Mail Server',
      'After=network.target',
      '',
      '[Service]',
      'Type=simple',
      'User=mailserver',
      'Group=mailserver',
      'WorkingDirectory=/opt/mailserver',
      'ExecStart=/opt/mailserver/smtp-server --config /etc/mailserver/config.toml',
      'Restart=always',
      'RestartSec=5',
      '',
      '[Install]',
      'WantedBy=multi-user.target',
      'EOF',
      '',
      '# Enable and start the service',
      'systemctl daemon-reload',
      'systemctl enable mailserver',
      'systemctl start mailserver',
      '',
      '# Log completion',
      'echo "Mail server setup complete" >> /var/log/mailserver/setup.log',
    )
  }
}
