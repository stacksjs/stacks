import type { BunPressOptions } from '@stacksjs/bunpress'

export interface DocsUserConfig extends BunPressOptions {
  /**
   * Show a "last updated" stamp on each page.
   *
   * Declared here because `config/docs.ts` sets it and BunPressOptions does
   * not list it - which is what the `as any` on that whole config block was
   * covering, along with every other key in it.
   */
  lastUpdated?: boolean
  deploy?: boolean
}

export type DocsConfig = DocsUserConfig
export type DocsOptions = Partial<DocsConfig>

export interface SocialLink {
  icon: SocialLinkIcon
  link: string
  ariaLabel?: string
}

export enum SocialLinkIcon {
  Bluesky = 'bluesky',
  Discord = 'discord',
  Facebook = 'facebook',
  GitHub = 'github',
  Instagram = 'instagram',
  LinkedIn = 'linkedin',
  Mastodon = 'mastodon',
  Slack = 'slack',
  Twitter = 'twitter',
  YouTube = 'youtube',
}
