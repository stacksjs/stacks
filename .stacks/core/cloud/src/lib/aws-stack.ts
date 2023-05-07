import * as cdk from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import * as route53 from 'aws-cdk-lib/aws-route53'

export class AwsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const hostedZone = new route53.PublicHostedZone(this, 'HostedZone', {
      zoneName: 'stacksjs.dev',
    })

    //   // Create the A records
    //   for (const [index, record] of dns.a) {
    //     new route53.ARecord(this, `${index}-aRecord`, {
    //       zone: hostedZone,
    //       target: route53.RecordTarget.fromIpAddresses(record.address),
    //       recordName: record.name,
    //       ttl: cdk.Duration.seconds(record.ttl),
    //     })
    //   }

    //   // Create the AAAA records
    //   for (const [index, record] of dns.aaaa) {
    //     new route53.AaaaRecord(this, `${index}-aaaaRecord`, {
    //       zone: hostedZone,
    //       target: route53.RecordTarget.fromIpAddresses(record.address),
    //       recordName: record.name,
    //       ttl: cdk.Duration.seconds(record.ttl),
    //     })
    //   }

    //   // Create the CNAME records
    //   for (const [index, record] of dns.cname) {
    //     new route53.CnameRecord(this, `${index}-cnameRecord`, {
    //       zone: hostedZone,
    //       domainName: record.target,
    //       recordName: record.name,
    //       ttl: cdk.Duration.seconds(record.ttl),
    //     })
    //   }

    //   // Create the MX records
    //   for (const [index, record] of dns.mx) {
    //     new route53.MxRecord(this, `${index}-mxRecord`, {
    //       zone: hostedZone,
    //       values: [
    //         {
    //           hostName: record.mailServer,
    //           priority: record.priority,
    //         },
    //       ],
    //       recordName: record.name,
    //       ttl: cdk.Duration.seconds(record.ttl),
    //     })
    //   }

    //   // Create the TXT records
    //   for (const [index, record] of dns.txt) {
    //     new route53.TxtRecord(this, `${index}-txtRecord`, {
    //       zone: hostedZone,
    //       values: [record.content],
    //       recordName: record.name,
    //       ttl: cdk.Duration.seconds(record.ttl),
    //     })
    //   }
  }
}
