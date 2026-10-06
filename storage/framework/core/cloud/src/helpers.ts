import type { CountryCode } from '@stacksjs/ts-cloud'
import type { Result } from '@stacksjs/error-handling'
import type { ContactInfo } from '@stacksjs/types'
import { existsSync } from 'node:fs'
import process from 'node:process'
import {
  AWSClient,
  AWSCloudFormationClient as CloudFormationClient,
  CloudWatchLogsClient,
  EC2Client,
  IAMClient,
  LambdaClient,
  Route53DomainsClient,
  S3Client,
  SSMClient,
} from '@stacksjs/ts-cloud'
import { config } from '@stacksjs/config'
import { err, handleError, ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { path as p } from '@stacksjs/path'
import { slug } from '@stacksjs/strings'

/**
 * The part of `config/cloud.ts`'s `tsCloud` export this package reads: what
 * names the stack, where it lives, and whether it declares a jump box.
 *
 * `buddy deploy` hands the whole `tsCloud` object to ts-cloud's
 * `InfrastructureGenerator`; this is a structural slice of it, so a test can
 * pass a literal.
 */
export interface CloudStackConfig {
  project?: { name?: string, region?: string }
  environments?: Partial<Record<string, { region?: string } | undefined>>
  infrastructure?: { jumpBox?: boolean | { enabled?: boolean } }
}

/**
 * The `tsCloud` export of the app's `config/cloud.ts`, which is what
 * `buddy deploy` generates the stack from. An app without the file deploys
 * with ts-cloud's defaults, so it reads as empty; a file that fails to load
 * is an error, not an empty config.
 */
export async function loadCloudStackConfig(): Promise<CloudStackConfig> {
  const file = p.projectPath('config/cloud.ts')
  if (!existsSync(file))
    return {}

  const mod = await import(file)
  return (mod.tsCloud ?? {}) as CloudStackConfig
}

/**
 * The environment a deploy targets, resolved the way `buddy deploy` and
 * `cloud:remove` resolve it.
 */
export function cloudEnvironment(): string {
  return process.env.APP_ENV || process.env.NODE_ENV || 'production'
}

/**
 * The CloudFormation stack this app's AWS resources belong to: the one
 * `buddy deploy` creates and `cloud:remove` deletes, `<project.name>-cloud`.
 *
 * Both of those now ask this function, so the name has one owner. It used to
 * be `stacks-cloud-<env>`, a name nothing has created since the CDK deploy was
 * replaced, so every lookup through it - the jump box, `isFirstDeployment`,
 * `isFailedState` - asked AWS about a stack that does not exist.
 */
export async function stacksCloudName(cloud?: CloudStackConfig): Promise<string> {
  const { project } = cloud ?? await loadCloudStackConfig()
  return `${project?.name || 'stacks'}-cloud`
}

/**
 * The region the app's stack is deployed to.
 *
 * `AWS_REGION` wins, as it always has for `buddy deploy`. Without it, the
 * region `config/cloud.ts` declares for the environment, then the project's -
 * the same values ts-cloud places the stack's subnets in. The fallback used to
 * be a literal `us-east-1`, here and in the deploy, so an app configured for
 * any other region was deployed and looked up in the wrong one.
 */
export async function stacksCloudRegion(cloud?: CloudStackConfig, environment: string = cloudEnvironment()): Promise<string> {
  const { project, environments } = cloud ?? await loadCloudStackConfig()
  return process.env.AWS_REGION || environments?.[environment]?.region || project?.region || 'us-east-1'
}

/**
 * Helper to make raw EC2 API calls for actions not available on EC2Client
 */
async function ec2Request(action: string, params: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const client = new AWSClient()
  const queryParams: Record<string, string> = {
    Action: action,
    Version: '2016-11-15',
    ...params,
  }
  const result = await client.request({
    service: 'ec2',
    region: 'us-east-1',
    method: 'POST',
    path: '/',
    queryParams,
  })
  return result as Record<string, unknown>
}

/**
 * Helper to make raw CloudWatch Logs API calls for actions not available on CloudWatchLogsClient
 */
async function cwlRequest(region: string, action: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const client = new AWSClient()
  const result = await client.request({
    service: 'logs',
    region,
    method: 'POST',
    path: '/',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `Logs_20140328.${action}`,
    },
    body: JSON.stringify(payload),
  })
  return result as Record<string, unknown>
}

export async function getSecurityGroupId(securityGroupName: string): Promise<Result<string | undefined, string>> {
  const ec2 = new EC2Client(await stacksCloudRegion())
  const { SecurityGroups } = await ec2.describeSecurityGroups({
    Filters: [{ Name: 'group-name', Values: [securityGroupName] }],
  })

  if (!SecurityGroups)
    return err(`Security group ${securityGroupName} not found`)

  if (SecurityGroups[0])
    return ok(SecurityGroups[0].GroupId)

  return err(`Security group ${securityGroupName} not found`)
}

