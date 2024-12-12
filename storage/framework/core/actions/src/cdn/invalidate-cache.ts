// TODO: port over logic from meemalabs/cloudfront to invalidate cache
// buddy cloud --invalidate-cache --paths /index.html /about.html

// import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront'

// const cloudfront = new CloudFrontClient()

// const params = {
//   DistributionId: 'YOUR_DISTRIBUTION_ID', /* required */
//   InvalidationBatch: { /* required */
//     CallerReference: `${Date.now()}`, /* required */
//     Paths: { /* required */
//       Quantity: 1, /* required */
//       Items: [
//         '/*',
//         /* more items */
//       ],
//     },
//   },
// }

// const command = new CreateInvalidationCommand(params)

// cloudfront.send(command).then(
//   data => console.log(data),
//   err => console.log(err, err.stack),
// )
