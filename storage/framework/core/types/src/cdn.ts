export interface CdnOptions {
  /**
   * **CDN Driver**
   *
   * This value determines the default CDN driver that will be used when interacting with the
   * CDN service. This value may be overridden when interacting with the CDN service.
   *
   * @default "cloudfront"
   * @example "cloudfront"
   *
   * CloudFront is the only implemented driver. Fastly is requested in
   * stacksjs/stacks#265 and does not exist yet, so naming it here configures
   * nothing.
   *
   * @see https://stacks.js.org/docs/cdn
   */
  driver: string
}

export type CdnConfig = Partial<CdnOptions>