export interface PurchaseOptions {
  domain: string
  years: number
  privacy: boolean
  autoRenew: boolean
  adminFirstName: string
  adminLastName: string
  adminOrganization: string
  adminAddressLine1: string
  adminAddressLine2: string
  adminCity: string
  adminState: string
  adminCountry: CountryCode
  adminZip: string
  adminPhone: string
  adminEmail: string
  techFirstName: string
  techLastName: string
  techOrganization: string
  techAddressLine1: string
  techAddressLine2: string
  techCity: string
  techState: string
  techCountry: CountryCode
  techZip: string
  techPhone: string
  techEmail: string
  registrantFirstName: string
  registrantLastName: string
  registrantOrganization: string
  registrantAddressLine1: string
  registrantAddressLine2: string
  registrantCity: string
  registrantState: string
  registrantCountry: CountryCode
  registrantZip: string
  registrantPhone: string
  registrantEmail: string
  privacyAdmin: boolean
  privacyTech: boolean
  privacyRegistrant: boolean
  contactType: 'PERSON' | 'COMPANY' | 'ASSOCIATION' | 'PUBLIC_BODY' | 'RESELLER'
  verbose: boolean
}

/** The one Route 53 Domains call a purchase makes. Injectable, so a purchase can be tested without AWS. */
export interface DomainRegistrar {
  registerDomain: (input: Parameters<Route53DomainsClient['registerDomain']>[0]) => Promise<{ OperationId?: string }>
}

type ContactType = PurchaseOptions['contactType']

/**
 * The purchase options `config/dns.ts`'s `contactInfo` describes.
 *
 * Countries stay ts-cloud's ISO `CountryCode` union rather than a `string`
 * alias, so a typo in the config fails the typecheck instead of reaching AWS.
 *
 * The admin and tech contacts default to the registrant, field by field.
 * Privacy and auto-renew default to on, but only when unset: they were
 * written `value || fallback || true`, which is `true` whatever the value, so
 * `privacy: false` - which some TLDs require - could not be expressed.
 */
export function purchaseOptionsFromContactInfo(c: Partial<ContactInfo>): PurchaseOptions {
  const admin = c.admin ?? {} as Partial<ContactInfo>
  const tech = c.tech ?? {} as Partial<ContactInfo>
  const privacy = c.privacy ?? true
  const contactType = String(c.contactType || 'PERSON').toUpperCase() as ContactType

  return {
    domain: '',
    years: 1,
    privacy,
    autoRenew: true,
    registrantFirstName: c.firstName ?? '',
    registrantLastName: c.lastName ?? '',
    registrantOrganization: c.organizationName ?? '',
    registrantAddressLine1: c.addressLine1 ?? '',
    registrantAddressLine2: c.addressLine2 ?? '',
    registrantCity: c.city ?? '',
    registrantState: c.state ?? '',
    registrantCountry: c.countryCode as CountryCode,
    registrantZip: c.zip ?? '',
    registrantPhone: c.phoneNumber ?? '',
    registrantEmail: c.email ?? '',
    adminFirstName: admin.firstName || c.firstName || '',
    adminLastName: admin.lastName || c.lastName || '',
    adminOrganization: admin.organizationName || c.organizationName || '',
    adminAddressLine1: admin.addressLine1 || c.addressLine1 || '',
    adminAddressLine2: admin.addressLine2 || c.addressLine2 || '',
    adminCity: admin.city || c.city || '',
    adminState: admin.state || c.state || '',
    adminCountry: (admin.countryCode || c.countryCode) as CountryCode,
    adminZip: admin.zip || c.zip || '',
    adminPhone: admin.phoneNumber || c.phoneNumber || '',
    adminEmail: admin.email || c.email || '',
    techFirstName: tech.firstName || c.firstName || '',
    techLastName: tech.lastName || c.lastName || '',
    techOrganization: tech.organizationName || c.organizationName || '',
    techAddressLine1: tech.addressLine1 || c.addressLine1 || '',
    techAddressLine2: tech.addressLine2 || c.addressLine2 || '',
    techCity: tech.city || c.city || '',
    techState: tech.state || c.state || '',
    techCountry: (tech.countryCode || c.countryCode) as CountryCode,
    techZip: tech.zip || c.zip || '',
    techPhone: tech.phoneNumber || c.phoneNumber || '',
    techEmail: tech.email || c.email || '',
    privacyAdmin: c.privacyAdmin ?? privacy,
    privacyTech: c.privacyTech ?? privacy,
    privacyRegistrant: c.privacyRegistrant ?? privacy,
    contactType,
    verbose: false,
  }
}

