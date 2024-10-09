import type { HeadConfig } from 'vitepress'
import analytics from '../../../../config/analytics'

export const faviconHead: HeadConfig[] = [
  [
    'link',
    {
      rel: 'icon',
      href: 'https://raw.githubusercontent.com/stacksjs/stacks/main/public/logo-transparent.svg?https://raw.githubusercontent.com/stacksjs/stacks/main/public/logo-transparent.svg?asdas',
    },
  ],
]

export const googleAnalyticsHead: HeadConfig[] = [
  [
    'script',
    {
      async: '',
      src: `https://www.googletagmanager.com/gtag/js?id=${analytics.drivers?.googleAnalytics?.trackingId}`,
    },
  ],
  [
    'script',
    {},
    `window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'TAG_ID');`,
  ],
]

export const fathomAnalyticsHead: HeadConfig[] = [
  [
    'script',
    {
      'src': 'https://cdn.usefathom.com/script.js',
      'data-site': analytics.drivers?.fathom?.siteId || '',
      'defer': '',
    },
  ],
]

export const analyticsHead
  = analytics.driver === 'fathom'
    ? fathomAnalyticsHead
    : analytics.driver === 'google-analytics'
      ? googleAnalyticsHead
      : []
