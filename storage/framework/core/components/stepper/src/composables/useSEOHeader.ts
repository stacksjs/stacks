import { useHead, useSeoMeta } from '@vueuse/head'

function useSEOHeader() {
  useHead({
    title: 'stacks/notification',
    titleTemplate: title => `${title} | An opinionated toast component for Vue.`,
    meta: [
      {
        name: 'author',
        content: '@xiaoluoboding',
      },
      {
        name: 'description',
        content: 'An opinionated toast component for Vue.',
      },
    ],
  })

  useSeoMeta({
    title: 'stacks/modal',
    description: 'An opinionated modal component for Vue.',
    ogDescription: 'An opinionated modal component for Vue.',
    ogTitle: 'stacks/modal',
    ogImage: 'https://vue-sonner.vercel.app/og.png',
    ogImageHeight: '882',
    ogImageWidth: '1686',
    twitterCard: 'summary_large_image',
    twitterImage: 'https://vue-sonner.vercel.app/og.png',
    twitterTitle: 'stacks/modal',
    twitterDescription: 'An opinionated notification component for Stacks.',
  })
}

export { useSEOHeader }
