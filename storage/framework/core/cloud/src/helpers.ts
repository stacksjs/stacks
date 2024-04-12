import { CloudFormation } from '@aws-sdk/client-cloudformation'
import type { DescribeLogGroupsCommandOutput } from '@aws-sdk/client-cloudwatch-logs'
import { CloudWatchLogsClient, DeleteLogGroupCommand, DescribeLogGroupsCommand } from '@aws-sdk/client-cloudwatch-logs'
import { EC2, _InstanceType as InstanceType } from '@aws-sdk/client-ec2'
import { DescribeFileSystemsCommand, EFSClient } from '@aws-sdk/client-efs'
import { IAM } from '@aws-sdk/client-iam'
import { SSM } from '@aws-sdk/client-ssm'
import { Lambda } from '@aws-sdk/client-lambda'
import type { CountryCode } from '@aws-sdk/client-route-53-domains'
import { ContactType, Route53Domains } from '@aws-sdk/client-route-53-domains'
import { ListBucketsCommand, S3 } from '@aws-sdk/client-s3'
import { config } from '@stacksjs/config'
import { err, handleError, ok } from '@stacksjs/error-handling'
import { runCommand } from '@stacksjs/cli'
import { log } from '@stacksjs/logging'
import { path as p } from '@stacksjs/path'
import { slug } from '@stacksjs/strings'

const appEnv = config.app.env === 'local' ? 'dev' : config.app.env
const cloudName = `stacks-cloud-${appEnv}`

export { InstanceType }

export async function getSecurityGroupId(securityGroupName: string) {
  const ec2 = new EC2({ region: 'us-east-1' })
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
  contactType: ContactType
  verbose: boolean
}

export function purchaseDomain(domain: string, options: PurchaseOptions) {
  const route53domains = new Route53Domains({ region: 'us-east-1' })
  const contactType = options.contactType.toUpperCase() as ContactType

  const params = {
    DomainName: domain,
    DurationInYears: options.years || 1,
    AutoRenew: options.autoRenew || true,
    AdminContact: {
      FirstName: options.adminFirstName,
      LastName: options.adminLastName,
      ContactType: contactType || ContactType.PERSON,
      OrganizationName: options.adminOrganization,
      AddressLine1: options.adminAddressLine1,
      AddressLine2: options.adminAddressLine2,
      City: options.adminCity,
      State: options.adminState,
      CountryCode: options.adminCountry,
      ZipCode: options.adminZip.toString(),
      PhoneNumber: options.adminPhone.toString().includes('+') ? options.adminPhone.toString() : `+${options.adminPhone.toString()}`,
      Email: options.adminEmail,
    },
    RegistrantContact: {
      FirstName: options.registrantFirstName,
      LastName: options.registrantLastName,
      ContactType: contactType || ContactType.PERSON,
      OrganizationName: options.registrantOrganization,
      AddressLine1: options.registrantAddressLine1,
      AddressLine2: options.registrantAddressLine2,
      City: options.registrantCity,
      State: options.registrantState,
      CountryCode: options.registrantCountry,
      ZipCode: options.registrantZip.toString(),
      PhoneNumber: options.registrantPhone.toString().includes('+') ? options.registrantPhone.toString() : `+${options.registrantPhone.toString()}`,
      Email: options.registrantEmail,
    },
    TechContact: {
      FirstName: options.techFirstName,
      LastName: options.techLastName,
      ContactType: contactType || ContactType.PERSON,
      OrganizationName: options.techOrganization,
      AddressLine1: options.techAddressLine1,
      AddressLine2: options.techAddressLine2,
      City: options.techCity,
      State: options.techState,
      CountryCode: options.techCountry,
      ZipCode: options.techZip.toString(),
      PhoneNumber: options.techPhone.toString().includes('+') ? options.techPhone.toString() : `+${options.techPhone.toString()}`,
      Email: options.techEmail,
    },
    PrivacyProtectAdminContact: options.privacyAdmin || options.privacy || true,
    PrivacyProtectRegistrantContact: options.privacyRegistrant || options.privacy || true,
    PrivacyProtectTechContact: options.privacyTech || options.privacy || true,
  }

  try {
    return ok(route53domains.registerDomain(params))
  }
  catch (error: any) {
    return err(error)
  }
}

export async function getJumpBoxInstanceId(name?: string) {
  if (!name)
    name = `${cloudName}/JumpBox`

  const ec2 = new EC2({ region: 'us-east-1' })
  const data = await ec2.describeInstances({
    Filters: [
      {
        Name: 'tag:Name',
        Values: [name],
      },
    ],
  })

  if (data.Reservations && data.Reservations[0] && data.Reservations[0].Instances && data.Reservations[0].Instances[0])
    return data.Reservations[0].Instances[0].InstanceId

  return undefined
}

