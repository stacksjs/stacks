import type { CloudStackConfig } from '../src/helpers'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { config as stacksConfig } from '@stacksjs/config'
import {
  deleteParameterStore,
  deleteStacksBuckets,
  deleteStacksFunctions,
  deleteSubnets,
  deleteVpcs,
  diffStackTemplate,
  getOrCreateTimestamp,
  hasBeenDeployed,
} from '../src/helpers'

/**
 * The cleanup and diff helpers act where `buddy deploy` put the stack
 * (stacksjs/stacks#2862 follow-up).
 *
 * Every one of them built its client for us-east-1, whatever region the app
 * was configured for, so `cloud:cleanup` after a removal in eu-west-2 listed
 * and deleted nothing of it - or, for `deleteVpcs()`/`deleteSubnets()`, listed
 * through one client and deleted through a raw request in yet another. The
 * diff asked for `<slug>-<env>` instead of the stack deploy creates.
 */

const savedRegion = process.env.AWS_REGION
const savedAppEnv = process.env.APP_ENV

beforeEach(() => {
  delete process.env.AWS_REGION
  delete process.env.APP_ENV
})

afterEach(() => {
  if (savedRegion === undefined)
    delete process.env.AWS_REGION
  else process.env.AWS_REGION = savedRegion
  if (savedAppEnv === undefined)
    delete process.env.APP_ENV
  else process.env.APP_ENV = savedAppEnv
})

const cloud: CloudStackConfig = { project: { name: 'acme', region: 'eu-west-2' } }
const appName = (stacksConfig.app.name || 'stacks').toLowerCase()

/** A client factory that records the region each client was built for. */
function recording<T>(make: () => T) {
  const regions: string[] = []
  return { regions, client: (region: string) => { regions.push(region); return make() } }
}

describe('cleanup helpers use the stack\'s region', () => {
  it('deleteParameterStore lists and deletes there', async () => {
    const deleted: string[] = []
    const { regions, client } = recording(() => ({
      describeParameters: async () => ({ Parameters: [{ Name: `/${appName}/key` }, { Name: '/other/key' }] }),
      deleteParameter: async ({ Name }: { Name: string }) => { deleted.push(Name) },
    }))

    const result = await deleteParameterStore({ config: cloud, client: client as never })

    expect(result.isOk).toBe(true)
    expect(regions).toEqual(['eu-west-2'])
    expect(deleted).toEqual([`/${appName}/key`])
  })

  it('deleteVpcs lists and deletes in the same region', async () => {
    const requests: Array<[string, string]> = []
    const { regions, client } = recording(() => ({
      describeVpcs: async () => ({ Vpcs: [{ VpcId: 'vpc-1', Tags: [{ Key: 'Name', Value: `${appName}-` }] }] }),
    }))

    await deleteVpcs({ config: cloud, client: client as never, request: async (region, action) => { requests.push([region, action]); return {} } })

    expect(regions).toEqual(['eu-west-2'])
    expect(requests).toEqual([['eu-west-2', 'DeleteVpc']])
  })

  it('deleteSubnets lists, detaches and deletes in the same region', async () => {
    const requests: Array<[string, string]> = []
    const { regions, client } = recording(() => ({
      describeSubnets: async () => ({ Subnets: [{ SubnetId: 'subnet-1', Tags: [{ Key: 'Name', Value: `${appName}-public-a` }] }] }),
    }))

    await deleteSubnets({
      config: cloud,
      client: client as never,
      request: async (region, action) => {
        requests.push([region, action])
        return action === 'DescribeNetworkInterfaces' ? { networkInterfaceSet: { item: [{ networkInterfaceId: 'eni-1' }] } } : {}
      },
    })

    expect(regions).toEqual(['eu-west-2'])
    expect(requests).toEqual([
      ['eu-west-2', 'DescribeNetworkInterfaces'],
      ['eu-west-2', 'DeleteNetworkInterface'],
      ['eu-west-2', 'DeleteSubnet'],
    ])
  })

  it('deleteStacksFunctions looks in the stack\'s region and in us-east-1, where Lambda@Edge lives', async () => {
    const deleted: string[] = []
    const regions: string[] = []
    const client = (region: string) => {
      regions.push(region)
      return {
        listFunctions: async () => ({ Functions: [{ FunctionName: `stacks-${region}` }, { FunctionName: 'unrelated' }] }),
        deleteFunction: async (name: string) => { deleted.push(name) },
      }
    }

    expect((await deleteStacksFunctions({ config: cloud, client: client as never })).isOk).toBe(true)
    expect(regions).toEqual(['eu-west-2', 'us-east-1'])
    expect(deleted.sort()).toEqual(['stacks-eu-west-2', 'stacks-us-east-1'])
  })

  it('deleteStacksFunctions asks us-east-1 once when the stack is there', async () => {
    const { regions, client } = recording(() => ({ listFunctions: async () => ({ Functions: [] }), deleteFunction: async () => {} }))
    await deleteStacksFunctions({ config: { project: { region: 'us-east-1' } }, client: client as never })
    expect(regions).toEqual(['us-east-1'])
  })

  it('deleteStacksBuckets, hasBeenDeployed and getOrCreateTimestamp build their clients there', async () => {
    const s3 = recording(() => ({ listBuckets: async () => ({ Buckets: [] }) }))
    const ssm = recording(() => ({ getParameter: async () => ({ Parameter: { Value: '1700000000000' } }), putParameter: async () => {} }))

    await deleteStacksBuckets({ config: cloud, client: s3.client as never })
    await hasBeenDeployed({ config: cloud, client: s3.client as never })
    expect(await getOrCreateTimestamp({ config: cloud, client: ssm.client as never })).toBe('1700000000000')

    expect(s3.regions).toEqual(['eu-west-2', 'eu-west-2'])
    expect(ssm.regions).toEqual(['eu-west-2'])
  })

  it('AWS_REGION still wins, as it does for buddy deploy', async () => {
    process.env.AWS_REGION = 'ca-central-1'
    const { regions, client } = recording(() => ({ describeParameters: async () => ({}) }))
    await deleteParameterStore({ config: cloud, client: client as never })
    expect(regions).toEqual(['ca-central-1'])
  })
})

