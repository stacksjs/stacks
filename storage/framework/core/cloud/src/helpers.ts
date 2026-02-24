import type { CountryCode } from '@stacksjs/ts-cloud'
import type { Result } from '@stacksjs/error-handling'
import {
  AWSCloudFormationClient as CloudFormationClient,
  CloudWatchLogsClient,
  EC2Client,
  EFSClient,
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

export function purchaseDomain(
  domain: string,
  options: PurchaseOptions,
): Result<Promise<{ OperationId: string }>, Error> {
  const route53domains = new Route53DomainsClient('us-east-1')
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
  catch (error: any) {
    return err(error)
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
    = data.Users?.filter((user: any) => {
      const userNameLower = user.UserName?.toLowerCase()
      return (
        userNameLower !== 'stacks'
        && userNameLower !== teamName.toLowerCase()
        && userNameLower?.includes(teamName.toLowerCase())
      )
    }) || []

  if (!users || users.length === 0)
    return ok(`No Stacks IAM users found for team ${teamName}`)

  const promises = users.map(async (user: any) => {
    const userName = user.UserName || ''

    log.info(`Deleting IAM user: ${userName}`)

    // Get the list of policies attached to the user
    const policies = await iam.listAttachedUserPolicies({ UserName: userName })

    // Detach each policy
    await Promise.all(
      policies.AttachedPolicies?.map((policy: any) =>
        iam.detachUserPolicy({
          UserName: userName,
          PolicyArn: policy.PolicyArn || '',
        }),
      ) || [],
    )

    // Get the list of access keys for the user
    const accessKeys = await iam.listAccessKeys({ UserName: userName })

    // Delete each access key
    await Promise.all(
      accessKeys.AccessKeyMetadata?.map((key: any) =>
        iam.deleteAccessKey({
          UserName: userName,
          AccessKeyId: key.AccessKeyId || '',
        }),
      ) || [],
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
      return err('No stacks buckets found') as any

    const promises = stacksBuckets.map(async (bucket) => {
      const bucketName = bucket.Name || ''

      log.info(`Deleting bucket ${bucketName}...`)

      // List and delete all objects in the bucket with pagination
      let continuationToken: string | undefined
      let hasMoreObjects = true

      while (hasMoreObjects) {
        const objects = await s3.listObjects({
          Bucket: bucketName,
          ContinuationToken: continuationToken,
        })

        // Delete all objects in this batch
        if (objects.Contents && objects.Contents.length > 0) {
          log.info(`Deleting ${objects.Contents.length} objects from bucket ${bucketName}...`)

          await Promise.all(
            objects.Contents.map((object: any) =>
              s3.deleteObject({ Bucket: bucketName, Key: object.Key || '' }).catch((error: any) => handleError(error)),
            ),
          )
        }

        // Check if there are more objects
        hasMoreObjects = objects.IsTruncated === true
        continuationToken = objects.NextContinuationToken
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
            Bucket: bucketName,
            KeyMarker: keyMarker,
            VersionIdMarker: versionIdMarker,
          })

          // Delete versions in this batch
          if (versions.Versions && versions.Versions.length > 0) {
            await Promise.all(
              versions.Versions.map((version: any) =>
                s3.deleteObject({
                  Bucket: bucketName,
                  Key: version.Key || '',
                  VersionId: version.VersionId,
                }),
              ),
            ).catch((error: any) => handleError(error))
            log.info(`Deleted ${versions.Versions.length} versions from bucket ${bucketName}`)
          }

          // Delete delete markers in this batch
          if (versions.DeleteMarkers && versions.DeleteMarkers.length > 0) {
            await Promise.all(
              versions.DeleteMarkers.map((marker: any) =>
                s3.deleteObject({
                  Bucket: bucketName,
                  Key: marker.Key || '',
                  VersionId: marker.VersionId,
                }),
              ),
            ).catch((error: any) => handleError(error))
            log.info(`Deleted ${versions.DeleteMarkers.length} delete markers from bucket ${bucketName}`)
          }

          // Check if there are more items
          hasMore = versions.IsTruncated === true
          keyMarker = versions.NextKeyMarker
          versionIdMarker = versions.NextVersionIdMarker
        }

        log.info(`Finished deleting all versions from bucket ${bucketName}`)

        // If the bucket has uncompleted multipart uploads, abort them
        const uploads = await s3.listMultipartUploads({ Bucket: bucketName })
        if (uploads.Uploads) {
          log.info('Aborting bucket multipart uploads...')

          await Promise.all(
            uploads.Uploads.map((upload: any) =>
              s3.abortMultipartUpload({
                Bucket: bucketName,
                Key: upload.Key || '',
                UploadId: upload.UploadId,
              }),
            ),
          ).catch((error: any) => handleError(error))

          log.info(`Finished aborting multipart uploads from bucket ${bucketName}`)
        }

        await s3.deleteBucket({ Bucket: bucketName }).catch((error: any) => handleError(error))

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
    return err(handleError('Error deleting stacks buckets', error)) as any
  }
}

export async function deleteStacksFunctions(): Promise<Result<string, string>> {
  const lambda = new LambdaClient('us-east-1')
  const data = await lambda.listFunctions()
  const stacksFunctions = data.Functions?.filter((func: any) => func.FunctionName?.includes('stacks')) || []

  if (!stacksFunctions || stacksFunctions.length === 0)
    return ok('No stacks functions found')

  const promises = stacksFunctions.map((func: any) => lambda.deleteFunction({ FunctionName: func.FunctionName || '' }))

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
    const ec2 = new EC2Client('us-east-1')
    const { Regions } = await ec2.describeRegions()
    const regions = Regions?.map((region: any) => region.RegionName) || []

    for (const region of regions) {
      const client = new CloudWatchLogsClient(region)
      const logGroups = await client.describeLogGroups()

      if (logGroups?.logGroups) {
        for (const group of logGroups.logGroups) {
          const appName = config.app.name?.toLocaleLowerCase() || 'stacks'
          if (group.logGroupName?.includes(appName))
            await client.deleteLogGroup(group.logGroupName)
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
  const stacksParameters = data.Parameters.filter((param: any) => param.Name?.includes(appName)) || []

  if (!stacksParameters || stacksParameters.length === 0)
    return ok('No stacks parameters found')

  const promises = stacksParameters.map((param: any) => ssm.deleteParameter({ Name: param.Name || '' }))

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
    const vpcsToDel = Vpcs.filter((vpc: any) => vpc.Tags?.some((tag: any) => tag.Key === 'Name' && tag.Value === vpcNamePattern))

    if (vpcsToDel.length === 0) {
      return ok(`No VPCs found matching the pattern: ${vpcNamePattern}`)
    }

    // Delete each matching VPC
    for (const vpc of vpcsToDel) {
      if (vpc.VpcId) {
        await ec2.deleteVpc(vpc.VpcId)
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
    const subnetsToDel = Subnets.filter((subnet: any) =>
      subnet.Tags?.some((tag: any) => tag.Key === 'Name' && tag.Value?.startsWith(subnetNamePattern)),
    )

    if (subnetsToDel.length === 0) {
      return ok(`No subnets found matching the pattern: ${subnetNamePattern}`)
    }

    // Delete dependencies and subnets
    for (const subnet of subnetsToDel) {
      if (subnet.SubnetId) {
        // Describe network interfaces in the subnet
        const { NetworkInterfaces } = await ec2.describeNetworkInterfaces({
          Filters: [{ Name: 'subnet-id', Values: [subnet.SubnetId] }],
        })

        // Delete network interfaces
        for (const ni of NetworkInterfaces || []) {
          if (ni.NetworkInterfaceId) {
            // If the network interface is attached to an instance, terminate the instance
            if (ni.Attachment?.InstanceId) {
              await ec2.terminateInstances([ni.Attachment.InstanceId])
              log.info(`Terminated instance: ${ni.Attachment.InstanceId}`)

              // Wait for the instance to terminate
              await new Promise(resolve => setTimeout(resolve, 60000))
            }

            // Detach the network interface if it's attached
            if (ni.Attachment?.AttachmentId) {
              await ec2.detachNetworkInterface(ni.Attachment.AttachmentId, true)
              log.info(`Detached network interface: ${ni.NetworkInterfaceId}`)

              // Wait for the detachment to complete
              await new Promise(resolve => setTimeout(resolve, 10000))
            }

            // Delete the network interface
            await ec2.deleteNetworkInterface(ni.NetworkInterfaceId)
            log.info(`Deleted network interface: ${ni.NetworkInterfaceId}`)
          }
        }

        // Delete the subnet
        await ec2.deleteSubnet(subnet.SubnetId)
        log.info(`Deleted subnet: ${subnet.SubnetId} (${subnet.Tags?.find((tag: any) => tag.Key === 'Name')?.Value})`)
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
  const instanceProfile = data.InstanceProfiles?.find((profile: any) => profile.InstanceProfileName?.includes('JumpBox'))

  if (!instanceProfile)
    return err('Jump-box IAM instance profile not found')

  return ok(instanceProfile?.InstanceProfileName)
}

export async function addJumpBox(stackName?: string): Promise<Result<string, string>> {
  if (!stackName)
    stackName = cloudName

  if (await getJumpBoxInstanceId()) {
    return err(
      'The jump–box you are trying to add already exists. Please remove it & wait until it finished terminating.',
    )
  }

  const ec2 = new EC2Client('us-east-1')
  const r = await getJumpBoxSecurityGroupName()

  if (r.isErr)
    return err(r.error)
  if (!(r as any).value)
    return err('Security group not found when adding jump-box')

  const result = await getSecurityGroupId((r as any).value)
  if (result.isErr)
    return err(result.error)
  const sgId = (result as any).value

  if (!sgId)
    return err('Security group not found when adding jump-box')

  const efsClient = new EFSClient('us-east-1')
  const data = await efsClient.describeFileSystems()
  const fileSystemName = `stacks-${config.app.env}-efs`
  const fileSystem = data.FileSystems?.find((fs: any) => fs.Name === fileSystemName)
  const fileSystemId = fileSystem?.FileSystemId

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

  const jumpBoxInstanceProfileName: string | undefined = (res as any).value
  if (!jumpBoxInstanceProfileName)
    return err('Jump-box IAM instance profile not found')

  const instance = await ec2.runInstances({
    ImageId: 'ami-03a6eaae9938c858c', // Amazon Linux 2023 AMI
    InstanceType: 't2.micro',
    MaxCount: 1,
    MinCount: 1,
    SecurityGroupIds: [sgId],
    SubnetId: 'subnet-004c5f196358b00f0',
    TagSpecifications: [
      {
        ResourceType: 'instance',
        Tags: [
          {
            Key: 'Name',
            Value: `${cloudName}-jump-box`,
          },
        ],
      },
    ],
    UserData: base64UserData,
    IamInstanceProfile: {
      Name: jumpBoxInstanceProfileName,
    },
  })

  return instance.Instances?.[0]
    ? ok(`Jump-box created with id ${instance.Instances[0].InstanceId}`)
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
  const isStacksCloudPresent = data.StackSummaries?.some((stack: any) => stack.StackName === stackName)

  return !isStacksCloudPresent
}

export async function isFailedState(): Promise<boolean> {
  const cloudFormation = new CloudFormationClient('us-east-1')
  const data = await cloudFormation.listStacks(['CREATE_FAILED', 'UPDATE_FAILED', 'ROLLBACK_COMPLETE', 'UPDATE_ROLLBACK_COMPLETE'])
  const isStacksCloudPresent = data.StackSummaries?.some((stack: any) => stack.StackName === cloudName)

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
  catch (error: any) {
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
