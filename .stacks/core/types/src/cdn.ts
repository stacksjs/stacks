export interface CdnOptions {
  /**
   * **CDN Driver**
   *
   * This value determines the default CDN driver that will be used when interacting with the
   * CDN service. This value may be overridden when interacting with the CDN service.
   *
   * @default "cloudfront"
   * @example "cloudfront"
   * @example "fastly" wip
   *
   * @see https://stacks.js.org/docs/cdn
   */
  driver: string
}

export type CdnConfig = Partial<CdnOptions>