/** `buddy domains:purchase` flags that name a registrant field, by the option they set. */
const REGISTRANT_FLAGS: Record<string, keyof PurchaseOptions> = {
  firstName: 'registrantFirstName',
  lastName: 'registrantLastName',
  organization: 'registrantOrganization',
  addressLine1: 'registrantAddressLine1',
  addressLine2: 'registrantAddressLine2',
  city: 'registrantCity',
  state: 'registrantState',
  country: 'registrantCountry',
  zip: 'registrantZip',
  phone: 'registrantPhone',
  email: 'registrantEmail',
}

/**
 * Lay the command line over the options config produced.
 *
 * The registrant flags are spelled for the person typing them -
 * `--first-name`, `--email` - and arrive as `firstName`, `email`, which no
 * purchase option is called, so every one of them was silently ignored. The
 * parser also hands everything over as strings: `--years 2` was `'2'`, and
 * `'false'` is the only way `--no-privacy` survives the trip to an action.
 */
export function applyPurchaseFlags(base: PurchaseOptions, flags: Record<string, unknown>): PurchaseOptions {
  const options: Record<string, unknown> = { ...base }

  for (const [flag, value] of Object.entries(flags)) {
    if (value === undefined || value === null || value === '')
      continue
    options[REGISTRANT_FLAGS[flag] ?? flag] = value
  }

  for (const key of ['privacy', 'autoRenew', 'privacyAdmin', 'privacyTech', 'privacyRegistrant', 'verbose'] as const) {
    if (options[key] === 'false')
      options[key] = false
    else if (options[key] === 'true')
      options[key] = true
  }

  // A privacy flag applies to every contact unless one was set on its own.
  if (flags.privacy !== undefined) {
    for (const key of ['privacyAdmin', 'privacyTech', 'privacyRegistrant'] as const) {
      if (flags[key] === undefined)
        options[key] = options.privacy
    }
  }

  const years = Number(options.years)
  options.years = Number.isInteger(years) && years > 0 ? years : 1
  if (typeof options.contactType === 'string')
    options.contactType = options.contactType.toUpperCase()

  return options as unknown as PurchaseOptions
}

/**
 * Register a domain through Route 53 Domains.
 *
 * Awaited, and its outcome returned. This used to hand back `ok(<the pending
 * request>)`, so a caller could only see that the request had been built: the
 * domain action then printed "Domain purchased successfully." and exited the
 * process while the request was still in flight, and an AWS rejection - a
 * taken name, an unsupported TLD, a bad contact - surfaced nowhere.
 *
 * Registration itself completes asynchronously at AWS. The operation id is
 * what Route 53 gives back to follow it.
 */
export async function purchaseDomain(
  domain: string,
  options: PurchaseOptions,
  registrar: DomainRegistrar = new Route53DomainsClient(),
): Promise<Result<{ OperationId: string }, Error>> {
  const contactType = (String(options.contactType || 'PERSON').toUpperCase()) as ContactType

  const formatPhone = (phone: string) =>
    phone.toString().includes('+') ? phone.toString() : `+${phone.toString()}`

  const contact = (prefix: 'admin' | 'registrant' | 'tech') => ({
    FirstName: options[`${prefix}FirstName`],
    LastName: options[`${prefix}LastName`],
    ContactType: contactType,
    OrganizationName: options[`${prefix}Organization`],
    AddressLine1: options[`${prefix}AddressLine1`],
    AddressLine2: options[`${prefix}AddressLine2`],
    City: options[`${prefix}City`],
    State: options[`${prefix}State`],
    CountryCode: options[`${prefix}Country`],
    ZipCode: String(options[`${prefix}Zip`] ?? ''),
    PhoneNumber: formatPhone(options[`${prefix}Phone`] ?? ''),
    Email: options[`${prefix}Email`],
  })

  try {
    const response = await registrar.registerDomain({
      DomainName: domain,
      DurationInYears: options.years || 1,
      AutoRenew: options.autoRenew ?? true,
      AdminContact: contact('admin'),
      RegistrantContact: contact('registrant'),
      TechContact: contact('tech'),
      PrivacyProtectAdminContact: options.privacyAdmin ?? options.privacy ?? true,
      PrivacyProtectRegistrantContact: options.privacyRegistrant ?? options.privacy ?? true,
      PrivacyProtectTechContact: options.privacyTech ?? options.privacy ?? true,
    })

    if (!response?.OperationId)
      return err(new Error(`Route 53 returned no operation id for ${domain}, so the registration cannot be confirmed.`))

    return ok({ OperationId: response.OperationId })
  }
  catch (error: unknown) {
    return err(error instanceof Error ? error : new Error(String(error)))
  }
}

/**
 * The CloudFormation calls the jump-box helpers make. ts-cloud's client by
 * default; a test passes a fake, as `purchaseDomain()` takes its registrar.
 */
export interface StackDescriber {
  describeStacks: (options: { stackName: string }) => Promise<{
    Stacks?: Array<{ StackStatus?: string, Outputs?: Array<{ OutputKey?: string, OutputValue?: string }> }>
  }>
}

