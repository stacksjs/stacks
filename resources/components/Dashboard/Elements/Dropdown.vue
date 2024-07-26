<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  label: string
  open?: boolean
  elements: {
    to: string
    label: string
  }[]
}>()

const isOpen = ref(props.open)
const list = ref<HTMLUListElement>()

watch(isOpen, () => {
  const elements = (list.value?.children ?? []) as HTMLLIElement[]

  elements.forEach((element, index) => {
    if (!isOpen.value) element.style.display = 'none'

    setTimeout(() => {
      element.style.display = 'block'
    }, 100 * index)
  })
})
</script>

<template>
  <div class="flex flex-col gap-y-2 overflow-hidden">
    <a @click="isOpen = !isOpen" class="flex items-center justify-between gap-x-2">
      <span class="text-sm font-medium text-dark">
        {{ props.label }}
      </span>

      <span v-if="isOpen" :class="[
        'i-heroicons-minus',
      ]" />
      <span v-else :class="[
        'i-heroicons-chevron-down',
      ]" />
    </a>

    <ul ref="list">
      <li v-for="element in props.elements" :key="element.to">
        <router-link
          :to="element.to"
          class="block"
        >
          {{ element.label }}
        </router-link>
      </li>
    </ul>
  </div>
</template>
