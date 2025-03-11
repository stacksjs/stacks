<script lang="ts" setup>
import { ref } from 'vue'
import { useCopyCode } from './composables/useCopyCode'

const code = `<!-- App.vue -->
<script lang="ts" setup>
 import { Combobox, ComboboxInput, ComboboxOptions, ComboboxOption } from '@stacksjs/combobox'
<\/script>

<template>
  <Combobox v-model="selectedPerson">
    <ComboboxInput @change="query = $event.target.value" />
    <ComboboxOptions>
      <ComboboxOption
        v-for="person in filteredPeople"
        :key="person"
        :value="person"
      >
        {{ person }}
      </ComboboxOption>
    </ComboboxOptions>
  </Combobox>
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
      Comboboxes are built using the <code><b>Combobox</b></code>, <code><b>ComboboxInput</b></code>, <code><b>ComboboxOptions</b></code>, <code><b>ComboboxOption</b></code> and <code><b>ComboboxLabel</b></code> components.
      <br><br>
      The <code><b>ComboboxInput</b></code> will automatically open/close the <code><b>ComboboxOptions</b></code> when searching.
      <br><br>
      You are completely in charge of how you filter the results, whether it be with a fuzzy search library client-side or by making server-side requests to an API. In this example we will keep the logic simple for demo purposes.
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
      To learn more, read this part of the documentation, as much of <a class="text-blue-500" href="https://headlessui.com/v1/vue/combobox" target="_blank">Headless UI</a> is proxied.
    </p>
  </div>
</template>
