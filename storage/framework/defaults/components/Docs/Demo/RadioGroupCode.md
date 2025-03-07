```vue
<script lang="ts" setup>
import { ref } from 'vue'
import { RadioGroup, RadioGroupLabel, RadioGroupOption, RadioGroupDescription } from '@stacksjs/radio-group'

const plans = [
  {
    name: 'Startup',
    ram: '12GB',
    cpus: '6 CPUs',
    disk: '160 GB SSD disk',
  },
  {
    name: 'Business',
    ram: '16GB',
    cpus: '8 CPUs',
    disk: '512 GB SSD disk',
  },
  {
    name: 'Enterprise',
    ram: '32GB',
    cpus: '12 CPUs',
    disk: '1024 GB SSD disk',
  },
]

const selected = ref(plans[0])
</script>

<template>
  <RadioGroup v-model="selected">
    <RadioGroupLabel class="sr-only">
      Server size
    </RadioGroupLabel>
    <div class="space-y-2">
      <RadioGroupOption
        v-for="plan in plans"
        :key="plan.name"
        v-slot="{ active, checked }"
        as="template"
        :value="plan"
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
          <div class="w-full flex items-center justify-between">
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

```
