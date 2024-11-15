import { useHead, useSeoMeta } from '@vueuse/head'

function useSEOHeader() {
  useHead({
    title: 'stacks/switch',
    titleTemplate: title => `${title} | An opinionated popover component for Vue.`,
    meta: [
      {
        name: 'author',
        content: '@xiaoluoboding',
      },
      {
        name: 'description',
        content: 'An opinionated switch component for Vue.',
      },
    ],
  })

  useSeoMeta({
    title: 'stacks/switch',
    description: 'An opinionated switch component for Vue.',
    ogDescription: 'An opinionated switch component for Vue.',
    ogTitle: 'stacks/switch',
    ogImage: 'https://vue-sonner.vercel.app/og.png',
    ogImageHeight: '882',
    ogImageWidth: '1686',
    twitterCard: 'summary_large_image',
    twitterImage: 'https://vue-sonner.vercel.app/og.png',
    twitterTitle: 'stacks/switch',
    twitterDescription: 'An opinionated switch component for Stacks.',
  })
}

export { useSEOHeader }
