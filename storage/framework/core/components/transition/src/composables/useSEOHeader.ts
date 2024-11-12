import { useHead, useSeoMeta } from '@vueuse/head'

function useSEOHeader() {
  useHead({
    title: 'stacks/dropdown',
    titleTemplate: title => `${title} | An opinionated dropdown component for Vue.`,
    meta: [
      {
        name: 'author',
        content: '@xiaoluoboding',
      },
      {
        name: 'description',
        content: 'An opinionated dropdown component for Vue.',
      },
    ],
  })

  useSeoMeta({
    title: 'stacks/dropdown',
    description: 'An opinionated dropdown component for Vue.',
    ogDescription: 'An opinionated dropdown component for Vue.',
    ogTitle: 'stacks/dropdown',
    ogImage: 'https://vue-sonner.vercel.app/og.png',
    ogImageHeight: '882',
    ogImageWidth: '1686',
    twitterCard: 'summary_large_image',
    twitterImage: 'https://vue-sonner.vercel.app/og.png',
    twitterTitle: 'stacks/dropdown',
    twitterDescription: 'An opinionated dropdown component for Stacks.',
  })
}

export { useSEOHeader }
