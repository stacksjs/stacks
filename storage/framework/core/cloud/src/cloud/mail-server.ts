import type { aws_certificatemanager as acm } from 'aws-cdk-lib'
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
  aws_s3 as s3,
  aws_s3_assets as s3Assets,
  Stack,
  Tags,
} from 'aws-cdk-lib'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export interface MailServerStackProps extends NestedCloudProps {
  vpc: ec2.Vpc
  zone: route53.IHostedZone
  certificate?: acm.Certificate
}

/**
 * Mail Server Stack - Deploys the Zig SMTP server on EC2
 *
 * This stack creates:
 * - EC2 instance running the Zig mail server
 * - Security groups for SMTP/IMAP/POP3 ports
 * - S3 bucket for mail storage
 * - Route53 records for mail subdomain
 * - IAM roles for the instance
 */
export class MailServerStack {
  instance: ec2.Instance
  mailBucket: s3.Bucket
  securityGroup: ec2.SecurityGroup

  constructor(scope: Construct, props: MailServerStackProps) {
    const emailConfig = config.email
    const serverConfig = emailConfig.server

    // Only deploy if server mode is enabled
    if (serverConfig?.mode !== 'server') {
      console.log('Mail server mode not enabled, skipping EC2 deployment')
      return
    }

    const instanceConfig = serverConfig.instance || {}
    const ports = serverConfig.ports || {}

    // Create S3 bucket for mail storage
    this.mailBucket = new s3.Bucket(scope, 'MailStorageBucket', {
      bucketName: `${props.slug}-${props.appEnv}-mail-storage-${props.timestamp}`,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          id: 'Archive old emails',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
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

    // Create security group for mail server
    this.securityGroup = new ec2.SecurityGroup(scope, 'MailServerSecurityGroup', {
      vpc: props.vpc,
      securityGroupName: `${props.slug}-${props.appEnv}-mail-server-sg`,
      description: 'Security group for Zig mail server',
      allowAllOutbound: true,
    })

    // Add ingress rules for mail ports
    const mailPorts = [
      { port: ports.smtp || 25, name: 'SMTP' },
      { port: ports.smtps || 465, name: 'SMTPS' },
      { port: ports.submission || 587, name: 'Submission' },
    ]

    // Add IMAP/POP3 if enabled
    if (serverConfig.features?.imap) {
      mailPorts.push({ port: ports.imap || 143, name: 'IMAP' })
      mailPorts.push({ port: ports.imaps || 993, name: 'IMAPS' })
    }

    if (serverConfig.features?.pop3) {
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

    // Determine instance type based on mode
    // ARM64 for serverless (t4g), x86_64 for Zig server (t3)
    const instanceType = instanceConfig.type
      ? new ec2.InstanceType(instanceConfig.type)
      : new ec2.InstanceType('t3.small')

    // Use Amazon Linux 2023 for x86_64
    const machineImage = ec2.MachineImage.latestAmazonLinux2023({
      cpuType: ec2.AmazonLinuxCpuType.X86_64,
    })

    // Build the Zig mail server binary path
    const serverPath = serverConfig.serverPath || '/Users/chrisbreuer/Code/mail'
    const binaryPath = join(serverPath, 'zig-out/bin/x86_64-linux/smtp-server-x86_64-linux')

    // Check if the binary exists
    let mailServerAsset: s3Assets.Asset | undefined
    if (existsSync(binaryPath)) {
      mailServerAsset = new s3Assets.Asset(scope, 'MailServerBinary', {
        path: binaryPath,
      })
      mailServerAsset.grantRead(instanceRole)
    }
    else {
      console.warn(`Mail server binary not found at ${binaryPath}`)
      console.warn('Run "zig build -Dtarget=x86_64-linux-gnu" in the mail directory first')
    }

    // User data script to set up the mail server
    const userData = ec2.UserData.forLinux()

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
  }
}
