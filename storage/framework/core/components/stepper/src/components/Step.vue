<script setup lang="ts">
import { computed, onMounted, useSlots } from 'vue'

defineOptions({
  name: 'Step',
})

const props = defineProps<Props>()

const emit = defineEmits<(e: 'change', index: number) => void>()

interface Props {
  index: number
  name: string
  active: boolean
  visited: boolean
  disabled: boolean
  withDivider: boolean
  debug: boolean
  isLastStep: boolean
}

onMounted(() => {})

const namespace = { kebab: 'step', capitalize: 'Step' }

const id = computed(() => `${namespace.kebab}-${props.index}`)
const displayIndex = computed(() => props.index + 1)
const computedName = computed(() => props.name || id.value)

const slots = useSlots()

const defaultSlot = computed(() => (slots.default ? slots.default() : undefined))

const flags = computed(() => ({
  isActive: props.active,
  isVisited: props.visited,
  isDisabled: props.disabled,
}))

const scope = computed(() => ({
  index: props.index,
  displayIndex: displayIndex.value,
  defaultSlot: defaultSlot.value,
  flags: flags.value,
}))

const classes = computed(() => ({
  'is-active': props.active,
  'is-visited': props.visited,
  'is-disabled': props.disabled,
}))

const indexClasses = computed(() => {
  const defaultClass = ' '
  const additionalClass = props.active ? 'text-blue-500 bg-blue-500' : 'text-gray-500 bg-gray-300'

  return defaultClass + additionalClass
})

function handleChange() {
  emit('change', props.index)
}
</script>

<template>
  <div class="step box-border flex-1 opacity-55 transition-opacity duration-700" :class="[classes]">
    <input
      v-show="debug"
      :id="id"
      class="input"
      type="radio"
      :checked="active"
      :name="computedName"
      @change="handleChange"
    >
    <label class="label flex flex-row items-center" :for="id">
      <slot name="index-root" v-bind="scope">
        <span
          class="mr-2 h-14 w-14 flex flex-shrink-0 items-center justify-center border border-gray-200 rounded-full text-xl text-white" :class="[
            props.active ? 'text-blue-500 bg-blue-500' : 'text-gray-500 bg-gray-300',
          ]"
        >
          <slot name="index" v-bind="scope">
            {{ scope.displayIndex }}
          </slot>
        </span>
      </slot>
      <span v-if="defaultSlot" class="title text-white">
        <slot v-bind="scope" />
      </span>
      <span v-if="withDivider && !isLastStep" class="ml-2 w-full border-b border-gray shadow-md" />
    </label>
  </div>
</template>

<style>
.step:hover:not(.is-disabled) {
  opacity: 0.85;
}

.step *,
.step *::before,
.step *::after {
  box-sizing: inherit;
}

.step.is-active,
.step.is-visited {
  cursor: pointer;
}

.step.is-active .label {
  cursor: pointer;
}

.step.is-active {
  opacity: 1;
}

.step.is-visited .index {
  background-color: #ffffff;
}

/* Media query for small screens */
@media (min-width: 640px) {
  .step:not(:last-child) {
    margin-right: 0.5rem; /* Assuming mr-2 maps to 0.5rem */
  }
}
@unocss-placeholder
</style>
