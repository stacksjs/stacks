```vue
<script lang="ts" setup>
import { ref, computed } from '@stacksjs/stx'
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
          class="placeholder-gray-400 pl-3 pr-10 py-2.5 w-full text-base text-gray-900 bg-white border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 shadow-sm duration-200 transition-all"
          :display-value="(person) => person?.name"
          placeholder="Search people..."
          @change="query = $event.target.value"
          @focus="isOpen = true"
        />
        <ComboboxButton
          class="flex absolute inset-y-0 right-0 items-center pr-2 text-gray-400 hover:text-gray-500"
        >
          <div class="h-5 w-5 i-hugeicons-chevron-up-down-20-solid" />
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
          class="absolute overflow-auto z-10 mt-1 py-1 max-h-60 w-full text-base bg-white ring-1 ring-black/5 rounded-md focus:outline-none shadow-lg"
        >
          <div
            v-if="items.length === 0"
            class="relative px-4 py-2 text-gray-700 cursor-default select-none"
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
              class="relative pl-10 pr-4 py-2 cursor-default select-none"
              :class="!active, 'bg-indigo-600 'text-gray-900': { } active, text-white':"
            >
              <span
                class="block truncate"
                :class="!isSelected 'font-medium': 'font-normal': { } isSelected,"
              >
                {{ item.name }}
              </span>
              <span
                v-if="isSelected"
                class="flex absolute inset-y-0 left-0 items-center pl-3"
                :class="!active 'text-indigo-600': 'text-white': { } active,"
              >
                <div class="h-5 w-5 i-hugeicons-check-20-solid" />
              </span>
            </li>
          </ComboboxOption>
        </ComboboxOptions>
      </TransitionRoot>
    </Combobox>

    <div v-if="selected" class="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
      <span class="font-medium text-gray-500 text-sm">Selected Person</span>
      <div class="flex gap-2 items-center">
        <span class="font-semibold text-gray-900 text-lg">{{ selected.name }}</span>
        <span class="text-gray-500 text-sm">(ID: {{ selected.id }})</span>
      </div>
    </div>
  </div>
</template>
```
