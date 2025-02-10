<script setup lang="ts">
defineOptions({
  name: 'HomePage',
})

// https://github.com/vueuse/head
// you can use this to manipulate the document head in any components,
// they will be rendered correctly in the html results with vite-ssg
useHead({
  // title: app.name,
  title: 'Stacks',
  meta: [
    { name: 'description', content: 'Coming soon.' },
    {
      name: 'theme-color',
      content: () => (isDark.value ? '#00aba9' : '#ffffff'),
    },
  ],
  link: [
    {
      rel: 'icon',
      type: 'image/svg+xml',
      href: () => (preferredDark.value ? '/favicon-dark.svg' : '/favicon.svg'),
    },
  ],
})

// const user = useUserStore()
// const name = ref(user.savedName)

// const router = useRouter()
// function go() {
//   if (name.value)
//     router.push(`/hello-world/${encodeURIComponent(name.value)}`)
// }

// const { t } = useI18n()
</script>

<template>
  <!-- <Header /> -->

  <main>
    <ComingSoon />
    <!-- <Hero /> -->
    <!-- <PrimaryFeatures /> -->
    <!-- <PrimaryFeatures2 />
    <SecondaryFeatures />
    <CallToAction />
    <Testimonials />
    <Pricing />
    <Faqs /> -->
  </main>

  <Footer />
</template>
