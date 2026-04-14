```vue

<script lang="ts" setup>
import { Popover, PopoverButton, PopoverPanel } from '@stacksjs/popover'

const solutions = [
  {
    name: 'Insights',
    description: 'Measure actions your users take',
    href: '##',
    icon: `
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="48" height="48" rx="8" fill="#FFEDD5" />
        <path
          d="M24 11L35.2583 17.5V30.5L24 37L12.7417 30.5V17.5L24 11Z"
          stroke="#FB923C"
          stroke-width="2"
        />
        <path
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M16.7417 19.8094V28.1906L24 32.3812L31.2584 28.1906V19.8094L24 15.6188L16.7417 19.8094Z"
          stroke="#FDBA74"
          stroke-width="2"
        />
        <path
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M20.7417 22.1196V25.882L24 27.7632L27.2584 25.882V22.1196L24 20.2384L20.7417 22.1196Z"
          stroke="#FDBA74"
          stroke-width="2"
        />
      </svg>
    `,
  },
  {
    name: 'Automations',
    description: 'Create your own targeted content',
    href: '##',
    icon: `
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="48" height="48" rx="8" fill="#FFEDD5" />
        <path
          d="M28.0413 20L23.9998 13L19.9585 20M32.0828 27.0001L36.1242 34H28.0415M19.9585 34H11.8755L15.9171 27"
          stroke="#FB923C"
          stroke-width="2"
        />
        <path
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M18.804 30H29.1963L24.0001 21L18.804 30Z"
          stroke="#FDBA74"
          stroke-width="2"
        />
      </svg>
    `,
  },
  {
    name: 'Reports',
    description: 'Keep track of your growth',
    href: '##',
    icon: `
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="48" height="48" rx="8" fill="#FFEDD5" />
        <rect x="13" y="32" width="2" height="4" fill="#FDBA74" />
        <rect x="17" y="28" width="2" height="8" fill="#FDBA74" />
        <rect x="21" y="24" width="2" height="12" fill="#FDBA74" />
        <rect x="25" y="20" width="2" height="16" fill="#FDBA74" />
        <rect x="29" y="16" width="2" height="20" fill="#FB923C" />
        <rect x="33" y="12" width="2" height="24" fill="#FB923C" />
      </svg>
    `,
  },
]

</script>

<template>
  <Popover v-slot="{ open }" class="relative">
    <PopoverButton
      :class=": ? 'text-white' 'text-white/90' open"
      class="inline-flex gap-2 items-center justify-center px-4 py-2.5 font-medium text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 shadow-sm duration-200 transition-all group"
    >
      <span>Example</span>
      <div class="h-5 w-5 i-hugeicons-arrow-down-01" />
    </PopoverButton>

    <transition
      enter-active-class="duration-200 ease-out transition"
      enter-from-class="opacity-0 translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="duration-150 ease-in transition"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-1"
    >
      <PopoverPanel
        class="absolute left-1/2 z-50 mt-3 px-4 sm:px-0 max-w-sm w-screen transform -translate-x-1/2"
      >
        <div class="overflow-hidden ring-1 ring-black/5 rounded-lg shadow-lg">
          <div class="flex relative flex-col gap-8 lg:grid-cols-2 p-7 bg-white">
            <a
              v-for="item in solutions"
              :key="item.name"
              :href="item.href"
              class="flex items-center -m-3 p-2 hover:bg-gray-50 rounded-lg focus-visible:ring focus-visible:ring-orange-500/50 focus:outline-none duration-150 ease-in-out transition"
            >
              <div
                class="flex items-center justify-center shrink-0 h-10 w-10 sm:h-12 sm:w-12 text-white"
              >
                <div v-html="item.icon" />
              </div>
              <div class="ml-4">
                <p class="font-medium text-gray-900 text-sm">
                  {{ item.name }}
                </p>
                <p class="text-gray-500 text-sm">
                  {{ item.description }}
                </p>
              </div>
            </a>
          </div>
          <div class="p-4 bg-gray-50">
            <a
              href="##"
              class="flow-root px-2 py-2 hover:bg-gray-100 rounded-md focus-visible:ring focus-visible:ring-orange-500/50 focus:outline-none duration-150 ease-in-out transition"
            >
              <span class="flex items-center">
                <span class="font-medium text-gray-900 text-sm">
                  Documentation
                </span>
              </span>
              <span class="block text-gray-500 text-sm">
                Start integrating products and tools
              </span>
            </a>
          </div>
        </div>
      </PopoverPanel>
    </transition>
  </Popover>
</template>
```
