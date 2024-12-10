<script lang="ts">
import { computed, ref, watchEffect } from 'vue'
</script>

<script lang="ts" setup>
import type { CommandInputEmits, CommandInputProps } from './types'
import { useCommandState } from './useCommandState'

defineOptions({
  name: 'Command.Input',
})

defineProps<CommandInputProps>()

const emit = defineEmits<CommandInputEmits>()

const inputRef = ref<HTMLInputElement | null>(null)
const { search } = useCommandState()
const localSearch = computed(() => search.value)

function handleInput(e: Event) {
  const event = e as InputEvent
  const input = e.target as HTMLInputElement
  search.value = input?.value
  emit('input', event)
  emit('update:value', search.value)
}

watchEffect(() => {
  inputRef.value?.focus()
})
</script>

<template>
  <input
    ref="inputRef"
    command-input=""
    auto-focus
    auto-complete="off"
    auto-correct="off"
    :spell-check="false"
    aria-autocomplete="list"
    role="combobox"
    :aria-expanded="true"
    :placeholder="placeholder"
    :value="localSearch"
    @input="handleInput"
  >
</template>
