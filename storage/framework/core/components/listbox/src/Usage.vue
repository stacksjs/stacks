<script lang="ts" setup>
import { ref } from 'vue'
import { useCopyCode } from './composables/useCopyCode'

const code = `<!-- App.vue -->
<script lang="ts" setup>
import { ref } from 'vue'
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@stacksjs/listbox'

const people = [
  { id: 1, name: 'Durward Reynolds', unavailable: false },
  { id: 2, name: 'Kenton Towne', unavailable: false },
  { id: 3, name: 'Therese Wunsch', unavailable: false },
  { id: 4, name: 'Benedict Kessler', unavailable: true },
  { id: 5, name: 'Katelyn Rohan', unavailable: false },
]

const selectedPerson = ref(people[0])
<\/script>

<template>
   <Listbox v-model="selectedPerson">
    <ListboxButton>{{ selectedPerson.name }}</ListboxButton>
    <ListboxOptions>
      <ListboxOption
        v-for="person in people"
        :key="person.id"
        :value="person"
        :disabled="person.unavailable"
      >
        {{ person.name }}
      </ListboxOption>
    </ListboxOptions>
  </Listbox>
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
      Listboxes are built using the <code><b>Listbox</b></code>, <code><b>ListboxButton</b></code>, <code><b>ListboxOptions</b></code>, <code><b>ListboxOption</b></code> and <code><b>ListboxLabel</b></code> components.
      <br><br>
      The <code><b>ListboxButton</b></code> will automatically open/close the <code><b>ListboxOptions</b></code> when clicked, and when the menu is open, the list of items receives focus and is automatically navigable via the keyboard.
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
      To learn more, read this part of the documentation, as much of <a class="text-blue-500" href="https://headlessui.com/v1/vue/listbox" target="_blank">Headless UI</a> is proxied.
    </p>
  </div>
</template>