export interface JumpBoxOptions {
  /** The `tsCloud` config. Defaults to the app's `config/cloud.ts`. */
  config?: CloudStackConfig
  /** Builds the CloudFormation client for the stack's region. */
  cloudFormation?: (region: string) => StackDescriber
}

/**
 * Where the app's jump box stands: what `config/cloud.ts` declares, and what
 * the deployed stack has.
 */
export interface JumpBoxState {
  stack: string
  region: string
  /** Whether `infrastructure.jumpBox` asks for one, as ts-cloud reads it. */
  declared: boolean
  /** Whether the stack exists in that region at all. */
  deployed: boolean
  /** The stack's `JumpBoxInstanceId` output, when it has a jump box. */
  instanceId?: string
}

/** The stack output ts-cloud's generator gives the jump box's instance id. */
export const JUMP_BOX_OUTPUT = 'JumpBoxInstanceId'

const JUMP_BOX_CONFIG_HINT = 'Set `infrastructure.jumpBox: true` in the `tsCloud` export of config/cloud.ts (or an object: `{ size, keyName, allowedCidrs, databaseTools, mountEfs }`), then run `buddy deploy`.'

/**
 * Whether the config asks for a jump box - `true`, or an object whose
 * `enabled` is not `false` - exactly as ts-cloud's `generateJumpBox()` reads it.
 */
export function declaresJumpBox(cloud: CloudStackConfig): boolean {
  const jumpBox = cloud.infrastructure?.jumpBox
  if (!jumpBox)
    return false
  return jumpBox === true || jumpBox.enabled !== false
}

/**
 * Reads the jump box from the deployed stack.
 *
 * The jump box is a resource of the app's stack: `infrastructure.jumpBox` in
 * `config/cloud.ts` makes ts-cloud generate the instance, its security group
 * and its SSM role, and publish the instance id as the `JumpBoxInstanceId`
 * output. This reads that output. It used to search EC2 for a `Name` tag of
 * `<stack>/JumpBox`, which neither the generator nor the old `addJumpBox()`
 * (`<stack>-jump-box`) ever wrote, always in us-east-1.
 */
export async function getJumpBoxState(options: JumpBoxOptions = {}): Promise<Result<JumpBoxState, Error>> {
  const cloud = options.config ?? await loadCloudStackConfig()
  const stack = await stacksCloudName(cloud)
  const region = await stacksCloudRegion(cloud)
  const cloudFormation = (options.cloudFormation ?? (r => new CloudFormationClient(r)))(region)
  const state: JumpBoxState = { stack, region, declared: declaresJumpBox(cloud), deployed: false }

  try {
    const { Stacks } = await cloudFormation.describeStacks({ stackName: stack })
    const deployed = Stacks?.[0]
    if (!deployed || deployed.StackStatus === 'DELETE_COMPLETE')
      return ok(state)

    state.deployed = true
    state.instanceId = deployed.Outputs?.find(output => output.OutputKey === JUMP_BOX_OUTPUT)?.OutputValue || undefined
    return ok(state)
  }
  catch (error: unknown) {
    const e = error instanceof Error ? error : new Error(String(error))
    // CloudFormation answers a DescribeStacks for a missing stack with a
    // ValidationError: "Stack with id <name> does not exist".
    if (/does not exist/i.test(e.message))
      return ok(state)
    return err(e)
  }
}

/**
 * The deployed jump box's instance id, or undefined when the stack has none.
 * Throws when the stack cannot be read, so a credentials or network failure
 * is not reported as "no jump box".
 */
export async function getJumpBoxInstanceId(options: JumpBoxOptions = {}): Promise<string | undefined> {
  const state = await getJumpBoxState(options)
  if (state.isErr)
    throw state.error
  return state.value.instanceId
}

/**
 * What `cloud:add --jump-box` and `cloud:remove --jump-box` found.
 *
 * `done` is true when the stack is already in the state asked for. Otherwise
 * `message` says what to change, since the change is a deploy.
 */
export interface JumpBoxChange {
  done: boolean
  message: string
  state: JumpBoxState
}

function report(done: boolean, state: JumpBoxState, message: string): JumpBoxChange {
  return { done, state, message }
}

function where(state: JumpBoxState): string {
  return `the ${state.stack} stack (${state.region})`
}

/**
 * Reports how to get a jump box. It does not create one.
 *
 * The instance belongs to the stack, so making it outside CloudFormation would
 * leave a resource the next deploy does not know about. This used to call
 * RunInstances itself, and could never get there: it refused when a jump box
 * existed, then read the security group from the existing jump box. Past
 * that, it named one account's subnet and AMI, in us-east-1, and cloned the
 * framework repository over the app's EFS mount.
 */
