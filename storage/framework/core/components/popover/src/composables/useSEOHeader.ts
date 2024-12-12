import { useHead, useSeoMeta } from '@vueuse/head'

function useSEOHeader() {
  useHead({
    title: 'stacks/popover',
    titleTemplate: title => `${title} | An opinionated popover component for Vue.`,
    meta: [
      {
        name: 'author',
        content: '@xiaoluoboding',
      },
      {
        name: 'description',
        content: 'An opinionated popover component for Vue.',
      },
    ],
  })

  useSeoMeta({
    title: 'stacks/popover',
    description: 'An opinionated popover component for Vue.',
    ogDescription: 'An opinionated popover component for Vue.',
    ogTitle: 'stacks/popover',
    ogImage: 'https://vue-sonner.vercel.app/og.png',
    ogImageHeight: '882',
    ogImageWidth: '1686',
    twitterCard: 'summary_large_image',
    twitterImage: 'https://vue-sonner.vercel.app/og.png',
    twitterTitle: 'stacks/popover',
    twitterDescription: 'An opinionated popover component for Stacks.',
  })
}

export { useSEOHeader }
