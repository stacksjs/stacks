import { useHead, useSeoMeta } from '@vueuse/head'

function useSEOHeader() {
  useHead({
    title: 'stacks/listbox',
    titleTemplate: title => `${title} | An opinionated listbox component for Vue.`,
    meta: [
      {
        name: 'author',
        content: '@xiaoluoboding',
      },
      {
        name: 'description',
        content: 'An opinionated listbox component for Vue.',
      },
    ],
  })

  useSeoMeta({
    title: 'stacks/listbox',
    description: 'An opinionated listbox component for Vue.',
    ogDescription: 'An opinionated listbox component for Vue.',
    ogTitle: 'stacks/listbox',
    ogImage: 'https://vue-sonner.vercel.app/og.png',
    ogImageHeight: '882',
    ogImageWidth: '1686',
    twitterCard: 'summary_large_image',
    twitterImage: 'https://vue-sonner.vercel.app/og.png',
    twitterTitle: 'stacks/listbox',
    twitterDescription: 'An opinionated listbox component for Stacks.',
  })
}

export { useSEOHeader }
