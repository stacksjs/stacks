// // setup the www redirect
//     // Create a bucket for www.yourdomain.com and configure it to redirect to yourdomain.com
//     const wwwBucket = new s3.Bucket(this, 'WwwBucket', {
//       bucketName: `www.${props.domain}`,
//       websiteRedirect: {
//         hostName: props.domain,
//         protocol: s3.RedirectProtocol.HTTPS,
//       },
//       removalPolicy: RemovalPolicy.DESTROY,
//       autoDeleteObjects: true,
//     })

//     // Create a Route53 record for www.yourdomain.com
//     new route53.ARecord(this, 'WwwAliasRecord', {
//       recordName: `www.${props.domain}`,
//       zone: props.zone,
//       target: route53.RecordTarget.fromAlias(new targets.BucketWebsiteTarget(wwwBucket)),
//     })

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
