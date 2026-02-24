import type { Result } from '@stacksjs/error-handling'
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

const appEnv = config.app.env === 'local' ? 'dev' : config.app.env
const cloudName = `stacks-cloud-${appEnv}`

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

/**
 * Helper to make raw EFS API calls since EFSClient is not available
 */
async function efsRequest(action: string, method: string, path: string): Promise<Record<string, unknown>> {
  const client = new AWSClient()
  const result = await client.request({
    service: 'elasticfilesystem',
    region: 'us-east-1',
    method,
    path,
  })
  return result as Record<string, unknown>
}

export async function getSecurityGroupId(securityGroupName: string): Promise<Result<string | undefined, string>> {
  const ec2 = new EC2Client('us-east-1')
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
  adminCountry: string
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
  techCountry: string
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
  registrantCountry: string
  registrantZip: string
  registrantPhone: string
  registrantEmail: string
  privacyAdmin: boolean
  privacyTech: boolean
  privacyRegistrant: boolean
  contactType: 'PERSON' | 'COMPANY' | 'ASSOCIATION' | 'PUBLIC_BODY' | 'RESELLER'
  verbose: boolean
}

export function purchaseDomain(
  domain: string,
  options: PurchaseOptions,
): Result<Promise<{ OperationId: string }>, Error> {
  const route53domains = new Route53DomainsClient()
  const contactType = (options.contactType.toUpperCase() || 'PERSON') as 'PERSON' | 'COMPANY' | 'ASSOCIATION' | 'PUBLIC_BODY' | 'RESELLER'

  const formatPhone = (phone: string) =>
    phone.toString().includes('+') ? phone.toString() : `+${phone.toString()}`

  try {
    return ok(route53domains.registerDomain({
      DomainName: domain,
      DurationInYears: options.years || 1,
      AutoRenew: options.autoRenew || true,
      AdminContact: {
        FirstName: options.adminFirstName,
        LastName: options.adminLastName,
        ContactType: contactType,
        OrganizationName: options.adminOrganization,
        AddressLine1: options.adminAddressLine1,
        AddressLine2: options.adminAddressLine2,
        City: options.adminCity,
        State: options.adminState,
        CountryCode: options.adminCountry,
        ZipCode: options.adminZip.toString(),
        PhoneNumber: formatPhone(options.adminPhone),
        Email: options.adminEmail,
      },
      RegistrantContact: {
        FirstName: options.registrantFirstName,
        LastName: options.registrantLastName,
        ContactType: contactType,
        OrganizationName: options.registrantOrganization,
        AddressLine1: options.registrantAddressLine1,
        AddressLine2: options.registrantAddressLine2,
        City: options.registrantCity,
        State: options.registrantState,
        CountryCode: options.registrantCountry,
        ZipCode: options.registrantZip.toString(),
        PhoneNumber: formatPhone(options.registrantPhone),
        Email: options.registrantEmail,
      },
      TechContact: {
        FirstName: options.techFirstName,
        LastName: options.techLastName,
        ContactType: contactType,
        OrganizationName: options.techOrganization,
        AddressLine1: options.techAddressLine1,
        AddressLine2: options.techAddressLine2,
        City: options.techCity,
        State: options.techState,
        CountryCode: options.techCountry,
        ZipCode: options.techZip.toString(),
        PhoneNumber: formatPhone(options.techPhone),
        Email: options.techEmail,
      },
      PrivacyProtectAdminContact: options.privacyAdmin || options.privacy || true,
      PrivacyProtectRegistrantContact: options.privacyRegistrant || options.privacy || true,
      PrivacyProtectTechContact: options.privacyTech || options.privacy || true,
    }))
  }
  catch (error: unknown) {
    return err(error as Error)
  }
}

