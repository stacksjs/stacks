<script lang="ts" setup>
import { ref } from 'vue'
import { Stepper } from '.'

import Hero from './components/Hero.vue'

const step = ref(1)
const steps = ref(5)
const stepperRef = ref(null)

// function next() {
//   if (stepperRef.value) {
//     stepperRef.value.next()
//   }
// }

// function reset() {
//   if (stepperRef.value) {
//     stepperRef.value.reset()
//   }
// }

// function previous() {
//   if (stepperRef.value) {
//     stepperRef.value.previous()
//   }
// }
</script>

<template>
  <div class="bg-neutral-100/66 px-4 dark:bg-neutral-900">
    <div class="relative mx-auto max-w-full container sm:max-w-2xl">
      <header class="flex-center flex-col py-20">
        <Hero />
      </header>
      <main
        class="text-primary grid grid-cols-1 gap-8 pb-20 text-xs 2xl:text-sm"
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
