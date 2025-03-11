<script lang="ts" setup>
import { ref } from 'vue'
import { useCopyCode } from './composables/useCopyCode'

const code = `<!-- App.vue -->
<script setup>
  import { ref } from 'vue'
  import { TransitionRoot } from '@stacksjs/transition'

  const isShowing = ref(true)
<\/script>

<template>
  <button @click="isShowing = !isShowing">Toggle</button>
  <TransitionRoot
    :show="isShowing"
    enter="transition-opacity duration-75"
    enter-from="opacity-0"
    enter-to="opacity-100"
    leave="transition-opacity duration-150"
    leave-from="opacity-100"
    leave-to="opacity-0"
  >
    I will fade in and out
  </TransitionRoot>
<\/template>
`

const showCheckIcon = ref(false)

async function handleCopyCode() {
  await useCopyCode({ code, checkIconRef: showCheckIcon })
}
</script>

<template>
  <div class="usage">
    <h1 class="my-2 text-lg font-semibold">
      Usage
    </h1>
    <p class="my-3 text-base">
      The <code><b>TransitionRoot</b></code> accepts a <code><b>show</b></code> prop that controls whether the children should be shown or hidden, and a set of lifecycle props (like <code><b>enter-from</b></code>, and <code><b>leave-to</b></code>) that let you add CSS classes at specific phases of a transition.
    </p>
    <div class="code-block group relative">
      <Highlight
        class-name="rounded-md text-xs"
        language="xml"
        :autodetect="false"
        :code="code"
      />
      <button
        aria-label="Copy code"
        title="Copy code"
        class="btn-border absolute right-2 top-2 hidden p-1 group-hover:block"
        @click="handleCopyCode"
      >
        <div v-if="showCheckIcon" class="i-hugeicons:checkmark-circle-01 text-gray-500" />
        <div v-else class="i-hugeicons:copy-01 text-gray-500" />
      </button>
    </div>
    <p class="my-3 text-base">
      To learn more, read this part of the documentation, as much of <a class="text-blue-500" href="https://headlessui.com/v1/vue/transition" target="_blank">Headless UI</a> is proxied.
    </p>
  </div>
</template>
