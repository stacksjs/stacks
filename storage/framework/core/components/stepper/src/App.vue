<script lang="ts" setup>
import { ref, watch } from 'vue'
import Hero from './components/Hero.vue'

import { Stepper } from '.'

const step = ref(1)
const steps = ref(5)
const stepperRef = ref(null)

function next() {
  if (stepperRef.value) {
    stepperRef.value.next()
  }
}

function reset() {
  if (stepperRef.value) {
    stepperRef.value.reset()
  }
}

function previous() {
  if (stepperRef.value) {
    stepperRef.value.previous()
  }
}
</script>

<template>
  <div class="bg-neutral-100/66 dark:bg-neutral-900 px-4">
    <div class="container mx-auto max-w-full sm:max-w-2xl relative">
      <header class="py-20 flex-center flex-col">
        <Hero />
      </header>
      <main
        class="grid grid-cols-1 gap-8 text-xs 2xl:text-sm text-primary pb-20"
      >
        <Stepper ref="stepperRef" v-model="step" :steps="steps" />
        <!-- <div class="w-full mx-auto text-center">
          <button class="mx-5 rounded-md bg-indigo-50 px-3.5 py-2.5 text-sm font-semibold text-indigo-600 shadow-sm hover:bg-indigo-100" type="button" @click="next()">Next</button>
          <button class="text-sm font-semibold mx-5" type="button" @click="reset()">Reset</button>
          <button class="mx-5 rounded-md bg-indigo-50 px-3.5 py-2.5 text-sm font-semibold text-indigo-600 shadow-sm hover:bg-indigo-100" type="button" @click="previous()">Previous</button>
        </div> -->
      </main>
    </div>
  </div>
</template>

<style>
@unocss-placeholder;
</style>
