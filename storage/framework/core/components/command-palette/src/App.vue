<script lang="ts" setup>
import Footer from './components/Footer.vue'
import Hero from './components/Hero.vue'
import Installation from './components/Installation.vue'

import { useSEOHeader } from './composables/useSEOHeader'

useSEOHeader()
</script>

<template>
  <div class="dropdown-wrapper bg-neutral-100/66 px-4 dark:bg-neutral-900">
    <div class="relative mx-auto max-w-full container sm:max-w-2xl">
      <header class="flex-center flex-col py-20">
        <Hero />
      </header>

      <main
        class="text-primary grid grid-cols-1 gap-8 pb-20 text-xs 2xl:text-sm"
      >
        <Installation />
        <Usage />
      </main>
      <Footer />
    </div>
  </div>
</template>
