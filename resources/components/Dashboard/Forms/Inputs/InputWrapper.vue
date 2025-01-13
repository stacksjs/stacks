<script setup lang="ts">
interface Props {
  label?: string,
  errorMessage?: string,
}

const props = defineProps<Props>()

const { label = '', errorMessage = '' } = toRefs(props)
</script>

<template>
  <div>
    <label v-if="label" for="email" class="block text-sm/6 font-medium text-gray-900">{{label}}</label>
    <slot />
    <p class="mt-2 text-sm text-red-600" id="email-error">{{errorMessage}}</p>
  </div>
</template>

