<script lang="ts" setup>
import { Dropdown, DropdownButton, DropdownItem, DropdownItems } from './'
</script>

<template>
  <Dropdown as="div" class="relative z-10 inline-block text-left">
    <div>
      <DropdownButton
        class="btn-primary w-full inline-flex justify-center rounded-md px-4 py-2.5 text-sm text-white font-medium focus:outline-none focus-visible:ring-2"
      >
        Dropdown <div class="i-heroicons-chevron-down-20-solid ml-2 h-5 w-5" />
      </DropdownButton>
    </div>

    <transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <DropdownItems
        class="absolute right-0 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black/5 divide-y divide-gray-100 focus:outline-none"
      >
        <div class="px-1 py-1">
          <DropdownItem v-slot="{ active }">
            <button
              class="group w-full flex items-center rounded-md px-2 py-2 text-sm" :class="[
                active ? 'bg-violet-500 text-white' : 'text-gray-900',
              ]"
            >
              <div class="i-heroicons-pencil-20-solid mr-2 h-5 w-5" />
              Edit
            </button>
          </DropdownItem>
          <DropdownItem v-slot="{ active }">
            <button
              class="group w-full flex items-center rounded-md px-2 py-2 text-sm" :class="[
                active ? 'bg-violet-500 text-white' : 'text-gray-900',
              ]"
            >
              <div class="i-heroicons-document-duplicate-20-solid" />
              Duplicate
            </button>
          </DropdownItem>
        </div>
        <div class="px-1 py-1">
          <DropdownItem v-slot="{ active }">
            <button
              class="group w-full flex items-center rounded-md px-2 py-2 text-sm" :class="[
                active ? 'bg-violet-500 text-white' : 'text-gray-900',
              ]"
            >
              <div class="i-heroicons-archive-box-20-solid mr-2 h-5 w-5" />
              Archive
            </button>
          </DropdownItem>
          <DropdownItem v-slot="{ active }">
            <button
              class="group w-full flex items-center rounded-md px-2 py-2 text-sm" :class="[
                active ? 'bg-violet-500 text-white' : 'text-gray-900',
              ]"
            >
              <div class="i-heroicons-arrow-path-20-solid mr-2 h-5 w-5" />
              Move
            </button>
          </DropdownItem>
        </div>

        <div class="px-1 py-1">
          <DropdownItem v-slot="{ active }">
            <button
              class="group w-full flex items-center rounded-md px-2 py-2 text-sm" :class="[
                active ? 'bg-violet-500 text-white' : 'text-gray-900',
              ]"
            >
              <div class="i-heroicons-trash-20-solid mr-2 h-5 w-5" />
              Delete
            </button>
          </DropdownItem>
        </div>
      </DropdownItems>
    </transition>
  </Dropdown>
</template>
