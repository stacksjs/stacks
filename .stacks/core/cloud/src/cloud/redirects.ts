// for each redirect, create a bucket & redirect it to the APP_URL
// config.dns.redirects?.forEach((redirect) => {
//   // TODO: use string-ts function here instead
//   const slug = redirect.split('.').map((part, index) => index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)).join('') // creates a CamelCase slug from the redirect
//   const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', { domainName: redirect })
//   const redirectBucket = new s3.Bucket(this, `RedirectBucket${slug}`, {
//     bucketName: `${redirect}-redirect`,
//     websiteRedirect: {
//       hostName: this.domain,
//       protocol: s3.RedirectProtocol.HTTPS,
//     },
//     removalPolicy: RemovalPolicy.DESTROY,
//     autoDeleteObjects: true,
//   })
//   new route53.CnameRecord(this, `RedirectRecord${slug}`, {
//     zone: hostedZone,
//     recordName: 'redirect',
//     domainName: redirectBucket.bucketWebsiteDomainName,
//   })
// })

// TODO: fix this – redirects do not work yet
// config.dns.redirects?.forEach((redirect) => {
//   const slug = redirect.split('.').map((part, index) => index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)).join('') // creates a CamelCase slug from the redirect
//   const hostedZone = route53.HostedZone.fromLookup(this, `RedirectHostedZone${slug}`, { domainName: redirect })
//   this.redirectZones.push(hostedZone)
// })
