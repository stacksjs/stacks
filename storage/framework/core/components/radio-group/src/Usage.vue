<script lang="ts" setup>
import { ref } from 'vue'
import { useCopyCode } from './composables/useCopyCode'

const code = `<!-- App.vue -->
<script lang="ts" setup>
import { ref } from 'vue'

import {
  RadioGroup,
  RadioGroupLabel,
  RadioGroupOption,
} from '@stacksjs/radio-group'

const plans = [
  {
    name: 'Startup', ram: '12GB', cpus: '6 CPUs', disk: '160 GB SSD disk',
  },
  {
    name: 'Business', ram: '16GB', cpus: '8 CPUs', disk: '512 GB SSD disk',
  },
  {
    name: 'Enterprise', ram: '32GB', cpus: '12 CPUs', disk: '1024 GB SSD disk',
  },
]

const selected = ref(plans[0])
<\/script>

<template>
  <RadioGroup v-model="selected">
    <RadioGroupLabel class="sr-only">Server size</RadioGroupLabel>
    <div class="space-y-2">
      <RadioGroupOption
        as="template"
        v-for="plan in plans"
        :key="plan.name"
        :value="plan"
        v-slot="{ active, checked }"
      >
        <div
          :class="[
            active
              ? 'ring-2 ring-white/60 ring-offset-2 ring-offset-sky-300'
              : '',
            checked ? 'bg-sky-900/75 text-white ' : 'bg-white ',
          ]"
          class="relative flex cursor-pointer rounded-lg px-5 py-4 shadow-md focus:outline-none"
        >
          <div class="flex w-full items-center justify-between">
            <div class="flex items-center">
              <div class="text-sm">
                <RadioGroupLabel
                  as="p"
                  :class="checked ? 'text-white' : 'text-gray-900'"
                  class="font-medium"
                >
                  {{ plan.name }}
                </RadioGroupLabel>
                <RadioGroupDescription
                  as="span"
                  :class="checked ? 'text-sky-100' : 'text-gray-500'"
                  class="inline"
                >
                  <span> {{ plan.ram }}/{{ plan.cpus }}</span>
                  <span aria-hidden="true"> &middot; </span>
                  <span>{{ plan.disk }}</span>
                </RadioGroupDescription>
              </div>
            </div>
            <div v-show="checked" class="shrink-0 text-white">
              <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="12"
                  fill="#fff"
                  fill-opacity="0.2"
                />
                <path
                  d="M7 13l3 3 7-7"
                  stroke="#fff"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </RadioGroupOption>
    </div>
  </RadioGroup>
</template>
`

const showCheckIcon = ref(false)

async function handleCopyCode() {
  await useCopyCode({ code, checkIconRef: showCheckIcon })
}
</script>

<template>
  <div class="usage">
    <h1 class="my-2 text-lg font-semibold">
      Usage
    </h1>
    <p class="my-3 text-base">
      Radio Groups are built using the <code>RadioGroup</code>, <code>RadioGroupLabel</code>, and <code>RadioGroupOption</code> components.
      <br><br>
      Clicking an option will select it, and when the Radio Group is focused, the arrow keys will change the selected option.
    </p>
    <div class="code-block group relative">
      <Highlight
        class-name="rounded-md text-xs"
        language="xml"
        :autodetect="false"
        :code="code"
      />
      <button
        aria-label="Copy code"
        title="Copy code"
        class="btn-border absolute right-2 top-2 hidden p-1 group-hover:block"
        @click="handleCopyCode"
      >
        <div v-if="showCheckIcon" class="i-hugeicons:checkmark-circle-01 text-gray-500" />
        <div v-else class="i-hugeicons:copy-01 text-gray-500" />
      </button>
    </div>
    <p class="my-3 text-base">
      To learn more, read this part of the documentation, as much of <a class="text-blue-500" href="https://headlessui.com/v1/vue/radio" target="_blank">Headless UI</a> is proxied.
    </p>
  </div>
</template>

<style scoped>
code {
  font-weight: 600;
}
</style>
