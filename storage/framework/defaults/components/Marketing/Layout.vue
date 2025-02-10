<script setup lang="ts">
// into useHead
// const metadata = {
//   title: {
//     template: '%s - TaxPal',
//     default: 'TaxPal - Accounting made simple for small businesses',
//   },
//   description: 'Most bookkeeping software is accurate, but hard to use. We make the opposite trade-off, and hope you don’t get audited.',
// }

const inter = {
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
}

const lexend = {
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-lexend',
}
</script>

<template>
  <html
    lang="en"
    class="h-full scroll-smooth bg-white antialiased" :class="[
      inter.variable,
      lexend.variable,
    ]"
  >
    <body class="h-full flex flex-col">
      <slot />
    </body>
  </html>
</template>
