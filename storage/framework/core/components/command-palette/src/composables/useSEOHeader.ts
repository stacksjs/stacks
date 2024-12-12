import { useHead, useSeoMeta } from '@vueuse/head'

function useSEOHeader() {
  useHead({
    title: 'stacks/command-palette',
    titleTemplate: title => `${title} | An opinionated command palette component for Vue.`,
    meta: [
      {
        name: 'author',
        content: '@xiaoluoboding',
      },
      {
        name: 'description',
        content: 'An opinionated command palette component for Vue.',
      },
    ],
  })

  useSeoMeta({
    title: 'stacks/command-palette',
    description: 'An opinionated command palette component for Vue.',
    ogDescription: 'An opinionated command palette component for Vue.',
    ogTitle: 'stacks/command-palette',
    ogImage: 'https://vue-sonner.vercel.app/og.png',
    ogImageHeight: '882',
    ogImageWidth: '1686',
    twitterCard: 'summary_large_image',
    twitterImage: 'https://vue-sonner.vercel.app/og.png',
    twitterTitle: 'stacks/command-palette',
    twitterDescription: 'An opinionated command palette component for Stacks.',
  })
}

export { useSEOHeader }
