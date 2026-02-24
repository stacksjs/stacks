/**
 * Custom Deploy Script
 *
 * This script runs during deployment. Use the hooks below to execute
 * custom logic before and after your infrastructure is deployed.
 *
 * Examples:
 * - Run database seeders after deployment
 * - Notify your team via Slack/Discord
 * - Warm up caches
 * - Run smoke tests against the deployed environment
 * - Sync environment variables
 *
 * @see https://stacksjs.org/docs/deployments
 */

/**
 * Runs before the infrastructure stack is deployed.
 * Use this for pre-deployment checks, building assets, or notifications.
 */
export async function beforeDeploy({ environment, region }: { environment: string, region: string }): Promise<void> {
  console.log(`  Preparing deployment to ${environment} in ${region}...`)
}

/**
 * Runs after the infrastructure stack has been successfully deployed.
 * Use this for post-deployment tasks like cache warming, notifications, or smoke tests.
 */
export async function afterDeploy({ environment, region: _region, outputs }: { environment: string, region: string, outputs: Record<string, string> }): Promise<void> {
  console.log(`  Deployment to ${environment} complete`)

  // Example: Log useful outputs
  for (const [key, value] of Object.entries(outputs)) {
    if (key.endsWith('PublicIp') || key.endsWith('DNS') || key.endsWith('Endpoint')) {
      console.log(`  ${key}: ${value}`)
    }
  }
}