export async function getJumpBoxInstanceId(name?: string): Promise<string | undefined> {
  if (!name)
    name = `${cloudName}/JumpBox`

  const ec2 = new EC2Client('us-east-1')
  const data = await ec2.describeInstances({
    Filters: [
      {
        Name: 'tag:Name',
        Values: [name],
      },
    ],
  })

  if (data.Reservations?.[0]?.Instances?.[0])
    return data.Reservations[0].Instances[0].InstanceId

  return undefined
}

export async function deleteEc2Instance(id: string, stackName?: string): Promise<Result<string, string>> {
  if (!stackName)
    stackName = cloudName

  if (!id)
    return err(`Instance ${id} not found`)

  const ec2 = new EC2Client('us-east-1')
  await ec2.terminateInstances([id])

  return ok(`Instance ${id} is being terminated`)
}

export async function deleteJumpBox(stackName?: string): Promise<Result<string, string>> {
  if (!stackName)
    stackName = cloudName

  const jumpBoxId = await getJumpBoxInstanceId()

  if (!jumpBoxId)
    return err('Jump-box not found')

  log.info(`Deleting jump-box ${jumpBoxId}...`)

  return await deleteEc2Instance(jumpBoxId, stackName)
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

  await Promise.all(promises).catch((error: Error) => {
    console.error(error)
    return err(handleError('Error deleting Stacks IAM users'))
  })

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
              return s3.deleteObject(bucketName, (o.Key as string) || '').catch((error: unknown) => handleError(error as Error))
            }),
          )
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

  await Promise.all(promises).catch((error: Error) => {
    if (error.message.includes('it is a replicated function')) {
      log.info('Function is replicated, skipping...')

      return ok('CloudFront is still deleting the some functions. Try again later.')
    }

    return err(handleError('Error deleting stacks functions', error))
  })

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

  await Promise.all(promises).catch((error: Error) => {
    return err(handleError('Error deleting parameter store', error))
  })

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

export async function getJumpBoxInstanceProfileName(): Promise<Result<string | undefined, string>> {
  const iam = new IAMClient('us-east-1')
  const data = await iam.listInstanceProfiles()
  const instanceProfile = data.InstanceProfiles?.find((profile: unknown) => {
    const p = profile as Record<string, unknown>
    return (p.InstanceProfileName as string | undefined)?.includes('JumpBox')
  })

  if (!instanceProfile)
    return err('Jump-box IAM instance profile not found')

  return ok(instanceProfile?.InstanceProfileName)
}

