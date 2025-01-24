<script setup lang="ts">
const props = defineProps<{
  className: string
  feature: {
    name: string
    summary: string
    description: string
    image: string
    icon: any
  }
  isActive: boolean
}>()
</script>

<template>
  <div :class="[props.className, !props.isActive && 'opacity-75 hover:opacity-100']">
    <div class="w-9 rounded-lg" :class="[props.isActive ? 'bg-blue-600' : 'bg-slate-500']">
      <svg aria-hidden="true" class="h-9 w-9" fill="none">
        <!-- feature.icon -->
      </svg>
    </div>
    <h3 class="mt-6 text-sm font-medium" :class="[props.isActive ? 'text-blue-600' : 'text-slate-600']">
      {{ props.feature.name }}
    </h3>
    <p class="font-display mt-2 text-xl text-slate-900">
      {{ props.feature.summary }}
    </p>
    <p class="mt-4 text-sm text-slate-600">
      {{ props.feature.description }}
    </p>
  </div>
</template>