export async function deleteEc2Instance(id: string, stackName?: string) {
  if (!stackName)
    stackName = cloudName

  if (!id)
    return err(`Instance ${id} not found`)

  const ec2 = new EC2({ region: 'us-east-1' })
  await ec2.terminateInstances({ InstanceIds: [id] })

  return ok(`Instance ${id} is being terminated`)
}

export async function deleteJumpBox(stackName?: string) {
  if (!stackName)
    stackName = cloudName

  const jumpBoxId = await getJumpBoxInstanceId()

  if (!jumpBoxId)
    return err('Jump-box not found')

  log.info(`Deleting jump-box ${jumpBoxId}...`)

  return await deleteEc2Instance(jumpBoxId, stackName)
}

export async function deleteIamUsers() {
  const iam = new IAM({ region: 'us-east-1' })
  const data = await iam.listUsers({})
  const teamName = slug(config.team.name)
  const users = data.Users?.filter((user) => {
    const userNameLower = user.UserName?.toLowerCase()
    return userNameLower !== 'stacks' && userNameLower !== teamName.toLowerCase() && userNameLower?.includes(teamName.toLowerCase())
  }) || []

  if (!users || users.length === 0)
    return ok(`No Stacks IAM users found for team ${teamName}`)

  const promises = users.map(async (user) => {
    const userName = user.UserName || ''

    log.info(`Deleting IAM user: ${userName}`)

    // Get the list of policies attached to the user
    const policies = await iam.listAttachedUserPolicies({ UserName: userName })

    // Detach each policy
    await Promise.all(policies.AttachedPolicies?.map(policy =>
      iam.detachUserPolicy({ UserName: userName, PolicyArn: policy.PolicyArn || '' }),
    ) || [])

    // Get the list of access keys for the user
    const accessKeys = await iam.listAccessKeys({ UserName: userName })

    // Delete each access key
    await Promise.all(accessKeys.AccessKeyMetadata?.map(key =>
      iam.deleteAccessKey({ UserName: userName, AccessKeyId: key.AccessKeyId || '' }),
    ) || [])

    // Now delete the user
    return iam.deleteUser({ UserName: userName })
  })

  await Promise.all(promises).catch((error: Error) => {
    console.error(error)
    return err(handleError('Error deleting Stacks IAM users'))
  })

  return ok(`Stacks IAM users deleted for team ${teamName}`)
}

