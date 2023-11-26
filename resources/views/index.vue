<script setup lang="ts">
// import { app } from '@stacksjs/config'

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
      content: () => isDark.value ? '#00aba9' : '#ffffff',
    },
  ],
  link: [
    {
      rel: 'icon',
      type: 'image/svg+xml',
      href: () => preferredDark.value ? '/favicon-dark.svg' : '/favicon.svg',
    },
  ],
})

defineOptions({
  name: 'IndexPage',
})

const user = useUserStore()
const name = ref(user.savedName)

const router = useRouter()
function go() {
  if (name.value)
    router.push(`/hi/${encodeURIComponent(name.value)}`)
}

const { t } = useI18n()
</script>

<template>
  <div class="bg-white h-full flex flex-col items-center justify-center">
    <div class="border-2 border-gray-100 p-4 rounded">
      <h1 class="text-gray-900 text-7xl tracking-tight uppercase font-semibold">
        Stacks
      </h1>
    </div>

    <h2 class="text-gray-700 text-2xl pt-6 tracking-tighter">
      Coming soon, 2024 — in a fresh paint.
    </h2>
  </div>
</template>
