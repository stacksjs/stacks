import type { UserConfig } from 'vitepress'

export type DocsConfig = UserConfig
export type DocsOptions = DocsConfig

export interface SocialLink {
  icon: SocialLinkIcon
  link: string
  ariaLabel?: string
}

export type SocialLinkIcon =
  | 'discord'
  | 'facebook'
  | 'github'
  | 'instagram'
  | 'linkedin'
  | 'mastodon'
  | 'slack'
  | 'twitter'
  | 'youtube'
  | { svg: string }
