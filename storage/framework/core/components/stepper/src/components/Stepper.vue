<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  useSlots,
  watch,
} from 'vue'
import type { OptionParams, StepperProps } from '../types'
import Step from './Step.vue'

defineOptions({
  name: 'Stepper',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<StepperProps>(), {
  stepperId: undefined,
  steps: 0,
  linear: true,
  persist: false,
  storekeeper: 'localStorage',
  withDivider: true,
  debug: false,
})

const modelValue = defineModel()

const emit = defineEmits(['reset'])

const namespace = { kebab: 'stepper', capitalize: 'Stepper' }
const stepsArr = ref(getStepsArr())
const currentIndex = ref(toIndex(modelValue.value))

const slots = useSlots()
const id = computed(() => `${namespace.kebab}-${Math.random().toString(36).substring(2, 9)}`)

watch(
  () => modelValue.value,
  (step) => {
    currentIndex.value = toIndex(step)
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
    } else {
      setStorage()
    }
  }
})

onBeforeUnmount(() => {
  if (props.persist) {
    window[props.storekeeper].removeItem(id.value)
  }
})

function getSlotName(suffix = '', displayIndex: string, options: Partial<OptionParams> = {}) {
  const defaults: OptionParams = { prefix: 'step' }
  options = Object.assign({}, defaults, options)
  const { prefix } = options
  const name = []

  if (Number.isNaN(displayIndex)) {
    throw new Error(`[Stepper.Utils.getSlotName warn]: Cannot generate name without a "displayIndex".`)
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
  const noScopedSlot = slots.noScopedSlot && !slots.noScopedSlot[name]
  return noSlot && noScopedSlot
}

function toValue(index: number) {
  return index + 1
}

function toIndex(value = 0) {
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
  } else {
    setStep(oldIndex, 'visited', true)
    emitValue(toValue(stepIndex))
  }
}
function getStepsArr() {
  return Array.from(Array(props.steps), (step, index) => {
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
    return { index, value, visited, disabled }
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

function setStep(stepIndex: number, prop: string, value: any) {
  stepsArr.value[stepIndex][prop] = value
}

function setStorage() {
  window[props.storekeeper].setItem(id.value, JSON.stringify({ index: currentIndex.value, stepsArr: stepsArr.value }))
}

function getStorage() {
  return JSON.parse(window[props.storekeeper].getItem(id.value) || 'null')
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
  <div class="flex w-full select-none box-border justify-between ">
    <step
      v-for="(step, $index) in stepsArr"
      :name="id"
      :key="$index"
      :debug="debug"
      :index="$index"
      @change="handleChange"
      :visited="step.visited"
      :disabled="step.disabled"
      :with-divider="withDivider"
      :active="step.index === toIndex(modelValue)"
      :isLastStep="steps === ($index + 1)"
    >
        <template
        v-slot:index-root="scope"
        v-if="withSlot(getSlotName('index-root', $index + 1))"
        >
        <slot :name="getSlotName('index-root', scope.displayIndex)" v-bind="scope"></slot>
      </template>

      <template
        v-if="withoutSlot(getSlotName('index-root', $index + 1))"
        v-slot:index="scope">
        <slot :name="getSlotName('index', scope.displayIndex)" v-bind="scope">
          {{ scope.displayIndex }}
        </slot>
      </template>

        <template v-slot:defaultSlot="scope" >
        <slot :name="getSlotName('', scope.displayIndex)" v-bind="scope">2</slot>
      </template>

    </step>
  </div>
</template>

<style scoped></style>