export async function deleteStacksBuckets() {
  try {
    const s3 = new S3({ region: 'us-east-1' })
    const data = await s3.listBuckets({})
    const stacksBuckets = data.Buckets?.filter(bucket => bucket.Name?.includes('stacks'))

    if (!stacksBuckets)
      return err('No stacks buckets found')

    const promises = stacksBuckets.map(async (bucket) => {
      const bucketName = bucket.Name || ''

      // Delete the bucket
      log.info(`Deleting bucket ${bucketName}...`)

      // List all objects in the bucket
      const objects = await s3.listObjectsV2({ Bucket: bucketName })
      log.info(`Finished listing bucket ${bucketName} objects`)

      // Delete all objects
      if (objects.Contents) {
        log.info('Deleting bucket objects...')

        await Promise.all(objects.Contents.map(object =>
          s3.deleteObject({ Bucket: bucketName, Key: object.Key || '' }).catch(error => handleError(error)),
        ))

        log.info(`Finished deleting objects from bucket ${bucketName}`)
      }

      log.info(`Deleting bucket ${bucketName} versions...`)
      try {
        const versions = await s3.listObjectVersions({ Bucket: bucketName })

        if (versions.Versions) {
          await Promise.all(versions.Versions.map(version =>
            s3.deleteObject({ Bucket: bucketName, Key: version.Key || '', VersionId: version.VersionId }),
          )).catch(error => handleError(error))
          log.info(`Finished deleting versions from bucket ${bucketName}`)
        }

        // Delete all delete markers
        log.info(`Deleting bucket ${bucketName} delete markers...`)

        if (versions.DeleteMarkers) {
          await Promise.all(versions.DeleteMarkers.map(marker =>
            s3.deleteObject({ Bucket: bucketName, Key: marker.Key || '', VersionId: marker.VersionId }),
          )).catch(error => handleError(error))

          log.info(`Finished deleting delete markers from bucket ${bucketName}`)
        }

        // If the bucket has uncompleted multipart uploads, you need to abort them
        const uploads = await s3.listMultipartUploads({ Bucket: bucketName })
        if (uploads.Uploads) {
          log.info('Aborting bucket multipart uploads...')

          await Promise.all(uploads.Uploads.map(upload =>
            s3.abortMultipartUpload({ Bucket: bucketName, Key: upload.Key || '', UploadId: upload.UploadId }),
          )).catch(error => handleError(error))

          log.info(`Finished aborting multipart uploads from bucket ${bucketName}`)
        }

        await s3.deleteBucket({ Bucket: bucketName }).catch(error => handleError(error))

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
    console.error(error)
    return err(handleError('Error deleting stacks buckets'))
  }
}

export async function deleteStacksFunctions() {
  const lambda = new Lambda({ region: 'us-east-1' })
  const data = await lambda.listFunctions({})
  const stacksFunctions = data.Functions?.filter(func => func.FunctionName?.includes('stacks')) || []

  if (!stacksFunctions || stacksFunctions.length === 0)
    return ok('No stacks functions found')

  const promises = stacksFunctions.map(func => lambda.deleteFunction({ FunctionName: func.FunctionName || '' }))

  await Promise.all(promises).catch((error: Error) => {
    if (error.message.includes('it is a replicated function')) {
      log.info('Function is replicated, skipping...')

      return ok('CloudFront is still deleting the some functions. Try again later.')
    }

    console.error(error)
    return err(handleError('Error deleting stacks functions'))
  })

  return ok('Stacks functions deleted')
}

export async function deleteLogGroups() {
  try {
    const client = new CloudWatchLogsClient({ region: 'us-east-1' })
    const logGroups: DescribeLogGroupsCommandOutput = await client.send(new DescribeLogGroupsCommand({}))

    if (!logGroups?.logGroups)
      return err('No log groups found')

    for (const group of logGroups.logGroups) {
      if (group.logGroupName?.includes('stacks'))

        await client.send(new DeleteLogGroupCommand({ logGroupName: group.logGroupName }))
    }

    return ok('Log groups deleted')
  }
  catch (error) {
    console.error(error)
    return err(handleError('Error deleting log groups'))
  }
}

export async function deleteParameterStore() {
  const ssm = new SSM({ region: 'us-east-1' })
  const data = await ssm.describeParameters({})

  if (!data.Parameters)
    return ok('No parameters found')

  const stacksParameters = data.Parameters.filter(param => param.Name?.includes('stacks')) || []

  if (!stacksParameters || stacksParameters.length === 0)
    return ok('No stacks parameters found')

  const promises = stacksParameters.map(param => ssm.deleteParameter({ Name: param.Name || '' }))

  await Promise.all(promises).catch((error: Error) => {
    console.error(error)
    return err(handleError('Error deleting parameter store'))
  })

  return ok('Parameter store deleted')
}

export async function deleteCdkRemnants() {
  try {
    // TODO: use $ once we can use CDK past Bun v1.0.8
    return ok(
      await runCommand(
        `bunx rimraf ${p.cloudPath('cdk.out/')} ${p.cloudPath('cdk.context.json')}`,
      ),
    )
  }
  catch (error) {
    console.error(error)
    return err(handleError('Error deleting CDK remnants'))
  }
}

export async function hasBeenDeployed() {
  const s3 = new S3({ region: 'us-east-1' })

  try {
    const response = await s3.send(new ListBucketsCommand({}))

    return ok(response.Buckets?.some(bucket => bucket.Name?.includes(config.app.name?.toLocaleLowerCase() || 'stacks')) || false)
  }
  catch (error) {
    console.error(error)
    return err(handleError('Error checking if the app has been deployed'))
  }
}

export async function getJumpBoxInstanceProfileName() {
  const iam = new IAM({ region: 'us-east-1' })
  const data = await iam.listInstanceProfiles({})
  const instanceProfile = data.InstanceProfiles?.find(profile => profile.InstanceProfileName?.includes('JumpBox'))

  if (!instanceProfile)
    return err('Jump-box IAM instance profile not found')

  return ok(instanceProfile?.InstanceProfileName)
}

export async function addJumpBox(stackName?: string) {
  if (!stackName)
    stackName = cloudName

  if (await getJumpBoxInstanceId())
    return err('The jump–box you are trying to add already exists. Please remove it & wait until it finished terminating.')

  const ec2 = new EC2({ region: 'us-east-1' })

  const r = await getJumpBoxSecurityGroupName()

  if (r.isErr())
    return err(r.error)

  if (!r.value)
    return err('Security group not found when adding jump-box')

  const result = await getSecurityGroupId(r.value)
  let sgId: string | undefined

  if (result.isErr())
    return err(result.error)
  else
    sgId = result.value

  if (!sgId)
    return err('Security group not found when adding jump-box')

  const client = new EFSClient({ region: 'us-east-1' })
  const command = new DescribeFileSystemsCommand({})
  const data = await client.send(command)

  const fileSystemName = `stacks-${config.app.env}-efs`
  const fileSystem = data.FileSystems?.find(fs => fs.Name === fileSystemName)
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

  if (res.isErr())
    return err(res.error)

  const jumpBoxInstanceProfileName: string | undefined = res.value
  if (!jumpBoxInstanceProfileName)
    return err('Jump-box IAM instance profile not found')

  const instance = await ec2.runInstances({
    ImageId: 'ami-03a6eaae9938c858c', // Amazon Linux 2023 AMI
    // ImageId: new ec2.AmazonLinuxImage(),
    InstanceType: InstanceType.t2_micro,
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

  return instance.Instances && instance.Instances[0]
    ? ok(`Jump-box created with id ${instance.Instances[0].InstanceId}`)
    : err('Jump-box creation failed')
}

export async function getJumpBoxSecurityGroupName() {
  const jumpBoxId = await getJumpBoxInstanceId()

  if (!jumpBoxId)
    return err('Jump-box not found')

  const ec2 = new EC2({ region: 'us-east-1' })
  const data = await ec2.describeInstances({ InstanceIds: [jumpBoxId] })

  if (data.Reservations && data.Reservations[0] && data.Reservations[0].Instances && data.Reservations[0].Instances[0]) {
    const instance = data.Reservations[0].Instances[0]
    const securityGroups = instance.SecurityGroups

    if (securityGroups && securityGroups[0])
      return ok(securityGroups[0].GroupName)
  }

  return err('Security group not found')
}

export async function getSecurityGroupFromInstanceId(instanceId: string) {
  const ec2 = new EC2({ region: 'us-east-1' })
  const data = await ec2.describeInstances({ InstanceIds: [instanceId] })

  if (data.Reservations && data.Reservations[0] && data.Reservations[0].Instances && data.Reservations[0].Instances[0]) {
    const instance = data.Reservations[0].Instances[0]
    const securityGroups = instance.SecurityGroups

    if (securityGroups && securityGroups[0])
      return securityGroups[0].GroupId // Returns the ID of the first security group
  }

  return undefined
}

export async function isFirstDeployment() {
  const stackName = cloudName
  const cloudFormation = new CloudFormation()
  const data = await cloudFormation.listStacks({ StackStatusFilter: ['CREATE_COMPLETE', 'UPDATE_COMPLETE'] })
  const isStacksCloudPresent = data.StackSummaries?.some(stack => stack.StackName === stackName)

  return !isStacksCloudPresent
}

export async function isFailedState() {
  const cloudFormation = new CloudFormation()
  const data = await cloudFormation.listStacks({ StackStatusFilter: ['CREATE_FAILED', 'UPDATE_FAILED', 'ROLLBACK_COMPLETE', 'UPDATE_ROLLBACK_COMPLETE'] })
  const isStacksCloudPresent = data.StackSummaries?.some(stack => stack.StackName === cloudName)

  return !isStacksCloudPresent
}

export async function getOrCreateTimestamp(): Promise<string> {
  const parameterName = `/stacks/timestamp`
  const ssm = new SSM({ region: 'us-east-1' })

  try {
    const response = await ssm.getParameter({ Name: parameterName })
    const timestamp = response.Parameter ? response.Parameter.Value : undefined

    if (!timestamp)
      throw new Error('Timestamp parameter not found')

    return timestamp
  }
  catch (error: any) {
    const timestamp = new Date().getTime().toString()
    log.debug(`Creating timestamp parameter ${parameterName} with value ${timestamp}`)
    await ssm.putParameter({
      Name: parameterName,
      Value: timestamp,
      Type: 'String',
    })

    return timestamp
  }
}

// function isProductionEnv(env: string) {
//   return env === 'production' || env === 'prod'
// }

// export async function getExistingBucketNameByPrefix(prefix: string): Promise<string | undefined | null> {
//   const s3 = new S3({ region: 'us-east-1' })

//   try {
//     const response = await s3.send(new ListBucketsCommand({}))
//     const bucket = response.Buckets?.find(bucket => bucket.Name?.startsWith(prefix))

//     return bucket ? bucket.Name : null
//   }
//   catch (error) {
//     console.error('Error fetching buckets', error)
//     return `${prefix}-${timestamp}`
//   }
// }
