export interface BlogConfig {
  subdomain: string
  title: string
  description: string
  postsPerPage: number
  enableComments: boolean
  enableRss: boolean
  enableSitemap: boolean
  enableSearch: boolean
  social: {
    twitter?: string
    github?: string
  }
  theme: {
    primaryColor: string
    logo?: string
  }
}

const config: BlogConfig = {
  subdomain: 'blog',
  title: 'Stacks Blog',
  description: 'The official Stacks.js blog',
  postsPerPage: 10,
  enableComments: true,
  enableRss: true,
  enableSitemap: true,
  enableSearch: true,
  social: {
    twitter: 'stacksjs',
    github: 'stacksjs/stacks',
  },
  theme: {
    primaryColor: '#3451b2',
    logo: '/images/logos/logo-transparent.svg',
  },
}

export default config
