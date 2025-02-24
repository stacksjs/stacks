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
  <div class="flex flex-col gap-2 my-10">
    <div class="flex z-20 mr-auto flex text-left ">
      <Combobox v-model="selected">
        <div class="relative mt-1">
          <div
            class="relative w-full cursor-pointer overflow-hidden rounded-lg bg-white border border-gray-300 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 transition"
          >
            <ComboboxInput
              class="w-full py-2.5 pl-3 pr-10 text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0"
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
            :show=true
            leave="transition ease-in duration-100"
            leave-from="opacity-100"
            leave-to="opacity-0"
            @after-leave="query = ''"
          >
            <ComboboxOptions
              class="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm"
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
                class="list-none -ml-4"
                v-slot="{ selected, active }"
                as="template"
                :value="item"
              >
                <li
                  class="relative cursor-default select-none py-2 pl-10 pr-4 "
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
    <div class="space-y-2 mt-2">
      <label for="comment" class="block text-lg font-semibold text-gray-800">
        Selected: {{ selected}}
      </label>
    </div>
    <div class="space-y-4 mt-10">
      <div class="text-left">
        <label for="comment" class="block text-xl font-semibold text-gray-800">
          Enter your items:
        </label>
      </div>
      <div>
        <textarea
          rows="4"
          v-model="listItems"
          class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 sm:text-base transition duration-200"
          placeholder="Type your list here..."
        ></textarea>
      </div>
    </div>
  </div>
</template>
