export interface DeployOptions {
  /**
   * **Deployment Host**
   *
   * The host to deploy to.
   *
   * @default string 'netlify'
   * @see https://stacksjs.dev/docs/components
   */
  driver: 'netlify' | 'vercel'
}
