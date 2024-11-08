import { useHead, useSeoMeta } from '@vueuse/head'

function useSEOHeader() {
  useHead({
    title: 'stacks/dialog',
    titleTemplate: title => `${title} | An opinionated dialog component for Vue.`,
    meta: [
      {
        name: 'author',
        content: '@xiaoluoboding',
      },
      {
        name: 'description',
        content: 'An opinionated dialog component for Vue.',
      },
    ],
  })

  useSeoMeta({
    title: 'stacks/dialog',
    description: 'An opinionated dialog component for Vue.',
    ogDescription: 'An opinionated dialog component for Vue.',
    ogTitle: 'stacks/dialog',
    ogImage: 'https://vue-sonner.vercel.app/og.png',
    ogImageHeight: '882',
    ogImageWidth: '1686',
    twitterCard: 'summary_large_image',
    twitterImage: 'https://vue-sonner.vercel.app/og.png',
    twitterTitle: 'stacks/dialog',
    twitterDescription: 'An opinionated dialog component for Stacks.',
  })
}

export { useSEOHeader }
