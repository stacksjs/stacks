export interface DeployOptions {
  /**
   * **Deployment Host**
   *
   * The host to deploy to.
   *
   * @default string 'aws'
   * @see https://stacksjs.dev/docs/components
   */
  driver: 'netlify' | 'vercel' | 'aws' | 'cloudflare' | 'azure' | 'digital-ocean'
}
