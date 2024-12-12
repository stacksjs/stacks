import type { UserConfig } from 'vitepress'

export interface DocsUserConfig extends UserConfig {
  deploy: boolean
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
