<script lang="ts" setup>
import { ref } from 'vue'
import { useCopyCode } from './composables/useCopyCode'

const showCheckIcon = ref(false)

const slotsRenderedCode = ref(`
<template>
  <Listbox v-model="selectedPerson">
    <ListboxButton>{{ selectedPerson.name }}</ListboxButton>
    <ListboxOptions>
      <!-- Use the \`active\` state to conditionally style the active option. -->
      <!-- Use the \`selected\` state to conditionally style the selected option. -->
      <ListboxOption
        v-for="person in people"
        :key="person.id"
        :value="person"
        as="template"
        v-slot="{ active, selected }"
      >
        <li
          :class="{
            'bg-blue-500 text-white': active,
            'bg-white text-black': !active,
          }"
        >
          <CheckIcon v-show="selected" />
          {{ person.name }}
        </li>
      </ListboxOption>
    </ListboxOptions>
  </Listbox>
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
        Each component exposes information about its current state via <a class="text-blue-500" href="https://vuejs.org/guide/essentials/slots.html#slot-props" target="_blank">slot props</a> that you can use to conditionally apply different styles or render different content.
        <br><br>
        For example, the <code><b>ListboxOption</b></code> component exposes an active state, which tells you if the item is currently focused via the mouse or keyboard.
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
