import analytics from '../../../config/analytics'
import type { HeadConfig } from 'vitepress'

export const faviconHead: HeadConfig[] = [
  [
    'link',
    {
      rel: 'icon',
      href: '/favicon.png',
    },
  ],
]

export const googleAnalyticsHead: HeadConfig[] = [
  [
    'script',
    { async: '', src: `https://www.googletagmanager.com/gtag/js?id=${analytics.drivers?.googleAnalytics?.trackingId}` },
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
    { 'src': 'https://cdn.usefathom.com/script.js', 'data-site': analytics.drivers?.fathom?.siteId || '', 'defer': '' },
  ],
]

export const analyticsHead = analytics.driver === 'fathom'
  ? fathomAnalyticsHead
  : analytics.driver === 'google-analytics'
    ? googleAnalyticsHead
    : []
