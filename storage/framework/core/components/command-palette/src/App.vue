<script lang="ts" setup>

import { ref } from 'vue'
import { useSEOHeader } from './composables/useSEOHeader'

import Hero from './components/Hero.vue'
import Installation from './components/Installation.vue'
import Footer from './components/Footer.vue'

useSEOHeader()
import { collect } from 'ts-collect'

const searchList = [
  { key: 'command-item-mGWbsGpNdqDfvgOR', label: 'Linear' },
  { key: 'command-item-unRneeplsj28slSt', label: 'Raycast' },
  { key: 'command-item-3Jv6q_7YDoi0YhBj', label: 'Vercel' },
  { key: 'command-item-Yr_T9R3FWZQowB8z', label: 'Toggle Dark Mode' },
];
// console.log(searchList)

const items = collect(searchList)

// console.log(items);
const search = ref('ay')

const list = items.fuzzyMatch('label', search.value, 0.2).map(r => r).toArray()

console.log('list', list)


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
