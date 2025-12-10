<script lang="ts" setup>
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@stacksjs/combobox'

import { TransitionRoot } from '@stacksjs/transition'
import { computed, ref } from 'vue'
import DocsPlayground from './DocsPlayground.vue'
import ComboboxCode from './ComboboxCode.md'

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

const listItems = ref<Person[]>(defaultItems)
const selected = ref<Person | null>(null)
const query = ref('')
const isOpen = ref(false)

const items = computed(() => {
  return query.value === ''
    ? listItems.value
    : listItems.value.filter((item) =>
        item.name.toLowerCase().includes(query.value.toLowerCase())
      )
})

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  query.value = target.value
  isOpen.value = true
}

const handleSelect = (person: Person) => {
  selected.value = person
  isOpen.value = false
}

const formatInput = (text: string) => {
  return text.trim()
    .split('\n')
    .filter(line => line.length > 0)
    .map((name, index) => ({
      id: listItems.value.length + index + 1,
      name,
    }))
}

</script>

<template>
  <div class="demo-wrapper">
    <DocsPlayground>
      <div class="flex flex-col mx-auto max-w-full py-10 w-full">
        <main class="text-primary grid grid-cols-1 gap-8 text-xs 2xl:text-sm">
          <div class="relative w-1/2 items-center mx-auto ">
            <Combobox v-model="selected" as="div" class="relative ">
              <div class="relative">
                <ComboboxInput
                  class="w-full py-2.5 pl-3 pr-10 text-base text-gray-900 placeholder-gray-400 bg-white border border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200"
                  :display-value="(person: Person) => person?.name"
                  placeholder="Search people..."
                  @change="handleInput"
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
                    @click="handleSelect(item)"
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
          </div>
        </main>
      </div>

      <template #code>
        <ComboboxCode />
      </template>
    </DocsPlayground>
  </div>
</template>

<style scoped>
.demo-wrapper {
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif,
    Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji;
}

button {
  border: 0px solid #000;
}
</style>
