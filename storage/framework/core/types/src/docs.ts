import type { UserConfig } from 'vitepress'

interface DeployedUserConfig extends UserConfig {
  deploy: boolean
}

export type DocsConfig = Partial<DeployedUserConfig>
export type DocsOptions = DocsConfig

export interface SocialLink {
  icon: SocialLinkIcon
  link: string
  ariaLabel?: string
}

export enum SocialLinkIcon {
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
