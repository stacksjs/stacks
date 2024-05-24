<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, defineProps, defineEmits, useSlots, defineOptions, withDefaults, defineExpose  } from 'vue'
import type { StepperProps, OptionParams, StepperEmitValue, StepperValue } from '../types'
import Step from './Step.vue';

defineOptions({
  name: 'Stepper',
  inheritAttrs: false
})

const props = withDefaults(defineProps<StepperProps>(), {
  value: {
    value: 2,
    id: undefined
  },
  steps: 0,
  linear: true,
  persist: false,
  storekeeper: 'localStorage',
  withDivider: true,
  debug: false,
})

const emit = defineEmits(['input', 'reset'])

const namespace = { kebab: 'stepper', capitalize: 'Stepper' }
const stepsArr = ref(getStepsArr())
const index = ref(toIndex(props.value.value))
const slots = useSlots()
const id = computed(() => `${namespace.kebab}-${Math.random().toString(36).substr(2, 9)}`)
const lastIndex = computed(() => stepsArr.value.length - 1)
const random = computed(() => props.linear === false)

const queries = computed(() => {
  const { steps } = props

  return Array.from(Array(steps)).reduce((queries, step, $index) => {
    const query = `isStep${$index + 1}`
    queries[query] = index.value === $index
    return queries
  }, {} as Record<string, boolean>)
})


watch(() => props.value, (newValue) => {
  index.value = toIndex(newValue.value);
  if (props.persist) {
    setStorage();
  }
});

watch(index, (newValue) => {
  emitValue(toValue(newValue));
}, { immediate: true });


const scope = computed(() => ({
  index: index.value,
  displayIndex: index.value + 1,
  defaultSlot: slots.default ? slots.default() : undefined,
  flags: {
    isActive: true,
    isVisited: false,
    isDisabled: false,
  },
}))

const classes = computed(() => ({
  'is-active': true,
  'is-visited': false,
  'is-disabled': false,
}))

onMounted(() => {
  if (props.persist) {
    const storage = getStorage()
    if (storage) {
      stepsArr.value = storage.stepsArr
      index.value = storage.index
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
  return !withoutSlot(name);
}

function withoutSlot(name: string): boolean {
  const noSlot = !slots[name] || (slots[name] && !slots[name].length);
  const noScopedSlot = slots.noScopedSlot && !slots.noScopedSlot[name];
  return noSlot && noScopedSlot;
}

function toValue(index: number) {
  return index + 1
}

function toIndex(value: number = 0) {
  return value - 1
}

function doesStepExist(index: number) {
  return !!stepsArr.value[index]
}

function handleChange(stepIndex: number) {
  const isNext = stepIndex === index.value + 1
  const isPrevious = stepIndex === index.value - 1
  const oldIndex = toIndex(props.value.value)

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
  const stepIndex = index.value + offset
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
  index.value = 0
  emit('reset')
}

function setStep(stepIndex: number, prop: string, value: any) {
  stepsArr.value[stepIndex][prop] = value
}

function setStorage() {
  window[props.storekeeper].setItem(id.value, JSON.stringify({ index: index.value, stepsArr: stepsArr.value }))
}

function getStorage() {
  return JSON.parse(window[props.storekeeper].getItem(id.value) || 'null')
}

function emitValue(value: number) {
  emit('input', { id: id.value, value, queries: queries.value })
}

defineExpose({
  next,
  previous,
  reset
})

</script>
<template>
  <div class="v-stepper">
    <stepper-root>
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
        :active="step.index === toIndex(value.value)"
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
    </stepper-root>
  </div>
</template>