describe('diffStackTemplate', () => {
  const template = { Resources: { Bucket: { Type: 'AWS::S3::Bucket', Properties: { BucketName: 'acme' } } } }

  function reader(answer: string | Error) {
    const calls: Array<{ region: string, stack: string }> = []
    return {
      calls,
      client: (region: string) => ({
        getTemplate: async (stack: string) => {
          calls.push({ region, stack })
          if (answer instanceof Error)
            throw answer
          return { TemplateBody: answer }
        },
      }),
    }
  }

  it('reads the stack buddy deploy creates, in its region', async () => {
    const { calls, client } = reader(JSON.stringify(template))
    await diffStackTemplate(JSON.stringify(template), { config: cloud, client })
    expect(calls).toEqual([{ region: 'eu-west-2', stack: 'acme-cloud' }])
  })

  it('sees no change when only the formatting differs', async () => {
    // deploy uploads compact JSON; the generator's toJSON() is indented.
    const { client } = reader(JSON.stringify(template))
    const result = await diffStackTemplate(JSON.stringify(template, null, 2), { config: cloud, client })

    expect(result.isOk && result.value).toMatchObject({ deployed: true, changed: false })
  })

  it('sees a change in the data', async () => {
    const { client } = reader(JSON.stringify(template))
    const local = { Resources: { Bucket: { ...template.Resources.Bucket, Properties: { BucketName: 'acme-2' } } } }
    const result = await diffStackTemplate(JSON.stringify(local), { config: cloud, client })

    expect(result.isOk && result.value.changed).toBe(true)
  })

  it('reports a missing stack as not deployed', async () => {
    const { client } = reader(new Error('ValidationError: Stack with id acme-cloud does not exist'))
    const result = await diffStackTemplate('{}', { config: cloud, client })

    expect(result.isOk && result.value).toMatchObject({ deployed: false, changed: true, deployedBytes: 0 })
  })

  it('reports any other failure as an error, not as "not deployed"', async () => {
    const { client } = reader(new Error('The security token included in the request is invalid'))
    const result = await diffStackTemplate('{}', { config: cloud, client })

    expect(result.isErr && result.error.message).toContain('security token')
  })
})

describe('every path names the stack buddy deploy creates', () => {
  const core = join(import.meta.dir, '../..')
  const read = (file: string) => readFileSync(join(core, file), 'utf8')

  it('builds no regional client for a hard-coded us-east-1 in helpers.ts', () => {
    // IAM is global; it is the only client that belongs in us-east-1.
    const clients = [...read('cloud/src/helpers.ts').matchAll(/new (\w+)\('us-east-1'\)/g)].map(m => m[1])
    expect(clients).toEqual(['IAMClient'])
  })

  it.each([
    'actions/deploy.ts',
    'actions/src/deploy/index.ts',
    'buddy/src/commands/cloud.ts',
    'buddy/src/commands/deploy.ts',
    'buddy/src/commands/email.ts',
    'buddy/src/commands/mail.ts',
  ])('%s derives no CloudFormation stack name of its own', (file) => {
    const source = read(file)
    expect(source).not.toMatch(/`\$\{(appName|projectName)\}-cloud`/)
    expect(source).not.toMatch(/project\?\.slug \|\| 'stacks'\}-\$\{environment\}/)
  })
})