export async function addJumpBox(stackName?: string): Promise<Result<string, string>> {
  if (!stackName)
    stackName = cloudName

  if (await getJumpBoxInstanceId()) {
    return err(
      'The jump-box you are trying to add already exists. Please remove it & wait until it finished terminating.',
    )
  }

  const ec2 = new EC2Client('us-east-1')
  const r = await getJumpBoxSecurityGroupName()

  if (r.isErr)
    return err(r.error)
  if (!(r as unknown as Record<string, unknown>).value)
    return err('Security group not found when adding jump-box')

  const result = await getSecurityGroupId((r as unknown as Record<string, unknown>).value as string)
  if (result.isErr)
    return err(result.error)
  const sgId = (result as unknown as Record<string, unknown>).value as string | undefined

  if (!sgId)
    return err('Security group not found when adding jump-box')

  // Use raw EFS API call since EFSClient is not available
  const efsData = await efsRequest('DescribeFileSystems', 'GET', '/2015-02-01/file-systems')
  const fileSystems = (efsData.FileSystems ?? []) as unknown as Array<Record<string, unknown>>
  const fileSystemName = `stacks-${config.app.env}-efs`
  const fileSystem = fileSystems.find((fs: Record<string, unknown>) => fs.Name === fileSystemName)
  const fileSystemId = fileSystem?.FileSystemId as string | undefined

  if (!fileSystem || !fileSystemId)
    return err(`EFS file system ${fileSystemName} not found`)

  const userDataScript = `
#!/bin/bash
yum update -y
yum install -y amazon-efs-utils
yum install -y git
yum install -y https://s3.us-east-1.amazonaws.com/amazon-ssm-us-east-1/latest/linux_amd64/amazon-ssm-agent.rpm
mkdir /mnt/efs
mount -t efs ${fileSystemId}:/ /mnt/efs
git clone https://github.com/stacksjs/stacks.git /mnt/efs
`

  const base64UserData = btoa(userDataScript)
  const res = await getJumpBoxInstanceProfileName()

  if (res.isErr)
    return err(res.error)

  const jumpBoxInstanceProfileName: string | undefined = (res as unknown as Record<string, unknown>).value as string | undefined
  if (!jumpBoxInstanceProfileName)
    return err('Jump-box IAM instance profile not found')

  // Use raw EC2 API call for RunInstances since EC2Client doesn't expose it
  const instance = await ec2Request('RunInstances', {
    'ImageId': 'ami-03a6eaae9938c858c',
    'InstanceType': 't2.micro',
    'MaxCount': '1',
    'MinCount': '1',
    'SecurityGroupId.1': sgId,
    'SubnetId': 'subnet-004c5f196358b00f0',
    'TagSpecification.1.ResourceType': 'instance',
    'TagSpecification.1.Tag.1.Key': 'Name',
    'TagSpecification.1.Tag.1.Value': `${cloudName}-jump-box`,
    'UserData': base64UserData,
    'IamInstanceProfile.Name': jumpBoxInstanceProfileName,
  })

  const instancesSet = instance.instancesSet as unknown as Record<string, unknown> | undefined
  const items = (instancesSet?.item ?? []) as unknown as Array<Record<string, unknown>>
  const firstInstance = Array.isArray(items) ? items[0] : undefined

  return firstInstance
    ? ok(`Jump-box created with id ${firstInstance.instanceId as string}`)
    : err('Jump-box creation failed')
}

export async function getJumpBoxSecurityGroupName(): Promise<Result<string | undefined, string>> {
  const jumpBoxId = await getJumpBoxInstanceId()

  if (!jumpBoxId)
    return err('Jump-box not found')

  const ec2 = new EC2Client('us-east-1')
  const data = await ec2.describeInstances({ InstanceIds: [jumpBoxId] })

  if (data.Reservations?.[0]?.Instances?.[0]) {
    const instance = data.Reservations[0].Instances[0]
    const securityGroups = instance.SecurityGroups

    if (securityGroups?.[0])
      return ok(securityGroups[0].GroupName)
  }

  return err('Security group not found')
}

export async function getSecurityGroupFromInstanceId(instanceId: string): Promise<string | undefined> {
  const ec2 = new EC2Client('us-east-1')
  const data = await ec2.describeInstances({ InstanceIds: [instanceId] })

  if (data.Reservations?.[0]?.Instances?.[0]) {
    const instance = data.Reservations[0].Instances[0]
    const securityGroups = instance.SecurityGroups

    if (securityGroups?.[0])
      return securityGroups[0].GroupId
  }

  return undefined
}

export async function isFirstDeployment(): Promise<boolean> {
  const stackName = cloudName
  const cloudFormation = new CloudFormationClient('us-east-1')
  const data = await cloudFormation.listStacks(['CREATE_COMPLETE', 'UPDATE_COMPLETE'])
  const isStacksCloudPresent = data.StackSummaries?.some((stack: unknown) => {
    const s = stack as Record<string, unknown>
    return s.StackName === stackName
  })

  return !isStacksCloudPresent
}

export async function isFailedState(): Promise<boolean> {
  const cloudFormation = new CloudFormationClient('us-east-1')
  const data = await cloudFormation.listStacks(['CREATE_FAILED', 'UPDATE_FAILED', 'ROLLBACK_COMPLETE', 'UPDATE_ROLLBACK_COMPLETE'])
  const isStacksCloudPresent = data.StackSummaries?.some((stack: unknown) => {
    const s = stack as Record<string, unknown>
    return s.StackName === cloudName
  })

  return !isStacksCloudPresent
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
