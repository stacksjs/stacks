<script setup lang="ts">
interface Props {
  keys?: string[]
}

const {
  keys,
} = defineProps<Props>()

const emit = defineEmits(['browseFilterValues'])

function browseFilter(key: string) {
  emit('browseFilterValues', key)
}
</script>

<template>
  <button
    v-for="(key, index) in keys"
    id="menu-item-0"
    :key="index"
    class="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark-hover:bg-gray-600 hover:bg-gray-100 group dark:text-gray-300"
    role="menuitem"
    @click="browseFilter(key)"
  >
    {{ displayKey(key) }}
  </button>
</template>
