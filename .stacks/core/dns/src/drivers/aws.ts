import { Route53 } from '@aws-sdk/client-route-53'
import { err, ok } from '@stacksjs/error-handling'
import { fs } from '@stacksjs/storage'
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
  // eslint-disable-next-line no-console
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

  updateNameservers(nameServers)

  // await storage.writeFile(p.projectConfigPath('dns.ts'), JSON.stringify(dns))

  return ok(nameServers)
}

function updateNameservers(nameservers: string[]) {
  try {
    const path = p.projectConfigPath('dns.ts')
    const fileContent = fs.readFileSync(path, 'utf-8')
    const modifiedContent = fileContent.replace(
      /nameservers: \[.*?\]/s,
            `nameservers: [${nameservers.map(ns => `'${ns}'`).join(', ')}]`,
    )
    fs.writeFileSync(path, modifiedContent, 'utf-8')
    // eslint-disable-next-line no-console
    console.log('Nameservers updated successfully.')
  }
  catch (err) {
    console.error('Error updating nameservers:', err)
  }
}

// deleteHostedZone('stacksjs.org').catch(console.error)
// createHostedZone('stacksjs.org').catch(console.error)
