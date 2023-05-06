import * as cdk from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import * as route53 from 'aws-cdk-lib/aws-route53'

export class AwsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    /* TODO
    * Should be taken from cdk deploy --parameters
    * This should be passed as parameters/prop
    */
    const dnsConfig = {
      hostedZone: 'stacksjs.dev',
      a: [
        {
          name: 'stacks.dev',
          address: '10.0.0.1',
          ttl: 300,
        },
        {
          name: 'samplearecord',
          address: '192.0.2.2',
          ttl: 300,
        },
      ],
      aaaa: [
        {
          name: 'sampleaaaa',
          address: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
          ttl: 300,
        },
      ],
      cname: [
        {
          name: 'samplecname',
          target: '@',
          ttl: 300,
        },
      ],
      mx: [
        {
          name: 'samplemxtestemail',
          mailServer: 'mail.example.com',
          ttl: 300,
          priority: 10,
        },
      ],
      txt: [
        {
          name: 'sampletxttest',
          ttl: 300,
          content: 'v=spf1 include:_spf.example.com ~all',
        },
      ],
    }
    /* TODO before creating a hostedZone,
    * I want to check to delete the zone entirely to create from fresh the records.
    */

    const hostedZone = new route53.PublicHostedZone(this, 'HostedZone', {
      zoneName: dnsConfig.hostedZone,
    })

    // Create the A records
    for (const record of dnsConfig.a) {
      new route53.ARecord(this, `${record.name}Record`, {
        zone: hostedZone,
        target: route53.RecordTarget.fromIpAddresses(record.address),
        recordName: record.name,
        ttl: cdk.Duration.seconds(record.ttl),
      })
    }

    // Create the AAAA records
    for (const record of dnsConfig.aaaa) {
      new route53.AaaaRecord(this, `${record.name}Record`, {
        zone: hostedZone,
        target: route53.RecordTarget.fromIpAddresses(record.address),
        recordName: record.name,
        ttl: cdk.Duration.seconds(record.ttl),
      })
    }

    // Create the CNAME records
    for (const record of dnsConfig.cname) {
      new route53.CnameRecord(this, `${record.name}Record`, {
        zone: hostedZone,
        domainName: record.target,
        recordName: record.name,
        ttl: cdk.Duration.seconds(record.ttl),
      })
    }

    // Create the MX records
    for (const record of dnsConfig.mx) {
      new route53.MxRecord(this, `${record.name}Record`, {
        zone: hostedZone,
        values: [
          {
            hostName: record.mailServer,
            priority: record.priority,
          },
        ],
        recordName: record.name,
        ttl: cdk.Duration.seconds(record.ttl),
      })
    }

    // Create the TXT records
    for (const record of dnsConfig.txt) {
      new route53.TxtRecord(this, `${record.name}Record`, {
        zone: hostedZone,
        values: [record.content],
        recordName: record.name,
        ttl: cdk.Duration.seconds(record.ttl),
      })
    }
  }
}
