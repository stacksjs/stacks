<script lang="ts" setup>
import {
  TransitionRoot,
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/vue'

import { computed, ref } from 'vue'
import type { Ref } from 'vue'

interface Person {
  id: number
  name: string
}

const listItems = ref<string>(`Chris Breuer
Avery Hill
Glenn Michael
Michael Vincent
Blake Ayer
`)

const selected = ref<Person | null>(null)
const query = ref<string>('')
const items = computed(() => {

  return listItems.value
        .trim()
        .split('\n')
        .filter((item: string) =>
          item.toLowerCase().includes(query.value.toLowerCase())
        )
}) as Ref<string[]>
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex text-left">
      <label for="comment" class="block text-lg font-medium text-gray-900">Enter your list:</label>
    </div>
    <div class="mt-2">
      <div class="flex flex-col">
        <textarea rows="4"  v-model='listItems' class="block flex w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"></textarea>
      </div>
    </div>
    <div class="flex z-20 mr-auto flex text-left">
      <Combobox v-model="selected">
        <div class="relative mt-1">
          <div
            class="relative w-full cursor-default overflow-hidden rounded-lg bg-white text-left shadow-md sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/75 focus-visible:ring-offset-teal-300"
          >
            <ComboboxInput
              class="w-full border-none py-2 pl-3 pr-10 text-sm text-gray-900 leading-5 focus:outline-none focus:ring-0"
              :display-value="(person: any) => person?.name"
              placeholder="Search..."
              @change="query = $event.target.value"
            />
            <ComboboxButton
              class="absolute inset-y-0 right-0 flex items-center pr-2"
            >
              <div class="i-heroicons-chevron-up-down-20-solid" />
            </ComboboxButton>
          </div>
          <TransitionRoot
            leave="transition ease-in duration-100"
            leave-from="opacity-100"
            leave-to="opacity-0"
            @after-leave="query = ''"
          >
            <ComboboxOptions
              class="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 sm:text-sm focus:outline-none"
            >
              <div
                v-if="items.length === 0 && query !== ''"
                class="relative cursor-default select-none px-4 py-2 text-gray-700"
              >
                Nothing found.
              </div>

              <ComboboxOption
                v-for="(item, index) in items"
                :key="index"
                v-slot="{ selected, active }"
                as="template"
                :value="item"
              >
                <li
                  class="relative cursor-default select-none py-2 pl-10 pr-4"
                  :class="{
                    'bg-teal-600 text-white': active,
                    'text-gray-900': !active,
                  }"
                >
                  <span
                    class="block truncate"
                    :class="{ 'font-medium': selected, 'font-normal': !selected }"
                  >
                    {{ item }}
                  </span>
                  <span
                    v-if="selected"
                    class="absolute inset-y-0 left-0 flex items-center pl-3"
                    :class="{ 'text-white': active, 'text-teal-600': !active }"
                  >
                    <div class="i-heroicons-check-20-solid" />
                  </span>
                </li>
              </ComboboxOption>
            </ComboboxOptions>
          </TransitionRoot>
        </div>
      </Combobox>
    </div>
  </div>
</template>
