<script lang="ts" setup>
import {
  TransitionRoot,
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions
} from '@headlessui/vue'

import { computed, ref } from 'vue'
import type { Ref } from 'vue'

interface Person {
  id: number
  name: string
}

const people = ref<Person[]>([
  { id: 1, name: 'Chris Breuer' },
  { id: 2, name: 'Avery Hill' },
  { id: 3, name: 'Glenn Michael' },
  { id: 4, name: 'Michael Vincent' },
  { id: 5, name: 'Blake Ayer' }
])

const selected = ref<Person | null>(null)
const query = ref<string>('')
const filteredPeople = computed(() =>{
  return  query.value === ''
    ? people.value
    : people.value.filter((person: Person) =>
        person.name
          .toLowerCase()
          .replace(/\s+/g, '')
          .includes(query.value.toLowerCase().replace(/\s+/g, '')),
      )
}) as Ref<Person[]>
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <div class="dropdownWrapper">
      <div class="toast" />
      <div class="toast" />
      <div class="toast" />
    </div>
    <h1 class="text-neon mb-3 text-5xl font-bold -mt-5">
      stacks/combobox
    </h1>
    <p class="mb-3 mt-0 text-lg">
      An opinionated combobox component for Stacks.
    </p>
    <div class="flex gap-2">
      <div class="relative z-20 mr-auto inline-block flex text-left">
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
                <div class="i-hugeicons-chevron-up-down-20-solid" />
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
                  v-if="filteredPeople.length === 0 && query !== ''"
                  class="relative cursor-default select-none px-4 py-2 text-gray-700"
                >
                  Nothing found.
                </div>

                <ComboboxOption
                  v-for="person in filteredPeople"
                  :key="person.id"
                  v-slot="{ selected, active }"
                  as="template"
                  :value="person"
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
                      {{ person.name }}
                    </span>
                    <span
                      v-if="selected"
                      class="absolute inset-y-0 left-0 flex items-center pl-3"
                      :class="{ 'text-white': active, 'text-teal-600': !active }"
                    >
                      <div class="i-hugeicons:checkmark-circle-01" />
                    </span>
                  </li>
                </ComboboxOption>
              </ComboboxOptions>
            </TransitionRoot>
          </div>
        </Combobox>
      </div>

      <a
        class="button btn-secondary"
        href="https://github.com/stacksjs/stacks/tree/main/storage/framework/core/components/combobox"
        target="_blank"
      >
        GitHub
      </a>
    </div>
  </div>
</template>

<style scoped>
.dropdownWrapper {
  display: flex;
  flex-direction: column;
  margin: 0 auto;
  height: 100px;
  width: 400px;
  position: relative;
  -webkit-mask-image: linear-gradient(to top, transparent 0%, black 35%);
  mask-image: linear-gradient(to top, transparent 0%, black 35%);
  opacity: 1;
}

.toast {
  width: 356px;
  height: 40px;
  background: #ffffff;
  box-shadow: 0 4px 12px #0000001a;
  border: 1px solid #f5f5f5;
  border-radius: 6px;
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
}

.toast:nth-child(1) {
  transform: translateY(-60%) translateX(-50%) scale(0.9);
}

.toast:nth-child(2) {
  transform: translateY(-30%) translateX(-50%) scale(0.95);
}

.button {
  height: 40px;
  border-radius: 6px;
  border: none;
  padding: 0 30px;
  font-weight: 600;
  flex-shrink: 0;
  font-family: inherit;
  box-shadow: 0px 0px 0px 1px rgba(0, 0, 0, 0.06),
    0px 1px 0px 0px rgba(0, 0, 0, 0.08), 0px 2px 2px 0px rgba(0, 0, 0, 0.04),
    0px 3px 3px 0px rgba(0, 0, 0, 0.02), 0px 4px 4px 0px rgba(0, 0, 0, 0.01);
  position: relative;
  overflow: hidden;
  cursor: pointer;
  text-decoration: none;
  color: hsl(0, 0%, 9%);
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  transition: box-shadow 200ms, background 200ms;
}

.btn-secondary {
  background: linear-gradient(
    156deg,
    rgba(255, 255, 255, 1) 0%,
    rgba(240, 240, 240, 1) 100%
  );
}

.button:focus-visible {
  outline: none;
  box-shadow: 0px 0px 0px 1px rgba(0, 0, 0, 0.06),
    0px 1px 0px 0px rgba(0, 0, 0, 0.08), 0px 2px 2px 0px rgba(0, 0, 0, 0.04),
    0px 3px 3px 0px rgba(0, 0, 0, 0.02), 0px 4px 4px 0px rgba(0, 0, 0, 0.01),
    0 0 0 2px rgba(0, 0, 0, 0.15);
}

.button:after {
  content: '';
  position: absolute;
  top: 100%;
  background: blue;
  left: 0;
  width: 100%;
  height: 35%;
  background: linear-gradient(
    to top,
    hsl(0, 0%, 91%) 0%,
    hsla(0, 0%, 91%, 0.987) 8.1%,
    hsla(0, 0%, 91%, 0.951) 15.5%,
    hsla(0, 0%, 91%, 0.896) 22.5%,
    hsla(0, 0%, 91%, 0.825) 29%,
    hsla(0, 0%, 91%, 0.741) 35.3%,
    hsla(0, 0%, 91%, 0.648) 41.2%,
    hsla(0, 0%, 91%, 0.55) 47.1%,
    hsla(0, 0%, 91%, 0.45) 52.9%,
    hsla(0, 0%, 91%, 0.352) 58.8%,
    hsla(0, 0%, 91%, 0.259) 64.7%,
    hsla(0, 0%, 91%, 0.175) 71%,
    hsla(0, 0%, 91%, 0.104) 77.5%,
    hsla(0, 0%, 91%, 0.049) 84.5%,
    hsla(0, 0%, 91%, 0.013) 91.9%,
    hsla(0, 0%, 91%, 0) 100%
  );
  opacity: 0.6;
  transition: transform 200ms;
}

.btn-secondary:hover:after {
  transform: translateY(-100%);
}

@media (max-width: 600px) {
  .dropdownWrapper {
    width: 100%;
  }
}
</style>
