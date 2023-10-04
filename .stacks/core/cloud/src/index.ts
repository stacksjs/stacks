import { err, ok } from '@stacksjs/error-handling'
import { Route53Domains } from '@aws-sdk/client-route-53-domains'
import { CloudFormation } from '@aws-sdk/client-cloudformation'
import { EC2, _InstanceType as InstanceType } from '@aws-sdk/client-ec2'
import { IAM } from '@aws-sdk/client-iam'
import { DescribeFileSystemsCommand, EFSClient } from '@aws-sdk/client-efs'
import { config } from '@stacksjs/config'

const appEnv = config.app.env === 'local' ? 'dev' : config.app.env
const cloudName = `stacks-cloud-${appEnv}`
const ec2 = new EC2({ region: 'us-east-1' })

export async function getSecurityGroupId(securityGroupName: string) {
  const { SecurityGroups } = await ec2.describeSecurityGroups({
    Filters: [{ Name: 'group-name', Values: [securityGroupName] }],
  })

  if (!SecurityGroups)
    return err(`Security group ${securityGroupName} not found`)

  if (SecurityGroups[0])
    return ok(SecurityGroups[0].GroupId)

  return err(`Security group ${securityGroupName} not found`)
}

export * from './drivers'
export { InstanceType }

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
  contactType: string
  verbose: boolean
}

export async function purchaseDomain(domain: string, options: PurchaseOptions) {
  const route53domains = new Route53Domains({ region: 'us-east-1' })
  const params = {
    DomainName: domain,
    DurationInYears: options.years || 1,
    AutoRenew: options.autoRenew || true,
    AdminContact: {
      FirstName: options.adminFirstName,
      LastName: options.adminLastName,
      ContactType: options.contactType.toUpperCase() || 'PERSON',
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
      ContactType: options.contactType.toUpperCase() || 'PERSON',
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
      ContactType: options.contactType.toUpperCase() || 'PERSON',
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
    return ok(await route53domains.registerDomain(params))
  }
  catch (error: any) {
    return err(error)
  }
}

export async function getJumpBoxInstanceId(name?: string) {
  if (!name)
    name = `${cloudName}-jump-box`

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
    return `Instance ${id} not found`

  const ec2 = new EC2({ region: 'us-east-1' })
  await ec2.terminateInstances({ InstanceIds: [id] })
  return `Instance ${id} is being terminated`
}

export async function deleteJumpBox(stackName?: string) {
  if (!stackName)
    stackName = cloudName

  const jumpBoxId = await getJumpBoxInstanceId()

  if (!jumpBoxId)
    return 'Jump box not found'

  return deleteEc2Instance(jumpBoxId, stackName)
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
    return err('Security group not found when adding jump box')

  const result = await getSecurityGroupId(r.value)
  let sgId: string | undefined

  if (result.isErr())
    return err(result.error)
  else
    sgId = result.value

  if (!sgId)
    return err('Security group not found when adding jump box')

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
    ? ok(`Jump box created with id ${instance.Instances[0].InstanceId}`)
    : err('Jump box creation failed')
}

export async function getJumpBoxSecurityGroupName() {
  const jumpBoxId = await getJumpBoxInstanceId()

  if (!jumpBoxId)
    return err('Jump box not found')

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
  const stackName = cloudName
  const cloudFormation = new CloudFormation()
  const data = await cloudFormation.listStacks({ StackStatusFilter: ['CREATE_FAILED', 'UPDATE_FAILED', 'DELETE_FAILED', 'ROLLBACK_COMPLETE'] })
  const isStacksCloudPresent = data.StackSummaries?.some(stack => stack.StackName === stackName)

  return !isStacksCloudPresent
}
