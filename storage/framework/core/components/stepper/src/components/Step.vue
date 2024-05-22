
<script setup lang="ts">
import { computed, defineProps, defineEmits, useSlots, defineOptions  } from 'vue'
import Utils from '@/modules/Stepper.Utils'


defineOptions({
  name: 'Step',
})

interface Props {
  index: number
  name: string
  active: boolean
  visited: boolean
  disabled: boolean
  withDivider: boolean
  debug: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'change', index: number): void
}>()

const namespace = { kebab: 'v-step', capitalize: 'V-Step' }

const id = computed(() => `${namespace.kebab}-${props.index}`)
const displayIndex = computed(() => props.index + 1)
const computedName = computed(() => props.name || id.value)

const slots = useSlots()

const defaultSlot = computed(() => slots.default ? slots.default() : undefined)

const flags = computed(() => ({
  isActive: props.active,
  isVisited: props.visited,
  isDisabled: props.disabled
}))

const scope = computed(() => ({
  index: props.index,
  displayIndex: displayIndex.value,
  defaultSlot: defaultSlot.value,
  flags: flags.value
}))

const classes = computed(() => ({
  'is-active': props.active,
  'is-visited': props.visited,
  'is-disabled': props.disabled
}))

function handleChange() {
  emit('change', props.index)
}
</script>

<template>
  <div :class="['v-step', classes]">
    <input
      :id="id"
      class="input"
      type="radio"
      v-show="debug"
      :checked="active"
      :name="computedName"
      @change="handleChange"
    >
    <label class="label" :for="id">
      <slot name="index-root" v-bind="scope">
        <span class="index">
          <slot name="index" v-bind="scope">
            {{ scope.displayIndex }}
          </slot>
        </span>
      </slot>
      <span class="title" v-if="defaultSlot">
        <slot v-bind="scope"></slot>
      </span>
      <span class="divider" v-if="withDivider"></span>
    </label>
  </div>
</template>

<style scoped>
  .v-step {
    @apply flex-1 opacity-55 box-border transition-opacity duration-700;

    &:hover:not(.is-disabled) {
      @apply opacity-85;
    }

    *,
    *::before,
    *::after {
      box-sizing: inherit;
    }

    &.is-active,
    &.is-visited {
      .label {
        @apply cursor-pointer;
      }

      .index {
        @apply text-gray-600; /* Use a close color from UnoCSS color palette */
      }
    }

    &.is-active {
      @apply opacity-100;

      .title {
        color: #1e6b73; /* Custom color as lighten(#12525e, 30%) */
      }

      .label {
        .index {
          border-color: rgba(244, 244, 244, 0.2);
          background-color: #12525e;
        }
      }
    }

    &.is-visited {
      .index {
        @apply bg-white;
      }
    }

    @screen sm {
      &:not(:last-child) {
        @apply mr-2;
      }
    }
  }

  .label {
    @apply flex flex-row items-center;
  }

  .index {
    @apply w-14 h-14 flex flex-shrink-0 text-xl rounded-full mr-2 text-white items-center justify-center bg-transparent border border-gray-200;
  }

  .title {
    @apply text-white;
  }

  .divider {
    @apply w-full ml-2 border-b border-white shadow-md;
  }
</style>
