<script lang="ts" setup>
import { Modal } from '@stacksjs/modal'
import { Stepper } from '@stacksjs/stepper'
import { ref } from 'vue'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (event: 'close'): void
}>()

const step = ref(1)
const steps = ref(4)
const stepperRef = ref(null)

function handleClose() {
  emit('close')
}
</script>

<template>
  <div class="flex">
    <Modal close-button :visible="props.visible" @close="handleClose">
      <div class="mt-4 w-full flex flex-col">
        <Stepper ref="stepperRef" v-model="step" :steps="steps" />

        <div class="flex-center my-4">
          <div v-if="step === 1" class="w-full text-center">
            <h1>STEP 1</h1>
          </div>

          <div v-if="step === 2" class="w-full text-center">
            <h1>STEP 2</h1>
          </div>

          <div v-if="step === 3" class="w-full text-center">
            <h1>STEP 3</h1>
          </div>

          <div v-if="step === 4" class="w-full text-center">
            <h1>STEP 4</h1>
          </div>
        </div>

        <div class="flex-center">
          <button class="btn-border mx-2" @click="stepperRef?.previous()">
            Previous
          </button>
          <button class="btn-border mx-2" @click="stepperRef?.reset()">
            Reset
          </button>
          <button class="btn-border mx-2" @click="stepperRef?.next()">
            Next
          </button>
        </div>
      </div>

      <!-- <div class="flex-center w-full">

      </div>
      <div class="flex-center" v-if="step === 1">
        <h1>Step 1</h1>
      </div>
      <div class="flex-center" v-if="step === 2">
        <h1>Step 2</h1>
      </div>
      <div class="flex-center" v-if="step === 3">
        <h1>Step 3</h1>
      </div> -->
    </Modal>
  </div>
</template>

<style scoped>
/* @unocss-placeholder */
</style>
