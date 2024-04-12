import { Route53 } from '@aws-sdk/client-route-53'
import { Route53Domains } from '@aws-sdk/client-route-53-domains'
import { err, handleError, ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { runAction } from '@stacksjs/actions'
import { fs } from '@stacksjs/storage'
import { config } from '@stacksjs/config'
import { path as p } from '@stacksjs/path'
import { Action } from '@stacksjs/enums'
import type { DeployOptions } from '@stacksjs/types'

export async function deleteHostedZone(domainName: string) {
  const route53 = new Route53()

  // First, we need to get the Hosted Zone ID using the domain name
  const hostedZones = await route53.listHostedZonesByName({ DNSName: domainName })
  if (!hostedZones || !hostedZones.HostedZones)
    return err((`No hosted zones found for domain: ${domainName}`))

  const hostedZone = hostedZones.HostedZones.find(zone => zone.Name === `${domainName}.`)
  if (!hostedZone)
    return err((`Hosted Zone not found for domain: ${domainName}`))

  // Delete all record sets
  const recordSets = await route53.listResourceRecordSets({ HostedZoneId: hostedZone.Id })
  if (!recordSets || !recordSets.ResourceRecordSets)
    return err((`No DNS records found for domain: ${domainName}`))

  for (const recordSet of recordSets.ResourceRecordSets) {
    if (recordSet.Type !== 'NS' && recordSet.Type !== 'SOA') {
      await route53.changeResourceRecordSets({
        HostedZoneId: hostedZone.Id,
        ChangeBatch: {
          Changes: [{
            Action: 'DELETE',
            ResourceRecordSet: recordSet,
          }],
        },
      })
    }
  }

  // Delete the hosted zone
  await route53.deleteHostedZone({ Id: hostedZone.Id })

  log.info(`Deleted Hosted Zone for domain: ${domainName}`)

  return ok('success')
}

// sometimes it’s useful to delete all records but keep the hosted zone
// for example, if you want to keep the nameservers
export async function deleteHostedZoneRecords(domainName: string) {
  const route53 = new Route53()

  // First, we need to get the Hosted Zone ID using the domain name
  const hostedZones = await route53.listHostedZonesByName({ DNSName: domainName })
  if (!hostedZones || !hostedZones.HostedZones)
    return err((`No hosted zones found for domain: ${domainName}`))

  const hostedZone = hostedZones.HostedZones.find(zone => zone.Name === `${domainName}.`)
  if (!hostedZone)
    return err((`Hosted Zone not found for domain: ${domainName}`))

  // Delete all record sets
  const recordSets = await route53.listResourceRecordSets({ HostedZoneId: hostedZone.Id })
  if (!recordSets || !recordSets.ResourceRecordSets)
    return err((`No DNS records found for domain: ${domainName}`))

  for (const recordSet of recordSets.ResourceRecordSets) {
    if (recordSet.Type !== 'NS' && recordSet.Type !== 'SOA') {
      await route53.changeResourceRecordSets({
        HostedZoneId: hostedZone.Id,
        ChangeBatch: {
          Changes: [{
            Action: 'DELETE',
            ResourceRecordSet: recordSet,
          }],
        },
      })
    }
  }

  log.info(`Deleted DNS records for domain: ${domainName}`)

  return ok('success')
}

export async function createHostedZone(domainName: string) {
  const route53 = new Route53()

  // Check if the hosted zone already exists
  const existingHostedZones = await route53.listHostedZonesByName({ DNSName: domainName })
  const existingHostedZone = existingHostedZones.HostedZones?.find(zone => zone.Name === `${domainName}.`)

  // if the hosted zone already exists, then we want to
  if (existingHostedZone)
    return ok(existingHostedZone)

  // Create the hosted zone
  const createHostedZoneOutput = await route53.createHostedZone({
    Name: domainName,
    CallerReference: `${Date.now()}`,
  })

  if (!createHostedZoneOutput.HostedZone)
    return err('Failed to create hosted zone')

  return ok(createHostedZoneOutput)
}

export function writeNameserversToConfig(nameservers: string[]) {
  try {
    const path = p.projectConfigPath('dns.ts')
    const fileContent = fs.readFileSync(path, 'utf-8')
    const modifiedContent = fileContent.replace(
      /nameservers: \[.*?\]/s,
      `nameservers: [${nameservers.map(ns => `'${ns}'`).join(', ')}]`,
    )
    fs.writeFileSync(path, modifiedContent, 'utf-8')

    log.info('Nameservers have been set.')
  }
  catch (err) {
    console.error('Error updating nameservers:', err)
  }
}

export async function findHostedZone(domain: string) {
  try {
    const route53 = new Route53()
    const { HostedZones } = await route53.listHostedZonesByName({ DNSName: domain })

    if (!HostedZones)
      return handleError(`No hosted zones found for domain ${domain}`)

    // The API returns hosted zones sorted by name in ASCII order,
    // so the desired hosted zone (if it exists) should be the first one in the list
    const hostedZone = HostedZones[0]

    if (hostedZone && hostedZone.Name === `${domain}.`)
      return ok(hostedZone.Id)

    return ok(null)
  }
  catch (error) {
    console.error(error)
    return handleError(`Failed to find hosted zone for domain ${domain}`)
  }
}

export async function getNameservers(domainName?: string) {
  if (!domainName)
    return []

  try {
    const route53Domains = new Route53Domains()
    const domainDetail = await route53Domains.getDomainDetail({ DomainName: domainName })

    return domainDetail?.Nameservers?.map(ns => ns.Name as string) || []
  }
  catch (error) {
    console.error(error)
    handleError('Error getting domain detail')
  }
}

export async function updateNameservers(hostedZoneNameservers: string[], domainName?: string) {
  if (!domainName)
    domainName = config.app.url

  const domainNameservers = await getNameservers(domainName)

  if (domainNameservers && hostedZoneNameservers && JSON.stringify(domainNameservers.sort()) !== JSON.stringify(hostedZoneNameservers.sort())) {
    log.info('Updating your domain nameservers to match the ones in your hosted zone...')
    log.debug('Hosted zone nameservers:', hostedZoneNameservers)
    log.debug('Domain nameservers:', domainNameservers)
    const route53Domains = new Route53Domains()

    await route53Domains.updateDomainNameservers({
      DomainName: domainName,
      Nameservers: hostedZoneNameservers.map(ns => ({ Name: ns })),
    })

    writeNameserversToConfig(hostedZoneNameservers)

    log.info('Nameservers updated.')
    return true
  }

  log.success('Your nameservers are up to date.')
}

// please note, this function also updates the user's nameservers if they are out of date
export async function hasUserDomainBeenAddedToCloud(domainName?: string) {
  if (!domainName)
    domainName = config.app.url

  const route53 = new Route53()

  // check if the hosted zone already exists
  const existingHostedZones = await route53.listHostedZonesByName({ DNSName: domainName })

  if (!existingHostedZones || !existingHostedZones.HostedZones)
    return false

  const existingHostedZone = existingHostedZones.HostedZones.find(zone => zone.Name === `${domainName}.`)

  if (existingHostedZone) {
    const hostedZoneDetail = await route53.getHostedZone({ Id: existingHostedZone.Id })
    const hostedZoneNameservers = hostedZoneDetail.DelegationSet?.NameServers || []

    await updateNameservers(hostedZoneNameservers, domainName)

    // need to return true here to indicate that the domain
    // has been added to cloud and is properly configured
    return true
  }

  return false
}

export async function addDomain(options: DeployOptions) {
  return await runAction(Action.DomainsAdd, options)
}
