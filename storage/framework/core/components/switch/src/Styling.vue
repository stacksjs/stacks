<script lang="ts" setup>
import { ref } from 'vue'
import { useCopyCode } from './composables/useCopyCode'

const showCheckIcon = ref(false)

const slotsRenderedCode = ref(`
<template>
   <Switch v-model="enabled" as="template" v-slot="{ checked }">
    <button
      class="relative inline-flex h-6 w-11 items-center rounded-full"
      :class="checked ? 'bg-blue-600' : 'bg-gray-200'"
    >
      <span class="sr-only">Enable notifications</span>
      <span
        :class="checked ? 'translate-x-6' : 'translate-x-1'"
        class="inline-block h-4 w-4 transform rounded-full bg-white transition"
      />
    </button>
  </Switch>
</template>`)

async function handleCopyCode() {
  await useCopyCode({ code: slotsRenderedCode.value, checkIconRef: showCheckIcon })
}
</script>

<template>
  <div class="styles">
    <h1 class="my-2 text-lg font-semibold">
      Styling with slots
    </h1>
    <div class="mt-5">
      <p class="my-3 text-base">
        Each component exposes information about its current state via <a href="https://vuejs.org/guide/essentials/slots.html" target="_blank">slots</a> that you can use to conditionally apply different styles or render different content. <br><br>
        For example, the <code>Switch</code> component exposes an <code>checked</code> state, which tells you if the switch is currently checked or not.
      </p>

      <div class="code-block relative">
        <Highlight :code="slotsRenderedCode" />
        <button
          aria-label="Copy code"
          title="Copy code"
          class="btn-border absolute right-2 top-2 p-1"
          @click="handleCopyCode"
        >
          <div v-if="showCheckIcon" class="i-hugeicons:checkmark-circle-01 text-gray-500" />
          <div v-else class="i-hugeicons:copy-01 text-gray-500" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
code {
  font-weight: 600;
}
</style>
