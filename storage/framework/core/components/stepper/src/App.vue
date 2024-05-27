<script lang="ts" setup>
import { ref, watch } from 'vue'
import { Stepper } from '.';

let step = ref(1);
let steps = ref(5);
const stepperRef = ref(null);

const next = () => {
  if(stepperRef.value) {
    stepperRef.value.next()
  }
}

const reset = () => {
  if(stepperRef.value) {
    stepperRef.value.reset()
  }
}


const previous = () => {
  if(stepperRef.value) {
    stepperRef.value.previous()
  }
}

</script>

<template>
  <div class="bg-neutral-100/66 dark:bg-neutral-900 px-4">
    <div class="container mx-auto max-w-full sm:max-w-2xl relative">
      <header class="py-20 flex-center flex-col">
        Stacks Stepper
      </header>
      <main
        class="grid grid-cols-1 gap-8 text-xs 2xl:text-sm text-primary pb-20"
      >

        <Stepper ref='stepperRef' :steps="steps" v-model="step"/>
        <div class="w-full mx-auto text-center">
          <button class="mx-5 rounded-md bg-indigo-50 px-3.5 py-2.5 text-sm font-semibold text-indigo-600 shadow-sm hover:bg-indigo-100" type="button" @click="next()">Next</button>
          <button class="text-sm font-semibold mx-5" type="button" @click="reset()">Reset</button>
          <button class="mx-5 rounded-md bg-indigo-50 px-3.5 py-2.5 text-sm font-semibold text-indigo-600 shadow-sm hover:bg-indigo-100" type="button" @click="previous()">Previous</button>
        </div>


      </main>
    </div>

  </div>
</template>
