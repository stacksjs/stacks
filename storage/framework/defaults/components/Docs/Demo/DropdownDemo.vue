<script lang="ts" setup>
import { ref } from 'vue'
import { Dropdown, DropdownButton, DropdownItem, DropdownItems } from '@stacksjs/dropdown'
import DocsPlayground from './DocsPlayground.vue'
import DropdownCode from './DropdownCode.md'

interface MenuItem {
  icon?: string
  label?: string
  action?: () => void
  divider?: boolean
  variant?: 'danger' | 'default'
}

type MenuSection = (MenuItem | { divider: true })[]

const menuItems: MenuSection = [
  { icon: 'i-hugeicons-pencil-20-solid', label: 'Edit', action: () => console.log('Edit clicked') },
  { icon: 'i-hugeicons-document-duplicate-20-solid', label: 'Duplicate', action: () => console.log('Duplicate clicked') },
  { divider: true },
  { icon: 'i-hugeicons-archive-box-20-solid', label: 'Archive', action: () => console.log('Archive clicked') },
  { icon: 'i-hugeicons-arrow-path-20-solid', label: 'Move', action: () => console.log('Move clicked') },
  { divider: true },
  { icon: 'i-hugeicons-trash-20-solid', label: 'Delete', variant: 'danger', action: () => console.log('Delete clicked') },
]

const isOpen = ref(false)

function groupMenuItems(items: MenuSection): MenuItem[][] {
  return items.reduce((acc: MenuItem[][], item) => {
    if ('divider' in item && item.divider && acc.length > 0) {
      acc.push([])
    } else if (!('divider' in item) || !item.divider) {
      if (acc.length === 0) acc.push([])
      acc[acc.length - 1].push(item as MenuItem)
    }
    return acc
  }, [])
}
</script>

<template>
  <div class="max-w-4xl">
    <DocsPlayground>
      <div class="space-y-4 mb-12 flex flex-col items-center justify-center items-center h-[200px]">
        <Dropdown v-model="isOpen" as="div" class="relative inline-block text-left">
          <DropdownButton
            class="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200"
          >
            Options
            <div
              class="i-hugeicons-chevron-down-20-solid w-5 h-5 transition-transform duration-200"
              :class="{ 'rotate-180': isOpen }"
            />
          </DropdownButton>

          <transition
            enter-active-class="transition duration-100 ease-out"
            enter-from-class="transform scale-95 opacity-0"
            enter-to-class="transform scale-100 opacity-100"
            leave-active-class="transition duration-75 ease-in"
            leave-from-class="transform scale-100 opacity-100"
            leave-to-class="transform scale-95 opacity-0"
          >
            <DropdownItems
              class="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 rounded-lg bg-white shadow-lg ring-1 ring-black/5 focus:outline-none"
            >
              <div
                v-for="(section, index) in groupMenuItems(menuItems)"
                :key="index"
                class="p-1"
              >
                <DropdownItem
                  v-for="(item, itemIndex) in section"
                  :key="itemIndex"
                  v-slot="{ active }"
                  @click="item.action?.()"
                >
                  <button
                    type="button"
                    class="group relative flex w-full items-center rounded-md px-2 py-2 text-sm outline-none transition-colors"
                    :class="[
                      active
                        ? item.variant === 'danger'
                          ? 'bg-red-500 text-white'
                          : 'bg-indigo-500 text-white'
                        : item.variant === 'danger'
                          ? 'text-red-600 hover:bg-red-50'
                          : 'text-gray-700 hover:bg-gray-50',
                    ]"
                  >
                    <div
                      v-if="item.icon"
                      :class="[
                        item.icon,
                        'mr-2 h-5 w-5',
                        active
                          ? 'text-white'
                          : item.variant === 'danger'
                            ? 'text-red-600'
                            : 'text-gray-500 group-hover:text-gray-700'
                      ]"
                    />
                    {{ item.label }}
                  </button>
                </DropdownItem>
              </div>
            </DropdownItems>
          </transition>
        </Dropdown>
      </div>

      <template #code>
        <DropdownCode />
      </template>

    </DocsPlayground>
  </div>
</template>

<style>
.rotate-180 {
  transform: rotate(180deg);
}
</style>
