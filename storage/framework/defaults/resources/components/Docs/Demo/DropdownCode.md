```vue
<script lang="ts" setup>
import { ref } from '@stacksjs/stx'
import { Dropdown, DropdownButton, DropdownItem, DropdownItems } from '@stacksjs/dropdown'

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
  <Dropdown v-model="isOpen" as="div" class="inline-block relative text-left">
    <DropdownButton
      class="inline-flex gap-2 items-center justify-center px-4 py-2.5 font-medium text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 shadow-sm duration-200 transition-all"
    >
      Options
      <div
        class="h-5 w-5 duration-200 transition-transform i-hugeicons-chevron-down-20-solid"
        :class="'rotate-180': { } isOpen"
      />
    </DropdownButton>

    <transition
      enter-active-class="duration-100 ease-out transition"
      enter-from-class="opacity-0 scale-95 transform"
      enter-to-class="opacity-100 scale-100 transform"
      leave-active-class="duration-75 ease-in transition"
      leave-from-class="opacity-100 scale-100 transform"
      leave-to-class="opacity-0 scale-95 transform"
    >
      <DropdownItems
        class="absolute right-0 mt-2 w-56 bg-white divide-gray-100 divide-y ring-1 ring-black/5 rounded-lg focus:outline-none shadow-lg origin-top-right"
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
              class="flex relative items-center px-2 py-2 w-full text-sm outline-none rounded-md transition-colors group"
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
</template>

```
