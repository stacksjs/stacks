<script lang="ts" setup>
import { ref } from 'vue'
import { useCopyCode } from './composables/useCopyCode'

const code = `<!-- App.vue -->
<script lang="ts" setup>
 import { Switch } from '@stacksjs/switch'
<\/script>

<template>
  <Switch
    v-model="enabled"
    :class="enabled ? 'bg-teal-900' : 'bg-teal-700'"
    class="relative inline-flex h-[38px] w-[74px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/75"
  >
    <span class="sr-only">Use setting</span>
    <span
      aria-hidden="true"
      :class="enabled ? 'translate-x-9' : 'translate-x-0'"
      class="pointer-events-none inline-block h-[34px] w-[34px] transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out"
    />
  </Switch>
</template>
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
      Switches are built using the <code>Switch</code> component, which takes in a ref via the <code>v-model</code> prop. You can toggle your Switch by clicking directly on the component, or by pressing the spacebar while its focused.
      <br><br>
      Toggling the switch updates your ref to its negated value.
    </p>
    <div class="group code-block relative">
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
      To learn more, read this part of the documentation, as much of <a class="text-blue-500" href="https://headlessui.com/v1/vue/switch" target="_blank">Headless UI</a> is proxied.
    </p>
  </div>
</template>

<style scoped>
code {
  font-weight: 600;
}
</style>
