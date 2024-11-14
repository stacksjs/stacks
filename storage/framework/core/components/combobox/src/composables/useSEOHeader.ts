import { useHead, useSeoMeta } from '@vueuse/head'

function useSEOHeader() {
  useHead({
    title: 'stacks/combobox',
    titleTemplate: title => `${title} | An opinionated combobox component for Vue.`,
    meta: [
      {
        name: 'author',
        content: '@xiaoluoboding',
      },
      {
        name: 'description',
        content: 'An opinionated combobox component for Vue.',
      },
    ],
  })

  useSeoMeta({
    title: 'stacks/combobox',
    description: 'An opinionated combobox component for Vue.',
    ogDescription: 'An opinionated combobox component for Vue.',
    ogTitle: 'stacks/combobox',
    ogImage: 'https://vue-sonner.vercel.app/og.png',
    ogImageHeight: '882',
    ogImageWidth: '1686',
    twitterCard: 'summary_large_image',
    twitterImage: 'https://vue-sonner.vercel.app/og.png',
    twitterTitle: 'stacks/combobox',
    twitterDescription: 'An opinionated combobox component for Stacks.',
  })
}

export { useSEOHeader }
