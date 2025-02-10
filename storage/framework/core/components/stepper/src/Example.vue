<script lang="ts" setup>
import { ref } from 'vue'
import Stepper from './components/Stepper.vue'

const step = ref(1)
const steps = ref(4)
const stepperRef = ref(null)
</script>

<template>
  <section id="example">
    <h1 class="my-2 text-lg font-semibold">
      Example
    </h1>
    <p class="my-3 text-base">
      Here is the example of the Stepper component in action.
    </p>
    <div class="flex-center mt-10 w-full">
      <Stepper id="stepper-example" ref="stepperRef" v-model="step" :steps="steps" persist />
    </div>
    <div class="flex-center my-5 text-lg font-semibold">
      <div v-if="step === 1">
        <p>Welcome to Step 1: Initialization</p>
        <p>Here you will set up the initial parameters for your process.</p>
      </div>
      <div v-if="step === 2">
        <p>Step 2: Processing</p>
        <p>In this step, the main processing tasks are performed.</p>
      </div>
      <div v-if="step === 3">
        <p>Step 3: Review</p>
        <p>Review the results and make any necessary adjustments.</p>
      </div>
      <div v-if="step === 4">
        <p>Step 4: Completion</p>
        <p>Finalize the process and save your work.</p>
      </div>
    </div>

    <div class="flex-center my-4">
      <button class="btn-border mx-2" type="button" @click="stepperRef?.previous()">
        Previous
      </button>
      <button class="btn-border mx-2" type="button" @click="stepperRef?.reset()">
        Reset
      </button>
      <button class="btn-border mx-2" type="button" @click="stepperRef?.next()">
        Next
      </button>
    </div>
  </section>
</template>

<style scoped>
/* @unocss-placeholder */
</style>
