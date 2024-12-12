import { useHead, useSeoMeta } from '@vueuse/head'

function useSEOHeader() {
  useHead({
    title: 'stacks/radio-group',
    titleTemplate: title => `${title} | An opinionated radio group component for Vue.`,
    meta: [
      {
        name: 'author',
        content: '@xiaoluoboding',
      },
      {
        name: 'description',
        content: 'An opinionated radio group component for Vue.',
      },
    ],
  })

  useSeoMeta({
    title: 'stacks/radio-group',
    description: 'An opinionated radio group component for Vue.',
    ogDescription: 'An opinionated radio group component for Vue.',
    ogTitle: 'stacks/radio-group',
    ogImage: 'https://vue-sonner.vercel.app/og.png',
    ogImageHeight: '882',
    ogImageWidth: '1686',
    twitterCard: 'summary_large_image',
    twitterImage: 'https://vue-sonner.vercel.app/og.png',
    twitterTitle: 'stacks/radio-group',
    twitterDescription: 'An opinionated radio group component for Stacks.',
  })
}

export { useSEOHeader }
