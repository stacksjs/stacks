<script lang="ts" setup>
import { ref } from 'vue'
import { useCopyCode } from './composables/useCopyCode'

const showCheckIcon = ref(false)

const slotsRenderedCode = ref(`
<template>
  <Popover v-slot="{ open }">
    <!-- Use the 'open' state to conditionally change the direction of the chevron icon. -->
    <PopoverButton>
      Solutions
      <ChevronDownIcon :class="{ 'rotate-180 transform': open }" />
    </PopoverButton>

    <PopoverPanel>
      <a href="/insights">Insights</a>
      <a href="/automations">Automations</a>
      <a href="/reports">Reports</a>
    </PopoverPanel>
  </Popover>
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
        For example, the <code>Popover</code> component exposes an open state, which tells you if the popover is currently open.
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
