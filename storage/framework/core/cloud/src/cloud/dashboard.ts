// // TODO: finish this cloudwatch dashboard
// // import type { aws_lambda as lambda } from 'aws-cdk-lib'
// import { Aws, CfnOutput as Output, aws_cloudwatch as cloudwatch } from 'aws-cdk-lib'
// import type { Construct } from 'constructs'
// import type { NestedCloudProps } from '../types'
//
// export interface DashboardStackProps extends NestedCloudProps {
//   dashboardName?: string
// }
//
// export class DashboardStack {
//   // lambdaFunction: lambda.Function
//   dashboard: cloudwatch.Dashboard
//
//   constructor(scope: Construct, props: DashboardStackProps) {
//     const dashboardName = props.dashboardName || 'StacksDashboard'
//
//     // Create Sample Lambda Function which will create metrics
//     // this.lambdaFunction = new Function(this, 'SampleLambda', {
//     //   handler: 'lambda-handler.handler',
//     //   runtime: Runtime.PYTHON_3_7,
//     //   code: new AssetCode(`./lambda`),
//     //   memorySize: 512,
//     //   timeout: Duration.seconds(10),
//     // })
//
//     // Create CloudWatch Dashboard
//     this.dashboard = new cloudwatch.Dashboard(scope, 'SampleLambdaDashboard', {
//       dashboardName,
//     })
//
//     // Create Title for Dashboard
//     this.dashboard.addWidgets(new cloudwatch.TextWidget({
//       markdown: `# Dashboard: `,
//       // markdown: `# Dashboard: ${this.lambdaFunction.functionName}`,
//       height: 1,
//       width: 24,
//     }))
//
//     // Create CloudWatch Dashboard Widgets: Errors, Invocations, Duration, Throttles
//     this.dashboard.addWidgets(new cloudwatch.GraphWidget({
//       title: 'Invocations',
//       left: [this.lambdaFunction.metricInvocations()],
//       width: 24,
//     }))
//
//     this.dashboard.addWidgets(new cloudwatch.GraphWidget({
//       title: 'Errors',
//       left: [this.lambdaFunction.metricErrors()],
//       width: 24,
//     }))
//
//     this.dashboard.addWidgets(new cloudwatch.GraphWidget({
//       title: 'Duration',
//       left: [this.lambdaFunction.metricDuration()],
//       width: 24,
//     }))
//
//     this.dashboard.addWidgets(new cloudwatch.GraphWidget({
//       title: 'Throttles',
//       left: [this.lambdaFunction.metricThrottles()],
//       width: 24,
//     }))
//
//     // Create Widget to show last 20 Log Entries
//     this.dashboard.addWidgets(new cloudwatch.LogQueryWidget({
//       logGroupNames: [this.lambdaFunction.logGroup.logGroupName],
//       queryLines: [
//         'fields @timestamp, @message',
//         'sort @timestamp desc',
//         'limit 20',
//       ],
//       width: 24,
//     }))
//
//     // Generate Output
//     const cloudwatchDashboardURL = `https://${Aws.REGION}.console.aws.amazon.com/cloudwatch/home?region=${Aws.REGION}#dashboards:name=${dashboardName}`
//
//     new Output(scope, 'DashboardOutput', {
//       value: cloudwatchDashboardURL,
//       description: 'The CloudWatch Dashboard URL',
//       exportName: 'StacksDashboardURL',
//     })
//   }
// }
