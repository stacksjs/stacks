import { useHead, useSeoMeta } from '@vueuse/head'

function useSEOHeader() {
  useHead({
    title: 'stacks/payment',
    titleTemplate: title => `${title} | An opinionated payment component for Vue.`,
    meta: [
      {
        name: 'author',
        content: '@xiaoluoboding',
      },
      {
        name: 'description',
        content: 'An opinionated payment component for Vue.',
      },
    ],
  })

  useSeoMeta({
    title: 'stacks/payment',
    description: 'An opinionated payment component for Vue.',
    ogDescription: 'An opinionated payment component for Vue.',
    ogTitle: 'stacks/payment',
    ogImage: 'https://vue-sonner.vercel.app/og.png',
    ogImageHeight: '882',
    ogImageWidth: '1686',
    twitterCard: 'summary_large_image',
    twitterImage: 'https://vue-sonner.vercel.app/og.png',
    twitterTitle: 'stacks/payment',
    twitterDescription: 'An opinionated payment component for Stacks.',
  })
}

export { useSEOHeader }
