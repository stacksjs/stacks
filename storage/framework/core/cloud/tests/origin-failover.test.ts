import type { CloudConfig } from '@stacksjs/ts-cloud'
import { describe, expect, test } from 'bun:test'
import * as tsCloud from '@stacksjs/ts-cloud'
import { tsCloud as projectCloudConfig } from '~/config/cloud'
import { Cloud } from '../src/cloud'

// CloudFront origin failover (stacksjs/stacks#1159). config/cloud.ts's
// `tsCloud` reaches ts-cloud's generator unchanged, through this Cloud class
// and through both deploy paths (actions/deploy.ts, @stacksjs/deploy), so
// these tests drive the generator the way a deploy does.

function failoverConfig(storage: Record<string, any>): CloudConfig {
  return {
    project: { name: 'Failover App', slug: 'failover-app', region: 'us-east-1' },
    environments: { production: { type: 'production' } },
    infrastructure: {
      dns: { domain: 'example.com' },
      ssl: { certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/abc' },
      storage,
    },
  } as CloudConfig
}

function generate(config: CloudConfig): any {
  return JSON.parse(new Cloud(config, { appEnv: 'production' } as any).generate())
}

describe('origin failover through the Stacks cloud config', () => {
  test('is off by default in config/cloud.ts', () => {
    for (const bucket of Object.values(projectCloudConfig.infrastructure?.storage ?? {}))
      expect((bucket as { failover?: unknown }).failover).toBeUndefined()
    for (const cdn of Object.values(projectCloudConfig.infrastructure?.cdn ?? {}))
      expect((cdn as { failoverOrigin?: unknown }).failoverOrigin).toBeUndefined()
  })

  test('a website bucket with failover gets an origin group, replication and a replica record', () => {
    const template = generate(failoverConfig({
      public: { website: true, failover: { region: 'us-west-2', connectionAttempts: 1, connectionTimeout: 3 } },
    }))

    const distribution = Object.values<any>(template.Resources).find(r => r.Type === 'AWS::CloudFront::Distribution')
    const config = distribution.Properties.DistributionConfig
    expect(config.OriginGroups.Items[0].Members.Items.map((m: any) => m.OriginId)).toEqual([
      'S3-failover-app-production-public',
      'S3-failover-app-production-public-failover',
    ])
    expect(config.OriginGroups.Items[0].FailoverCriteria.StatusCodes.Items).toEqual([403, 404, 500, 502, 503, 504])
    expect(config.DefaultCacheBehavior.TargetOriginId).toBe(config.OriginGroups.Items[0].Id)
    expect(config.Origins[0]).toMatchObject({ ConnectionAttempts: 1, ConnectionTimeout: 3 })
    expect(config.Origins[1].DomainName).toBe('failover-app-production-public-us-west-2.s3.us-west-2.amazonaws.com')

    const bucket = Object.values<any>(template.Resources).find(r => r.Type === 'AWS::S3::Bucket')
    expect(bucket.Properties.ReplicationConfiguration.Rules[0].Destination.Bucket).toBe(
      'arn:aws:s3:::failover-app-production-public-us-west-2',
    )

    // What the deploy reads to create the replica before the stack and grant
    // the distribution access after it.
    expect(tsCloud.storageFailoverReplicasFromTemplate(template)).toEqual([
      {
        name: 'public',
        primaryBucket: 'failover-app-production-public',
        primaryRegion: 'us-east-1',
        replicaBucket: 'failover-app-production-public-us-west-2',
        replicaRegion: 'us-west-2',
        replicate: true,
        distributionArnOutput: 'publicCloudFrontDistributionArn',
      },
    ])
    expect(template.Outputs.publicCloudFrontDistributionArn).toBeDefined()
  })

  test('a bad failover config fails at generation, before anything deploys', () => {
    expect(() => generate(failoverConfig({ public: { website: true, failover: { region: 'us-east-1' } } })))
      .toThrow(/same region as the primary bucket/)
    expect(() => generate(failoverConfig({ public: { website: true, failover: { region: 'us-west-2', statusCodes: [501] } } })))
      .toThrow(/501 is not a status code CloudFront can fail over on/)
    expect(() => generate(failoverConfig({ public: { website: true, failover: { region: 'us-west-2', connectionTimeout: 30 } } })))
      .toThrow(/connectionTimeout \(seconds\) must be a whole number from 1 to 10/)
  })

  test('the deploy paths have the replica steps they call', () => {
    for (const name of ['ensureFailoverReplicaBuckets', 'grantFailoverReplicaAccess', 'seedFailoverReplicas', 'storageFailoverReplicasFromTemplate'] as const)
      expect(typeof tsCloud[name]).toBe('function')
  })
})
