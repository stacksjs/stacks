// import { type NestedStackProps } from 'aws-cdk-lib'
// import { NestedStack, aws_route53 as route53 } from 'aws-cdk-lib'
// import { type Construct } from 'constructs'
// import { app } from '@stacksjs/config'

// export class DnsStack extends NestedStack {
//   constructor(scope: Construct, id: string, props?: NestedStackProps) {
//     super(scope, id, props)

//     if (!app.url)
//       throw new Error('./config app.url is not defined')

//     new route53.PublicHostedZone(this, 'HostedZone', {
//       zoneName: app.url,
//     })
//   }
// }

export * from './drivers/aws'
export * from '@stacksjs/dnsx'