export async function addJumpBox(options: JumpBoxOptions = {}): Promise<Result<JumpBoxChange, string>> {
  const result = await getJumpBoxState(options)
  if (result.isErr)
    return err(`Could not read the jump box from the deployed stack: ${result.error.message}`)

  const state = result.value
  if (state.instanceId)
    return ok(report(true, state, `${where(state)} already has a jump box, ${state.instanceId}. Connect with \`buddy cloud --ssh\`.`))

  if (state.declared) {
    const missing = state.deployed ? 'has not been deployed with it yet' : 'is not deployed'
    return ok(report(false, state, `config/cloud.ts declares a jump box, but ${where(state)} ${missing}. Run \`buddy deploy\` to create it.`))
  }

  return ok(report(false, state, `${where(state)} has no jump box. ${JUMP_BOX_CONFIG_HINT}`))
}

/**
 * Reports how to remove the jump box. It does not terminate it.
 *
 * Terminating a stack-owned instance directly leaves CloudFormation describing
 * an instance that is gone, and the next update fails or recreates it. Removing
 * it from the config and deploying deletes it, with its security group and role.
 */
export async function deleteJumpBox(options: JumpBoxOptions = {}): Promise<Result<JumpBoxChange, string>> {
  const result = await getJumpBoxState(options)
  if (result.isErr)
    return err(`Could not read the jump box from the deployed stack: ${result.error.message}`)

  const state = result.value
  if (!state.instanceId) {
    const pending = state.declared ? ' config/cloud.ts still declares one, so the next `buddy deploy` creates it; remove `infrastructure.jumpBox` to keep it gone.' : ''
    return ok(report(true, state, `${where(state)} has no jump box.${pending}`))
  }

  if (state.declared)
    return ok(report(false, state, `${where(state)} has a jump box, ${state.instanceId}. Remove \`infrastructure.jumpBox\` from the \`tsCloud\` export of config/cloud.ts (or set \`enabled: false\`), then run \`buddy deploy\`; CloudFormation deletes the instance, its security group and its role.`))

  return ok(report(false, state, `${where(state)} still has a jump box, ${state.instanceId}, though config/cloud.ts no longer declares one. Run \`buddy deploy\` to remove it.`))
}

export async function deleteIamUsers(): Promise<Result<string, string>> {
  const iam = new IAMClient('us-east-1')
  const data = await iam.listUsers()
  const teamName = slug(config.team.name)
  const users
    = data.Users?.filter((user: unknown) => {
      const u = user as Record<string, unknown>
      const userNameLower = (u.UserName as string | undefined)?.toLowerCase()
      return (
        userNameLower !== 'stacks'
        && userNameLower !== teamName.toLowerCase()
        && userNameLower?.includes(teamName.toLowerCase())
      )
    }) || []

  if (!users || users.length === 0)
    return ok(`No Stacks IAM users found for team ${teamName}`)

  const promises = users.map(async (user: unknown) => {
    const u = user as Record<string, unknown>
    const userName = (u.UserName as string) || ''

    log.info(`Deleting IAM user: ${userName}`)

    // Get the list of policies attached to the user
    const policies = await iam.listAttachedUserPolicies({ UserName: userName })

    // Detach each policy
    await Promise.all(
      policies.AttachedPolicies?.map((policy: unknown) => {
        const p = policy as Record<string, unknown>
        return iam.detachUserPolicy({
          UserName: userName,
          PolicyArn: (p.PolicyArn as string) || '',
        })
      }) || [],
    )

    // Get the list of access keys for the user
    const accessKeys = await iam.listAccessKeys({ UserName: userName })

    // Delete each access key
    await Promise.all(
      accessKeys.AccessKeyMetadata?.map((key: unknown) => {
        const k = key as Record<string, unknown>
        return iam.deleteAccessKey({
          UserName: userName,
          AccessKeyId: (k.AccessKeyId as string) || '',
        })
      }) || [],
    )

    // Now delete the user
    return iam.deleteUser({ UserName: userName })
  })

  try {
    await Promise.all(promises)
  }
  catch (error) {
    console.error(error)
    return err(handleError('Error deleting Stacks IAM users').message)
  }

  return ok(`Stacks IAM users deleted for team ${teamName}`)
}

