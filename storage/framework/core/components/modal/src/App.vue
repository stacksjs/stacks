<script lang="ts" setup>
import type { Position, Theme } from './types'
import { ref } from 'vue'
import { Modal } from './components'
import Expand from './components/Expand.vue'
import Footer from './components/Footer.vue'
import Hero from './components/Hero.vue'
import Installation from './components/Installation.vue'
import Others from './components/Others.vue'
import Pos from './components/Position.vue'
import Styling from './components/Styling.vue'
import Theming from './components/Theming.vue'
import Types from './components/Types.vue'
import Usage from './components/Usage.vue'
import { useSEOHeader } from './composables/useSEOHeader'
// import { toggleDarkMode, isDark } from './composables/useDarkMode'

useSEOHeader()

const expand = ref(false)
const position = ref<Position>('top-right')
const richColors = ref(false)
const closeButton = ref(false)
const theme = ref<Theme>('light')

const visible = ref(true)

const handleClose = () => {
  visible.value = false
}
</script>

<template>
  <div class="bg-neutral-100/66 px-4 dark:bg-neutral-900">
    <div class="relative mx-auto max-w-full container sm:max-w-2xl">
      <header class="flex-center flex-col py-20">
        <Hero />
      </header>

      <main
        class="text-primary grid grid-cols-1 gap-8 pb-20 text-xs 2xl:text-sm"
      >
        <Installation />
        <Usage />

        <button @click="visible = true">Open Modal</button>

      </main>

      <!-- <Footer /> -->
    </div>

    <Modal :visible="visible" @close="handleClose">
      <div>Hello</div>
    </Modal>
  </div>
</template>
