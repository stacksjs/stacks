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

const updateItems = (event: Event) => {
  const target = event.target as HTMLTextAreaElement
  const newItems = formatInput(target.value)
  listItems.value = newItems
}

const usageCode = `<!-- App.vue -->
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

const usageDescription = `Comboboxes are built using the <code><b>Combobox</b></code>, <code><b>ComboboxInput</b></code>, <code><b>ComboboxOptions</b></code>, <code><b>ComboboxOption</b></code> and <code><b>ComboboxLabel</b></code> components.
      <br><br>
      The <code><b>ComboboxInput</b></code> will automatically open/close the <code><b>ComboboxOptions</b></code> when searching.
      <br><br>
      You are completely in charge of how you filter the results, whether it be with a fuzzy search library client-side or by making server-side requests to an API. In this example we will keep the logic simple for demo purposes.`
</script>

<template>
  <div class="demo-wrapper">
    <div class="flex flex-col  mx-auto max-w-full">
      <main
          class="text-primary grid grid-cols-1 gap-8 pb-20 text-xs 2xl:text-sm"
        >
          <div class="flex flex-col gap-2">
            <p class="text-gray-600 text-xl">Search and select a person from the list</p>
          </div>
          <div class="relative">
            <Combobox v-model="selected" as="div" class="relative">
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
                  <div class="i-heroicons-chevron-up-down-20-solid w-5 h-5" />
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
                        <div class="i-heroicons-check-20-solid w-5 h-5" />
                      </span>
                    </li>
                  </ComboboxOption>
                </ComboboxOptions>
              </TransitionRoot>
            </Combobox>
          </div>

          <div v-if="selected" class="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <span class="text-sm font-medium text-gray-500">Selected Person</span>
            <div class=" flex items-center gap-2">
              <span class="text-lg font-semibold text-gray-900">{{ selected.name }}</span>
              <span class="text-sm text-gray-500">(ID: {{ selected.id }})</span>
            </div>
          </div>

          <div class="mt-4">
          <div class="flex flex-col gap-2">
            <label for="items-input" class="block text-lg font-medium text-gray-900">
              Edit List Items
            </label>
            <p class="text-sm text-gray-500">Enter each name on a new line</p>
          </div>
          <textarea
            id="items-input"
            rows="4"
            :value="listItems.map(item => item.name).join('\n')"
            @input="updateItems"
            class="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200"
            placeholder="Type your list here..."
          />
          </div>
        </main>
    </div>
  </div>

  <!-- <div class="flex flex-col gap-6 my-10 max-w-md ">

    <div class="flex flex-col gap-2">
      <h2 class="text-2xl font-bold text-gray-900">Combobox Demo</h2>
      <p class="text-gray-600">Search and select a person from the list</p>
    </div>


  </div> -->
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
