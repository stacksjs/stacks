```vue
<script lang="ts" setup>
import { ref } from '@stacksjs/stx'
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from '@stacksjs/listbox'

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
  <div class="max-w-4xl">
    <div class="items-center mx-auto my-12 space-y-4 h-[150px] w-[300px] w-3/5">
      <Listbox v-model="selectedPerson">
        <div class="relative mt-1">
          <ListboxButton
            class="relative pl-3 pr-10 py-2 w-full text-left sm:text-sm bg-white rounded-lg focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-orange-300 focus-visible:ring-white/75 focus:outline-none shadow-md cursor-default"
          >
            <span class="block truncate">{{ selectedPerson.name }}</span>
            <span
              class="flex absolute inset-y-0 right-0 items-center pr-2 pointer-events-none"
            >
              <div class="i-hugeicons-chevron-up-down-20-solid" />
            </span>
          </ListboxButton>

          <transition
            leave-active-class="duration-100 ease-in transition"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <ListboxOptions
              class="absolute overflow-auto mt-1 py-1 max-h-60 w-full text-base sm:text-sm bg-white outline-none ring-1 ring-black/5 rounded-md focus:outline-none shadow-lg"
            >
              <ListboxOption
                v-for="person in people"
                class="-ml-4 list-none"
                v-slot="{ active, selected }"
                :key="person.name"
                :value="person"
                as="template"
              >
                <li
                  class="relative pl-10 pr-4 py-2 cursor-default select-none" :class="[
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
                    class="flex absolute inset-y-0 left-0 items-center pl-3 text-amber-600"
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
  </div>
</template>

```
