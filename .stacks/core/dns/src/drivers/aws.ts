import { Route53 } from '@aws-sdk/client-route-53'
import { err, ok } from '@stacksjs/error-handling'
import { storage } from '@stacksjs/storage'
import { path as p } from '@stacksjs/path'

// todo: need to consider that the domain may be in a non-AWS account
// in which case, we need to ensure that the user's nameservers point to AWS

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
  console.log(`Deleted Hosted Zone for domain: ${domainName}`)
  return ok('success')
}

export async function createHostedZone(domainName: string) {
  const route53 = new Route53()

  // Check if the hosted zone already exists
  const existingHostedZones = await route53.listHostedZonesByName({ DNSName: domainName })
  if (!existingHostedZones || !existingHostedZones.HostedZones)
    return err((`No hosted zones found for domain: ${domainName}`))

  const existingHostedZone = existingHostedZones.HostedZones.find(zone => zone.Name === `${domainName}.`)
  if (existingHostedZone)
    return err((`Hosted Zone already exists for domain: ${domainName}`))

  // Create the hosted zone
  const hostedZone = await route53.createHostedZone({
    Name: domainName,
    CallerReference: `${Date.now()}`,
  })

  // Update the nameservers
  const nameServers = hostedZone.DelegationSet?.NameServers
  if (!nameServers)
    return err((`No nameservers found for domain: ${domainName}`))

  storage.writeFile(p.projectStoragePath('framework/cache/nameservers.txt'), nameServers.join('\n'))

  console.log(`Created Hosted Zone for domain: ${domainName}`)
  console.log(`Nameservers: ${nameServers.join(', ')}`)

  return ok(nameServers)
}

// deleteHostedZone('stacksjs.com').catch(console.error)
// createHostedZone('stacksjs.com').catch(console.error)
