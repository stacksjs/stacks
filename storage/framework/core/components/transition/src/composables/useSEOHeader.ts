import { useHead, useSeoMeta } from '@vueuse/head'

function useSEOHeader() {
  useHead({
    title: 'stacks/transition',
    titleTemplate: title => `${title} | An opinionated transition component for Vue.`,
    meta: [
      {
        name: 'author',
        content: '@xiaoluoboding',
      },
      {
        name: 'description',
        content: 'An opinionated transition component for Vue.',
      },
    ],
  })

  useSeoMeta({
    title: 'stacks/transition',
    description: 'An opinionated transition component for Vue.',
    ogDescription: 'An opinionated transition component for Vue.',
    ogTitle: 'stacks/transition',
    ogImage: 'https://vue-sonner.vercel.app/og.png',
    ogImageHeight: '882',
    ogImageWidth: '1686',
    twitterCard: 'summary_large_image',
    twitterImage: 'https://vue-sonner.vercel.app/og.png',
    twitterTitle: 'stacks/transition',
    twitterDescription: 'An opinionated transition component for Stacks.',
  })
}

export { useSEOHeader }
