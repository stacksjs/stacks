<script lang="ts" setup>
import { ref } from 'vue'
import { useCopyCode } from './composables/useCopyCode'

const showCheckIcon = ref(false)

const slotsRenderedCode = ref(`
<template>
  <Dropdown>
    <DropdownButton>Options</DropdownButton>
    <DropdownItems>
      <!-- Use the active state to conditionally style the active item. -->
      <DropdownItem
        v-for="link in links"
        :key="link.href"
        as="template"
        v-slot="{ active }"
      >
        <a
          :href="link.href"
          :class="{ 'bg-blue-500 text-white': active, 'bg-white text-black': !active }"
        >
          {{ link.label }}
        </a>
      </DropdownItem>
    </DropdownItems>
  </Dropdown>
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
        Each component exposes information about its current state via <code><b>slot props</b></code> that you can use to conditionally apply different styles or render different content. <br><br>
        For example, the <code><b>DropdownItem</b></code> component exposes an active state, which tells you if the item is currently focused via the mouse or keyboard.
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