export async function deleteStacksBuckets(): Promise<Result<string, string | Error>> {
  try {
    const s3 = new S3Client('us-east-1')
    const data = await s3.listBuckets()
    const stacksBuckets = data.Buckets?.filter(bucket => bucket.Name?.includes('stacks'))

    if (!stacksBuckets)
      return err('No stacks buckets found') as unknown as Result<string, string | Error>

    const promises = stacksBuckets.map(async (bucket) => {
      const bucketName = bucket.Name || ''

      log.info(`Deleting bucket ${bucketName}...`)

      // List and delete all objects in the bucket with pagination
      let continuationToken: string | undefined
      let hasMoreObjects = true

      while (hasMoreObjects) {
        const objects = await s3.listObjects({
          bucket: bucketName,
          continuationToken,
        })

        // Delete all objects in this batch
        if (objects.objects && objects.objects.length > 0) {
          log.info(`Deleting ${objects.objects.length} objects from bucket ${bucketName}...`)

          await Promise.all(
            objects.objects.map((object: unknown) => {
              const o = object as Record<string, unknown>
              return s3.deleteObject(bucketName, (o.Key as string) || '')
            }),
          ).catch((error: unknown) => {
            log.error(`Failed to delete objects from bucket ${bucketName}:`, error)
            throw error
          })
        }

        // Check if there are more objects
        hasMoreObjects = !!objects.nextContinuationToken
        continuationToken = objects.nextContinuationToken
      }

      log.info(`Finished deleting objects from bucket ${bucketName}`)

      log.info(`Deleting bucket ${bucketName} versions...`)
      try {
        // Delete all versions and delete markers with pagination
        let keyMarker: string | undefined
        let versionIdMarker: string | undefined
        let hasMore = true

        while (hasMore) {
          const versions = await s3.listObjectVersions({
            bucket: bucketName,
            keyMarker,
            versionIdMarker,
          })

          // Delete versions in this batch
          if (versions.versions && versions.versions.length > 0) {
            await Promise.all(
              versions.versions.map((version: unknown) => {
                const v = version as Record<string, unknown>
                return s3.deleteObject(bucketName, (v.Key as string) || '')
              }),
            ).catch((error: unknown) => handleError(error as Error))
            log.info(`Deleted ${versions.versions.length} versions from bucket ${bucketName}`)
          }

          // Delete delete markers in this batch
          if (versions.deleteMarkers && versions.deleteMarkers.length > 0) {
            await Promise.all(
              versions.deleteMarkers.map((marker: unknown) => {
                const m = marker as Record<string, unknown>
                return s3.deleteObject(bucketName, (m.Key as string) || '')
              }),
            ).catch((error: unknown) => handleError(error as Error))
            log.info(`Deleted ${versions.deleteMarkers.length} delete markers from bucket ${bucketName}`)
          }

          // Check if there are more items
          hasMore = !!versions.nextKeyMarker
          keyMarker = versions.nextKeyMarker
          versionIdMarker = versions.nextVersionIdMarker
        }

        log.info(`Finished deleting all versions from bucket ${bucketName}`)

        // If the bucket has uncompleted multipart uploads, abort them
        const uploads = await s3.listMultipartUploads(bucketName)
        if (uploads && uploads.length > 0) {
          log.info('Aborting bucket multipart uploads...')

          await Promise.all(
            uploads.map((upload: unknown) => {
              const u = upload as Record<string, unknown>
              return s3.abortMultipartUpload(
                bucketName,
                (u.Key as string) || '',
                (u.UploadId as string) || '',
              )
            }),
          ).catch((error: unknown) => handleError(error as Error))

          log.info(`Finished aborting multipart uploads from bucket ${bucketName}`)
        }

        await s3.deleteBucket(bucketName).catch((error: unknown) => handleError(error as Error))

        log.info(`Bucket ${bucketName} deleted`)
      }
      catch (error) {
        log.info(`Error listing bucket ${bucketName} versions`, error)
      }
    })

    await Promise.all(promises).catch((error: Error) => {
      console.error(error)
      return err(handleError('Error deleting stacks buckets'))
    })

    return ok('Stacks buckets deleted')
  }
  catch (error) {
    return err(handleError('Error deleting stacks buckets', error)) as unknown as Result<string, string | Error>
  }
}

export async function deleteStacksFunctions(): Promise<Result<string, string>> {
  const lambda = new LambdaClient('us-east-1')
  const data = await lambda.listFunctions()
  const stacksFunctions = data.Functions?.filter((func: unknown) => {
    const f = func as Record<string, unknown>
    return (f.FunctionName as string | undefined)?.includes('stacks')
  }) || []

  if (!stacksFunctions || stacksFunctions.length === 0)
    return ok('No stacks functions found')

  const promises = stacksFunctions.map((func: unknown) => {
    const f = func as Record<string, unknown>
    return lambda.deleteFunction((f.FunctionName as string) || '')
  })

  try {
    await Promise.all(promises)
  }
  catch (error) {
    const e = error as Error
    if (e.message.includes('it is a replicated function')) {
      log.info('Function is replicated, skipping...')
      return ok('CloudFront is still deleting the some functions. Try again later.')
    }
    return err(handleError('Error deleting stacks functions', e).message)
  }

  return ok('Stacks functions deleted')
}

