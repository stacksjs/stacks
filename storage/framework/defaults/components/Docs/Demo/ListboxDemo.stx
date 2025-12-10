<script lang="ts" setup>
import { ref } from 'vue'
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from '@stacksjs/listbox'

import ListboxCode from './ListboxCode.md'
import DocsPlayground from './DocsPlayground.vue'

interface Person {
  id: number
  name: string
  unavailable: boolean
}

const people: Person[] = [
  { id: 1, name: 'Chris Breuer', unavailable: false },
  { id: 2, name: 'Avery Hill', unavailable: false },
  { id: 3, name: 'Glenn Michael', unavailable: false },
  { id: 4, name: 'Michael Vincent', unavailable: true },
  { id: 5, name: 'Blake Ayer', unavailable: false },
]

const selectedPerson = ref<Person>(people[0] as Person)

</script>

<template>

<div class="max-w-4xl ">
  <DocsPlayground>
    <div class="space-y-4 w-3/5 my-12 mx-auto items-center h-[150px] w-[300px]">
      <Listbox v-model="selectedPerson">
        <div class="relative mt-1">
          <ListboxButton
            class="relative w-full cursor-default rounded-lg bg-white py-2 pl-3 pr-10 text-left shadow-md focus-visible:border-indigo-500 sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/75 focus-visible:ring-offset-orange-300 "
          >
            <span class="block truncate">{{ selectedPerson.name }}</span>
            <span
              class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2"
            >
              <div class="i-hugeicons-chevron-up-down-20-solid" />
            </span>
          </ListboxButton>

          <transition
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <ListboxOptions
              class="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 sm:text-sm focus:outline-none outline-none"
            >
              <ListboxOption
                v-for="person in people"
                class="list-none -ml-4"
                v-slot="{ active, selected }"
                :key="person.name"
                :value="person"
                as="template"
              >
                <li
                  class="relative cursor-default select-none py-2 pl-10 pr-4" :class="[
                    active ? 'bg-amber-100 text-amber-900' : 'text-gray-900',
                  ]"
                >
                  <span
                    class="block truncate" :class="[
                      selected ? 'font-medium' : 'font-normal',
                    ]"
                  >{{ person.name }}</span>
                  <span
                    v-if="selected"
                    class="absolute inset-y-0 left-0 flex items-center pl-3 text-amber-600"
                  >
                    <div class="i-hugeicons-check-20-solid" />
                  </span>
                </li>
              </ListboxOption>
            </ListboxOptions>
          </transition>
        </div>
      </Listbox>

    </div>

    <template #code>
      <ListboxCode />
    </template>

  </DocsPlayground>
</div>
</template>
