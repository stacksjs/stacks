import { useHead, useSeoMeta } from '@vueuse/head'

function useSEOHeader() {
  useHead({
    title: 'stacks/stepper',
    titleTemplate: title => `${title} | An opinionated stepper component for Vue.`,
    meta: [
      {
        name: 'author',
        content: '@xiaoluoboding',
      },
      {
        name: 'description',
        content: 'An opinionated stepper component for Vue.',
      },
    ],
  })

  useSeoMeta({
    title: 'stacks/stepper',
    description: 'An opinionated stepper component for Vue.',
    ogDescription: 'An opinionated stepper component for Vue.',
    ogTitle: 'stacks/stepper',
    ogImage: 'https://vue-sonner.vercel.app/og.png',
    ogImageHeight: '882',
    ogImageWidth: '1686',
    twitterCard: 'summary_large_image',
    twitterImage: 'https://vue-sonner.vercel.app/og.png',
    twitterTitle: 'stacks/stepper',
    twitterDescription: 'An opinionated stepper component for Stacks.',
  })
}

export { useSEOHeader }
