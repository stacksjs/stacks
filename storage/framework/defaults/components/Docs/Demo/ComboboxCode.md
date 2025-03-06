```vue
<script lang="ts" setup>
import { ref, computed } from 'vue'
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@stacksjs/combobox'
import { TransitionRoot } from '@stacksjs/transition'

interface Person {
  id: number
  name: string
}

const defaultItems = [
  { id: 1, name: 'Chris Breuer' },
  { id: 2, name: 'Avery Hill' },
  { id: 3, name: 'Glenn Michael' },
  { id: 4, name: 'Michael Vincent' },
  { id: 5, name: 'Blake Ayer' },
]

const listItems = ref(defaultItems)
const selected = ref(null)
const query = ref('')
const isOpen = ref(false)

const items = computed(() => {
  return query.value === ''
    ? listItems.value
    : listItems.value.filter((item) =>
        item.name.toLowerCase().includes(query.value.toLowerCase())
      )
})
</script>

<template>
  <div class="relative">
    <Combobox v-model="selected" as="div" class="relative">
      <div class="relative">
        <ComboboxInput
          class="w-full py-2.5 pl-3 pr-10 text-base text-gray-900 placeholder-gray-400 bg-white border border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200"
          :display-value="(person) => person?.name"
          placeholder="Search people..."
          @change="query = $event.target.value"
          @focus="isOpen = true"
        />
        <ComboboxButton
          class="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-500"
        >
          <div class="i-hugeicons-chevron-up-down-20-solid w-5 h-5" />
        </ComboboxButton>
      </div>

      <TransitionRoot
        :show="isOpen"
        leave="transition ease-in duration-100"
        leave-from="opacity-100"
        leave-to="opacity-0"
        @after-leave="query = ''"
      >
        <ComboboxOptions
          class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none"
        >
          <div
            v-if="items.length === 0"
            class="relative cursor-default select-none px-4 py-2 text-gray-700"
          >
            No results found.
          </div>

          <ComboboxOption
            v-for="item in items"
            :key="item.id"
            :value="item"
            v-slot="{ selected: isSelected, active }"
            as="template"
          >
            <li
              class="relative cursor-default select-none py-2 pl-10 pr-4"
              :class="{
                'bg-indigo-600 text-white': active,
                'text-gray-900': !active,
              }"
            >
              <span
                class="block truncate"
                :class="{ 'font-medium': isSelected, 'font-normal': !isSelected }"
              >
                {{ item.name }}
              </span>
              <span
                v-if="isSelected"
                class="absolute inset-y-0 left-0 flex items-center pl-3"
                :class="{ 'text-white': active, 'text-indigo-600': !active }"
              >
                <div class="i-hugeicons-check-20-solid w-5 h-5" />
              </span>
            </li>
          </ComboboxOption>
        </ComboboxOptions>
      </TransitionRoot>
    </Combobox>

    <div v-if="selected" class="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <span class="text-sm font-medium text-gray-500">Selected Person</span>
      <div class="flex items-center gap-2">
        <span class="text-lg font-semibold text-gray-900">{{ selected.name }}</span>
        <span class="text-sm text-gray-500">(ID: {{ selected.id }})</span>
      </div>
    </div>
  </div>
</template>
```
