<script lang="ts" setup>
import { ref } from 'vue'
import Dialog from './components/Dialog.vue'
import DialogPanel from './components/DialogPanel.vue'
import Hero from './Hero.vue'
import Installation from './Installation.vue'
import Transitions from './Transitions.vue'
import Usage from './Usage.vue'

import { useSEOHeader } from './composables/useSEOHeader'

useSEOHeader()

const visible = ref(false)

function handleOpen() {
  visible.value = true
}

function handleClose() {
  visible.value = false
}
</script>

<template>
  <div class="px-4 modal-wrapper bg-neutral-100/66 dark:bg-neutral-900">
    <div class="container relative max-w-full mx-auto sm:max-w-2xl">
      <header class="flex-col py-20 flex-center">
        <Hero @open="handleOpen" />
      </header>

      <main
        class="grid grid-cols-1 gap-8 pb-20 text-xs text-primary 2xl:text-sm"
      >
        <Installation />
        <Usage />
        <Transitions />
      </main>

      <Transition name="fade" appear>
        <Dialog v-model="visible" @close="handleClose">
          <DialogPanel>
            <h2>Greetings! This is a dialog.</h2>
          </DialogPanel>
        </Dialog>
      </Transition>
      <Footer />
    </div>
  </div>
</template>

<style scoped>
.modal-wrapper {
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif,
    Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji;
}

/* @unocss-placeholder */
</style>