export async function deleteLogGroups(): Promise<Result<string, Error>> {
  try {
    // Use raw EC2 API call for describeRegions since EC2Client doesn't expose it
    const regionsResult = await ec2Request('DescribeRegions')
    const regionSet = regionsResult.regionInfo as unknown as Record<string, unknown>
    const regionItems = (regionSet?.item ?? regionsResult.Regions ?? regionsResult.regionSet ?? []) as unknown as Array<Record<string, unknown>>
    // Extract region names - the XML response structure may vary
    const regions: string[] = []
    if (Array.isArray(regionItems)) {
      for (const r of regionItems) {
        const name = (r.regionName ?? r.RegionName) as string | undefined
        if (name)
          regions.push(name)
      }
    }

    for (const region of regions) {
      const client = new CloudWatchLogsClient(region)
      const logGroups = await client.describeLogGroups()

      if (logGroups?.logGroups) {
        for (const group of logGroups.logGroups) {
          const appName = config.app.name?.toLocaleLowerCase() || 'stacks'
          if (group.logGroupName?.includes(appName)) {
            // Use raw CloudWatch Logs API call for deleteLogGroup since CloudWatchLogsClient doesn't expose it
            await cwlRequest(region, 'DeleteLogGroup', { logGroupName: group.logGroupName })
          }
        }
      }
    }

    return ok('Log groups deleted in all regions')
  }
  catch (error) {
    return err(handleError('Error deleting log groups', error))
  }
}

export async function deleteParameterStore(): Promise<Result<string, string>> {
  const ssm = new SSMClient('us-east-1')
  const data = await ssm.describeParameters()

  if (!data.Parameters)
    return ok('No parameters found')

  const appName = config.app.name?.toLocaleLowerCase() || 'stacks'
  const stacksParameters = data.Parameters.filter((param: unknown) => {
    const p = param as Record<string, unknown>
    return (p.Name as string | undefined)?.includes(appName)
  }) || []

  if (!stacksParameters || stacksParameters.length === 0)
    return ok('No stacks parameters found')

  const promises = stacksParameters.map((param: unknown) => {
    const p = param as Record<string, unknown>
    return ssm.deleteParameter({ Name: (p.Name as string) || '' })
  })

  try {
    await Promise.all(promises)
  }
  catch (error) {
    return err(handleError('Error deleting parameter store', error as Error).message)
  }

  return ok('Parameter store deleted')
}

export async function deleteVpcs(): Promise<Result<string, Error>> {
  const ec2 = new EC2Client('us-east-1')
  const vpcNamePattern = config.app.name ? `${config.app.name.toLowerCase()}-` : 'stacks-'

  try {
    const { Vpcs } = await ec2.describeVpcs()

    if (!Vpcs || Vpcs.length === 0) {
      return ok('No VPCs found')
    }

    // Filter VPCs based on the name pattern
    const vpcsToDel = Vpcs.filter((vpc: unknown) => {
      const v = vpc as Record<string, unknown>
      const tags = v.Tags as Array<Record<string, unknown>> | undefined
      return tags?.some((tag: Record<string, unknown>) => tag.Key === 'Name' && tag.Value === vpcNamePattern)
    })

    if (vpcsToDel.length === 0) {
      return ok(`No VPCs found matching the pattern: ${vpcNamePattern}`)
    }

    // Delete each matching VPC using raw EC2 API call
    for (const vpc of vpcsToDel) {
      if (vpc.VpcId) {
        await ec2Request('DeleteVpc', { VpcId: vpc.VpcId })
        log.info(`Deleted VPC: ${vpc.VpcId} (${vpcNamePattern})`)
      }
    }

    return ok(`Deleted ${vpcsToDel.length} VPCs matching the pattern: ${vpcNamePattern}`)
  }
  catch (error) {
    return err(handleError(`Error deleting VPCs: ${error}`))
  }
}

export async function deleteCdkRemnants(): Promise<Result<string, Error>> {
  try {
    await Bun.$`rm -rf ${p.cloudPath('cdk.out/')} ${p.cloudPath('cdk.context.json')}`.text()
    return ok('CDK remnants deleted')
  }
  catch (error) {
    return err(handleError('Error deleting CDK remnants', error))
  }
}

