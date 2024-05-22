<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, defineProps, defineEmits, useSlots, defineOptions, withDefaults  } from 'vue'
import Utils from '@/modules/Utils'
import $Utils from '@/modules/Stepper.Utils'
import Step from './Step.vue'
import StepperRoot from './StepperRoot.vue'

defineOptions({
  name: 'Stepper',
})

interface Value {
  value: number
  id?: string
}

interface Props {
  value?: Value
  steps?: number
  linear?: boolean
  persist?: boolean
  storekeeper?: string
  withDivider?: boolean
  rootComponent: object
  debug?: boolean
}

const props = withDefaults(defineProps<Props>(), {
   value: {
    value: 1,
    id: undefined
  },
  steps: 0,
  linear: true,
  persist: false,
  storekeeper: 'localStorage',
  withDivider: true,
  rootComponent: () => StepperRoot,
  debug: false,
})

const emit = defineEmits<{
  (e: 'input', value: Value): void
  (e: 'reset'): void
}>()

const namespace = { kebab: 'v-stepper', capitalize: 'V-Stepper' }
const stepsArr = ref(getStepsArr())
const index = ref(toIndex(props.value))

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

watch(
  () => props,
  ({ value }) => {
    index.value = toIndex(value)
    if (props.persist) {
      setStorage()
    }
  },
  { immediate: true }
)

watch(
  props.value,
  (index) => {
    emitValue(toValue(index))
  },
  { immediate: true }
)

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

function toValue(index: number) {
  return index + 1
}

function toIndex(value: number = 0) {
  return value - 1
}

function doesStepExist(index: number) {
  return !!stepsArr.value[index]
}

function handleChange() {
  changeStep.apply(this, arguments)
}

function changeStep(index: number) {
  const value = getValue()
  const isNext = index === index.value + 1
  const isPrevious = index === index.value - 1
  const oldIndex = toIndex(value)

  if (props.linear) {
    if (isNext || isPrevious) {
      setStep(index, 'active', true)
      setStep(index, 'visited', false)
      setStep(index, 'disabled', false)
      setStep(oldIndex, 'active', false)
      setStep(oldIndex, 'visited', true)

      stepsArr.value.forEach(step => {
        if (step.index > index) {
          setStep(step.index, 'disabled', true)
        }
      })

      emitValue(toValue(index))
    }
  } else {
    setStep(oldIndex, 'visited', true)
    emitValue(toValue(index))
  }
}

function getValue() {
  return props.value
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
  const index = index.value + offset
  if (doesStepExist(index)) {
    handleChange(index)
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

function setStep(index: number, prop: string, value: any) {
  stepsArr.value[index][prop] = value
}

function setStorage() {
  const { index, stepsArr } = this
  window[props.storekeeper].setItem(id.value, JSON.stringify({ index: index.value, stepsArr: stepsArr.value }))
}

function getStorage() {
  return JSON.parse(window[props.storekeeper].getItem(id.value) || 'null')
}

function emitValue(value: number) {
  emit('input', { id: id.value, value, queries: queries.value })
}
</script>
<template>
  <div class="v-stepper">
    <component :is="rootComponent">
      <v-step
        v-for="(step, $index) in stepsArr"
        :name="id"
        :key="$index"
        :debug="debug"
        :index="$index"
        @change="handleChange"
        :visited="step.visited"
        :disabled="step.disabled"
        :with-divider="withDivider"
        :active="step.index === toIndex(value.value)">

        Proxy slot ("index-root")
        <template
          v-if="withSlot(getSlotName('index-root', $index + 1))"
          v-slot:index-root="scope">
          <!-- Lift slot ("index-root") -->
          <slot :name="getSlotName('index-root', scope.displayIndex)" v-bind="scope"></slot>
        </template>

        <!-- Proxy slot ("index") -->
        <template
          v-if="withoutSlot(getSlotName('index-root', $index + 1))"
          v-slot:index="scope">
          <!-- Lift slot ("index") -->
          <slot :name="getSlotName('index', scope.displayIndex)" v-bind="scope">
            {{ scope.displayIndex }}
          </slot>
        </template>

        <!-- Proxy slot ("default") -->
        <template v-slot="scope">
          <!-- Lift slot ("default") -->
          <slot :name="getSlotName('', scope.displayIndex)" v-bind="scope"></slot>
        </template>
      </v-step>
    </component>
  </div>
</template>
