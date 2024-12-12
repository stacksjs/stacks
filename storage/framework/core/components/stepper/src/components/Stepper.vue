<script setup lang="ts">
import type { OptionParams, StepperProps } from '../types'
import { computed, onBeforeUnmount, onMounted, ref, useSlots, watch } from 'vue'
import Step from './Step.vue'

defineOptions({
  name: 'Stepper',
})

const props = withDefaults(defineProps<StepperProps>(), {
  id: undefined,
  steps: 0,
  linear: true,
  persist: false,
  storekeeper: 'localStorage',
  withDivider: true,
  debug: false,
})

const emit = defineEmits(['reset'])

interface StepItem {
  index: number
  value: number
  visited: boolean
  disabled: boolean
  active: boolean
}

const modelValue = defineModel<number | undefined>()
const namespace = { kebab: 'stepper', capitalize: 'Stepper' }
const stepsArr = ref<StepItem[]>(getStepsArr())
const currentIndex = ref(toIndex(modelValue.value))

const slots = useSlots()
const id = computed(() => `${namespace.kebab}-${props.id ?? Math.random().toString(36).substring(2, 9)}`)

watch(
  () => modelValue.value,
  (step: number | undefined) => {
    currentIndex.value = toIndex(step ?? 1)
    if (props.persist) {
      setStorage()
    }
  },
)

watch(
  currentIndex,
  (stepIndex) => {
    emitValue(toValue(stepIndex))
  },
  { immediate: true },
)

onMounted(() => {
  if (props.persist) {
    const storage = getStorage()
    if (storage) {
      stepsArr.value = storage.stepsArr
      currentIndex.value = storage.index
    }
    else {
      setStorage()
    }
  }
})

onBeforeUnmount(() => {
  if (props.persist) {
    window[props.storekeeper as 'localStorage' | 'sessionStorage'].removeItem(id.value)
  }
})

function getSlotName(suffix: string, displayIndex: string, options: Partial<OptionParams> = {}) {
  const defaults: OptionParams = { prefix: 'step' }
  options = Object.assign({}, defaults, options)
  const { prefix } = options
  const name = []

  if (Number.isNaN(displayIndex)) {
    throw new TypeError(`[Stepper.Utils.getSlotName warn]: Cannot generate name without a "displayIndex".`)
  }
  if (prefix) {
    name.push(prefix)
  }
  if (displayIndex) {
    name.push(displayIndex)
  }
  if (suffix) {
    name.push(suffix)
  }
  return name.join('-')
}

function withSlot(name: string) {
  return !withoutSlot(name)
}

function withoutSlot(name: string): boolean {
  const noSlot = !slots[name] || (slots[name] && !slots[name].length)

  const noScopeSlot = slots.noScopedSlot as any
  const hasNoScopeSlot = noScopeSlot && !noScopeSlot[name]

  return noSlot && hasNoScopeSlot
}

function toValue(index: number) {
  return index + 1
}

function toIndex(value: number | undefined = 0) {
  return value - 1
}

function doesStepExist(index: number) {
  return !!stepsArr.value[index]
}

function handleChange(stepIndex: number) {
  const isNext = stepIndex === currentIndex.value + 1
  const isPrevious = stepIndex === currentIndex.value - 1
  const oldIndex = toIndex(modelValue.value)

  if (props.linear) {
    if (isNext || isPrevious) {
      setStep(stepIndex, 'active', true)
      setStep(stepIndex, 'visited', false)
      setStep(stepIndex, 'disabled', false)
      setStep(oldIndex, 'active', false)
      setStep(oldIndex, 'visited', true)

      stepsArr.value.forEach((step) => {
        if (step.index > stepIndex) {
          setStep(step.index, 'disabled', true)
        }
      })

      emitValue(toValue(stepIndex))
    }
  }
  else {
    setStep(oldIndex, 'visited', true)
    emitValue(toValue(stepIndex))
  }
}
function getStepsArr(): StepItem[] {
  return Array.from({ length: props.steps }, (_, index) => {
    const isFirst = index === 0
    const isNext = index - 1 === 0
    let disabled = false
    if (props.linear) {
      if (!isFirst && !isNext) {
        disabled = true
      }
    }
    const visited = false
    const value = toValue(index)
    return { index, value, visited, disabled, active: false } as StepItem
  })
}

function offset(offset: number) {
  const stepIndex = currentIndex.value + offset
  if (doesStepExist(stepIndex)) {
    handleChange(stepIndex)
  }
}

function next() {
  offset(1)
}

function previous() {
  offset(-1)
}

function reset() {
  stepsArr.value = getStepsArr()
  currentIndex.value = 0
  emit('reset')
}

function setStep(stepIndex: number, prop: keyof StepItem, value: boolean) {
  const step = stepsArr.value[stepIndex]

  if (step) {
    (step[prop] as boolean) = value
  }
}

function setStorage() {
  window[props.storekeeper].setItem(id.value, JSON.stringify({ index: currentIndex.value, stepsArr: stepsArr.value }))
}

function getStorage() {
  const storage = JSON.parse(window[props.storekeeper].getItem(id.value) || 'null') as { index: number, stepsArr: Step[] }

  if (storage) {
    return storage
  }
  return null
}

function emitValue(value: number) {
  modelValue.value = value
}

defineExpose({
  next,
  previous,
  reset,
})
</script>

<template>
  <div class="w-full flex">
    <Step
      v-for="(step, $index) in stepsArr"
      :key="$index"
      :name="id"
      :debug="debug"
      :index="$index"
      :visited="step.visited"
      :disabled="step.disabled"
      :with-divider="withDivider"
      :active="step.index === toIndex(modelValue)"
      :is-last-step="steps === ($index + 1)"
      @change="handleChange"
    >
      <template
        v-if="withSlot(getSlotName('index-root', String($index + 1)))"
        #index-root="scope"
      >
        <slot :name="getSlotName('index-root', String(scope.displayIndex))" v-bind="scope" />
      </template>

      <template
        v-if="withoutSlot(getSlotName('index-root', String($index + 1)))"
        #index="scope"
      >
        <slot :name="getSlotName('index', String(scope.displayIndex))" v-bind="scope">
          {{ scope.displayIndex }}
        </slot>
      </template>

      <template #defaultSlot="scope">
        <slot :name="getSlotName('', String(scope.displayIndex))" v-bind="scope">
          2
        </slot>
      </template>
    </Step>
  </div>
</template>

<style scoped>
  /* @unocss-placeholder */
</style>