export async function deleteSubnets(): Promise<Result<string, Error>> {
  const ec2 = new EC2Client('us-east-1')
  const subnetNamePattern = config.app.name ? `${config.app.name.toLowerCase()}-` : 'stacks-'

  try {
    const { Subnets } = await ec2.describeSubnets()

    if (!Subnets || Subnets.length === 0) {
      return ok('No subnets found')
    }

    // Filter subnets based on the name pattern
    const subnetsToDel = Subnets.filter((subnet: unknown) => {
      const s = subnet as Record<string, unknown>
      const tags = s.Tags as Array<Record<string, unknown>> | undefined
      return tags?.some((tag: Record<string, unknown>) => tag.Key === 'Name' && (tag.Value as string)?.startsWith(subnetNamePattern))
    })

    if (subnetsToDel.length === 0) {
      return ok(`No subnets found matching the pattern: ${subnetNamePattern}`)
    }

    // Delete dependencies and subnets
    for (const subnet of subnetsToDel) {
      if (subnet.SubnetId) {
        // Describe network interfaces in the subnet using raw EC2 API call
        const niResult = await ec2Request('DescribeNetworkInterfaces', {
          'Filter.1.Name': 'subnet-id',
          'Filter.1.Value.1': subnet.SubnetId,
        })
        const niSet = niResult.networkInterfaceSet as unknown as Record<string, unknown> | undefined
        const networkInterfaces = (niSet?.item ?? []) as unknown as Array<Record<string, unknown>>

        // Delete network interfaces
        for (const ni of Array.isArray(networkInterfaces) ? networkInterfaces : []) {
          const niId = ni.networkInterfaceId as string | undefined
          if (niId) {
            const attachment = ni.attachment as Record<string, unknown> | undefined
            // If the network interface is attached to an instance, terminate the instance
            if (attachment?.instanceId) {
              await ec2.terminateInstances([attachment.instanceId as string])
              log.info(`Terminated instance: ${attachment.instanceId}`)

              // Wait for the instance to terminate
              await new Promise(resolve => setTimeout(resolve, 60000))
            }

            // Detach the network interface if it's attached
            if (attachment?.attachmentId) {
              await ec2Request('DetachNetworkInterface', {
                AttachmentId: attachment.attachmentId as string,
                Force: 'true',
              })
              log.info(`Detached network interface: ${niId}`)

              // Wait for the detachment to complete
              await new Promise(resolve => setTimeout(resolve, 10000))
            }

            // Delete the network interface
            await ec2Request('DeleteNetworkInterface', { NetworkInterfaceId: niId })
            log.info(`Deleted network interface: ${niId}`)
          }
        }

        // Delete the subnet using raw EC2 API call
        await ec2Request('DeleteSubnet', { SubnetId: subnet.SubnetId })
        log.info(`Deleted subnet: ${subnet.SubnetId} (${subnet.Tags?.find((tag: unknown) => (tag as Record<string, unknown>).Key === 'Name')?.Value})`)
      }
    }

    return ok(`Deleted ${subnetsToDel.length} subnets matching the pattern: ${subnetNamePattern}`)
  }
  catch (error) {
    return err(handleError(`Error deleting subnets: ${error}`))
  }
}

export async function hasBeenDeployed(): Promise<Result<boolean, Error>> {
  const s3 = new S3Client('us-east-1')

  try {
    const response = await s3.listBuckets()

    return ok(
      response.Buckets?.some(bucket => bucket.Name?.includes(config.app.name?.toLocaleLowerCase() || 'stacks'))
      || false,
    )
  }
  catch (error) {
    console.error(error)
    return err(handleError('Error checking if the app has been deployed'))
  }
}

export async function isFirstDeployment(): Promise<boolean> {
  const cloud = await loadCloudStackConfig()
  const stackName = await stacksCloudName(cloud)
  const cloudFormation = new CloudFormationClient(await stacksCloudRegion(cloud))
  const data = await cloudFormation.listStacks(['CREATE_COMPLETE', 'UPDATE_COMPLETE'])
  const isStacksCloudPresent = data.StackSummaries?.some((stack: unknown) => {
    const s = stack as Record<string, unknown>
    return s.StackName === stackName
  })

  return !isStacksCloudPresent
}

/**
 * Whether the app's stack is in a failed state.
 *
 * True when it is listed among the failed statuses. This returned the
 * negation - "not among the failed stacks" - so a failed stack read as
 * healthy and a healthy one as failed.
 */
export async function isFailedState(): Promise<boolean> {
  const cloud = await loadCloudStackConfig()
  const stackName = await stacksCloudName(cloud)
  const cloudFormation = new CloudFormationClient(await stacksCloudRegion(cloud))
  const data = await cloudFormation.listStacks(['CREATE_FAILED', 'UPDATE_FAILED', 'ROLLBACK_COMPLETE', 'UPDATE_ROLLBACK_COMPLETE'])
  return Boolean(data.StackSummaries?.some((stack: unknown) => (stack as Record<string, unknown>).StackName === stackName))
}

export async function getOrCreateTimestamp(): Promise<string> {
  const parameterName = `/stacks/timestamp`
  const ssm = new SSMClient('us-east-1')

  try {
    const response = await ssm.getParameter({ Name: parameterName })
    const timestamp = response.Parameter ? response.Parameter.Value : undefined

    if (!timestamp)
      throw new Error('Timestamp parameter not found')

    return timestamp
  }
  catch (error: unknown) {
    const timestamp = new Date().getTime().toString()
    log.debug(`Creating timestamp parameter ${parameterName} with value ${timestamp}`, error)

    await ssm.putParameter({
      Name: parameterName,
      Value: timestamp,
      Type: 'String',
    })

    return timestamp
  }
}

// get the CloudFront distribution ID of the current stack
export async function getCloudFrontDistributionId(): Promise<string> {
  return ''
}
