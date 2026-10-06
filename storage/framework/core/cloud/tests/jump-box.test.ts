import type { CloudStackConfig, StackDescriber } from '../src/helpers'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { InfrastructureGenerator } from '@stacksjs/ts-cloud'
import {
  addJumpBox,
  declaresJumpBox,
  deleteJumpBox,
  getJumpBoxInstanceId,
  getJumpBoxState,
  JUMP_BOX_OUTPUT,
} from '../src/helpers'

/**
 * The jump box is a resource of the app's stack (stacksjs/stacks#2862).
 *
 * `addJumpBox()` could never create one: it refused when a jump box existed,
 * then read the security group from the existing jump box. Past that it
 * called RunInstances with one account's subnet and AMI, in us-east-1, and
 * cloned the framework repository over the app's EFS mount. The instance it
 * would have made was tagged `<stack>-jump-box` while `getJumpBoxInstanceId()`
 * searched for `<stack>/JumpBox`, so nothing could find or remove it either.
 *
 * ts-cloud already generates a jump box from `infrastructure.jumpBox` and
 * publishes its id as the `JumpBoxInstanceId` stack output. These pin that the
 * helpers read that output, from the stack `buddy deploy` creates, in the
 * configured region, and that add/remove say what to change instead of
 * creating or terminating an instance behind CloudFormation's back.
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

type DescribeResult = Awaited<ReturnType<StackDescriber['describeStacks']>>

function recordingCloudFormation(answer: DescribeResult | Error) {
  const calls: Array<{ region: string, stackName: string }> = []
  return {
    calls,
    cloudFormation: (region: string): StackDescriber => ({
      describeStacks: async ({ stackName }) => {
        calls.push({ region, stackName })
        if (answer instanceof Error)
          throw answer
        return answer
      },
    }),
  }
}

function deployedStack(outputs: Record<string, string> = {}): DescribeResult {
  return {
    Stacks: [{
      StackStatus: 'UPDATE_COMPLETE',
      Outputs: Object.entries(outputs).map(([OutputKey, OutputValue]) => ({ OutputKey, OutputValue })),
    }],
  }
}

const missingStack = new Error('ValidationError: Stack with id acme-cloud does not exist')

const config = (jumpBox?: NonNullable<CloudStackConfig['infrastructure']>['jumpBox']): CloudStackConfig => ({
  project: { name: 'acme', region: 'eu-west-2' },
  infrastructure: { jumpBox },
})

describe('getJumpBoxInstanceId', () => {
  it('reads the JumpBoxInstanceId output of the deployed stack, in the configured region', async () => {
    const { calls, cloudFormation } = recordingCloudFormation(deployedStack({ [JUMP_BOX_OUTPUT]: 'i-0abc', appInstanceId: 'i-0app' }))

    expect(await getJumpBoxInstanceId({ config: config(true), cloudFormation })).toBe('i-0abc')
    expect(calls).toEqual([{ region: 'eu-west-2', stackName: 'acme-cloud' }])
  })

  it('reads the region the environment declares before the project\'s', async () => {
    process.env.APP_ENV = 'staging'
    const { calls, cloudFormation } = recordingCloudFormation(deployedStack({ [JUMP_BOX_OUTPUT]: 'i-0abc' }))

    await getJumpBoxInstanceId({
      config: { ...config(true), environments: { staging: { region: 'ap-southeast-2' } } },
      cloudFormation,
    })
    expect(calls[0]?.region).toBe('ap-southeast-2')
  })

  it('looks where `buddy deploy` deploys when AWS_REGION is set', async () => {
    process.env.AWS_REGION = 'ca-central-1'
    const { calls, cloudFormation } = recordingCloudFormation(deployedStack())

    await getJumpBoxInstanceId({ config: config(true), cloudFormation })
    expect(calls[0]?.region).toBe('ca-central-1')
  })

  it('is undefined for a stack without one, and for no stack at all', async () => {
    expect(await getJumpBoxInstanceId({ config: config(), cloudFormation: recordingCloudFormation(deployedStack()).cloudFormation })).toBeUndefined()
    expect(await getJumpBoxInstanceId({ config: config(), cloudFormation: recordingCloudFormation(missingStack).cloudFormation })).toBeUndefined()
  })

  it('throws when the stack cannot be read, rather than reporting no jump box', async () => {
    const { cloudFormation } = recordingCloudFormation(new Error('The security token included in the request is invalid'))
    await expect(getJumpBoxInstanceId({ config: config(true), cloudFormation })).rejects.toThrow('security token')
  })
})

describe('getJumpBoxState', () => {
  it('tells a missing stack from a deployed one without a jump box', async () => {
    const missing = await getJumpBoxState({ config: config(), cloudFormation: recordingCloudFormation(missingStack).cloudFormation })
    const bare = await getJumpBoxState({ config: config(), cloudFormation: recordingCloudFormation(deployedStack()).cloudFormation })

    expect(missing.isOk && missing.value).toEqual({ stack: 'acme-cloud', region: 'eu-west-2', declared: false, deployed: false })
    expect(bare.isOk && bare.value).toEqual({ stack: 'acme-cloud', region: 'eu-west-2', declared: false, deployed: true, instanceId: undefined })
  })
})

describe('addJumpBox', () => {
  it('reports the jump box the stack already has', async () => {
    const { cloudFormation } = recordingCloudFormation(deployedStack({ [JUMP_BOX_OUTPUT]: 'i-0abc' }))
    const result = await addJumpBox({ config: config(true), cloudFormation })

    expect(result.isOk && result.value.done).toBe(true)
    expect(result.isOk && result.value.message).toContain('i-0abc')
    expect(result.isOk && result.value.message).toContain('buddy cloud --ssh')
  })

  it('says to declare infrastructure.jumpBox and deploy when the config has none', async () => {
    const { cloudFormation } = recordingCloudFormation(deployedStack())
    const result = await addJumpBox({ config: config(), cloudFormation })

    expect(result.isOk && result.value.done).toBe(false)
    expect(result.isOk && result.value.message).toContain('infrastructure.jumpBox: true')
    expect(result.isOk && result.value.message).toContain('config/cloud.ts')
    expect(result.isOk && result.value.message).toContain('buddy deploy')
  })

  it('says to deploy when the config declares one the stack does not have yet', async () => {
    const { cloudFormation } = recordingCloudFormation(missingStack)
    const result = await addJumpBox({ config: config({ size: 'small' } as never), cloudFormation })

    expect(result.isOk && result.value.done).toBe(false)
    expect(result.isOk && result.value.message).toContain('declares a jump box')
    expect(result.isOk && result.value.message).toContain('is not deployed')
    expect(result.isOk && result.value.message).toContain('buddy deploy')
  })

  it('reports an AWS failure as an error', async () => {
    const { cloudFormation } = recordingCloudFormation(new Error('Throttling'))
    const result = await addJumpBox({ config: config(true), cloudFormation })

    expect(result.isErr && result.error).toContain('Throttling')
  })
})

describe('deleteJumpBox', () => {
  it('has nothing to do when the stack has no jump box', async () => {
    const { cloudFormation } = recordingCloudFormation(deployedStack())
    const result = await deleteJumpBox({ config: config(), cloudFormation })

    expect(result.isOk && result.value.done).toBe(true)
  })

  it('warns that a still-declared jump box comes back on the next deploy', async () => {
    const { cloudFormation } = recordingCloudFormation(missingStack)
    const result = await deleteJumpBox({ config: config(true), cloudFormation })

    expect(result.isOk && result.value.done).toBe(true)
    expect(result.isOk && result.value.message).toContain('next `buddy deploy` creates it')
  })

  it('says to remove infrastructure.jumpBox and deploy, instead of terminating the instance', async () => {
    const { cloudFormation } = recordingCloudFormation(deployedStack({ [JUMP_BOX_OUTPUT]: 'i-0abc' }))
    const result = await deleteJumpBox({ config: config(true), cloudFormation })

    expect(result.isOk && result.value.done).toBe(false)
    expect(result.isOk && result.value.message).toContain('Remove `infrastructure.jumpBox`')
    expect(result.isOk && result.value.message).toContain('buddy deploy')
  })

  it('says to deploy when the config already dropped it', async () => {
    const { cloudFormation } = recordingCloudFormation(deployedStack({ [JUMP_BOX_OUTPUT]: 'i-0abc' }))
    const result = await deleteJumpBox({ config: config({ enabled: false }), cloudFormation })

    expect(result.isOk && result.value.done).toBe(false)
    expect(result.isOk && result.value.message).toContain('no longer declares one')
  })
})

describe('the jump box ts-cloud generates', () => {
  // The helpers read the output and the `enabled` switch the generator
  // writes; this fails if either side renames or reinterprets them.
  function outputs(jumpBox: unknown): Record<string, unknown> {
    const generator = new InfrastructureGenerator({
      config: {
        project: { name: 'acme', slug: 'acme', region: 'eu-west-2' },
        environments: { production: { type: 'production', region: 'eu-west-2' } },
        infrastructure: { jumpBox },
      } as never,
      environment: 'production',
    })
    return JSON.parse(generator.generate().toJSON()).Outputs ?? {}
  }

  it.each([
    [true],
    [{ size: 'small' }],
    [{ enabled: true, databaseTools: true }],
    [{ enabled: false }],
    [undefined],
  ])('agrees with declaresJumpBox() for %p', (jumpBox) => {
    expect(JUMP_BOX_OUTPUT in outputs(jumpBox)).toBe(declaresJumpBox(config(jumpBox as never)))
  })
})

describe('helpers.ts', () => {
  const source = readFileSync(join(import.meta.dir, '../src/helpers.ts'), 'utf8')

  it('names no account-specific subnet or AMI', () => {
    expect(source).not.toMatch(/subnet-[0-9a-f]{8,}/)
    expect(source).not.toMatch(/ami-[0-9a-f]{8,}/)
  })

  it('launches no instance outside the stack', () => {
    expect(source).not.toMatch(/['"]RunInstances['"]/)
  })
})
