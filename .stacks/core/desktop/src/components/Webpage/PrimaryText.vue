<script lang="ts" setup>
import { useWebpageStore } from '~/stores/webpage'

interface Props {
  copyblock: number
}

const {
  copyblock,
} = defineProps<Props>()

const webpageStore = useWebpageStore()

onMounted(() => {
  webpageStore.webpageForm.copyblock_1 = copyblock
})
</script>

<template>
  <div class="p-10 mb-12 space-y-8">
    <div>
      <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">
        Primary Text Helps Highlight Your Focus
      </h3>
      <p class="max-w-2xl mt-1 text-sm text-gray-500 dark:text-gray-400">
        What is the first message you want to convey to your Clients? Below you
        can choose between precomposed copy messages that have been tested to
        generate conversions.
      </p>
    </div>
    <fieldset class="mt-8">
      <legend class="sr-only">
        Privacy setting
      </legend>
      <div class="-space-y-px bg-white rounded-md dark:bg-gray-700">
        <!-- Checked: "bg-teal-50 border-teal-200 z-10", Not Checked: "border-gray-200" -->
        <label
          :class="{ 'bg-teal-50 border-teal-200 z-10': webpageStore.webpageForm.copyblock_1 === 1 }"
          class="relative flex p-4 border cursor-pointer dark:border-gray-600 rounded-tl-md rounded-tr-md focus:outline-none"
        >
          <input
            v-model="webpageStore.webpageForm.copyblock_1"
            type="radio"
            name="privacy-setting"
            :value="1"
            class="
              h-4
              w-4
              mt-0.5
              cursor-pointer
              text-teal-600
              border-gray-300
              dark:border-gray-600
              dark:border-gray-600

            "
            aria-labelledby="privacy-setting-0-label"
            aria-describedby="privacy-setting-0-description"
          >
          <div class="flex flex-col ml-3">
            <span
              :class="{ 'text-teal-700': webpageStore.webpageForm.copyblock_1 === 1 }"
              class="block text-sm text-gray-500 dark:text-gray-400"
            >
              Choosing your Medicare coverage can be a very confusing and
              complicated process. As a licensed insurance agent, I’m here to
              assist you in making an informed decision so you can be confident
              you receive the plan benefits that meet your health care needs,
              your lifestyle and your budget.
            </span>
          </div>
        </label>

        <!-- Checked: "bg-teal-50 border-teal-200 z-10", Not Checked: "border-gray-200" -->
        <label
          :class="{ 'bg-teal-50 border-teal-200 z-10': webpageStore.webpageForm.copyblock_1 === 2 }"
          class="relative flex p-4 border border-gray-200 cursor-pointer dark:border-gray-600 focus:outline-none"
        >
          <input
            v-model="webpageStore.webpageForm.copyblock_1"
            type="radio"
            name="privacy-setting"
            :value="2"
            class="
              h-4
              w-4
              mt-0.5
              cursor-pointer
              text-teal-600
              border-gray-300
              dark:border-gray-600

            "
            aria-labelledby="privacy-setting-1-label"
            aria-describedby="privacy-setting-1-description"
          >
          <div class="flex flex-col ml-3">
            <!-- Checked: "text-teal-700", Not Checked: "text-gray-500" -->
            <span
              :class="{ 'text-teal-700': webpageStore.webpageForm.copyblock_1 === 2 }"
              class="block text-sm text-gray-500 dark:text-gray-400"
            >
              Deciding on a Medicare plan isn’t always easy. Let’s review your
              options so you can select the coverage that best meets your needs.
              Together we can make Medicare work for you!
            </span>
          </div>
        </label>

        <label
          :class="{ 'bg-teal-50 border-teal-200 z-10': webpageStore.webpageForm.copyblock_1 === 3 }"
          class="relative flex p-4 border cursor-pointer dark:border-gray-600 focus:outline-none"
        >
          <input
            v-model="webpageStore.webpageForm.copyblock_1"
            type="radio"
            name="privacy-setting"
            :value="3"
            class="
              h-4
              w-4
              mt-0.5
              cursor-pointer
              text-teal-600
              border-gray-300
              dark:border-gray-600

            "
            aria-labelledby="privacy-setting-2-label"
            aria-describedby="privacy-setting-2-description"
          >
          <div class="flex flex-col ml-3">
            <span
              :class="{ 'text-teal-700': webpageStore.webpageForm.copyblock_1 === 3 }"
              class="block text-sm text-gray-500 dark:text-gray-400"
            >
              Choosing a Medicare plan that fits your budget and needs can be
              difficult, but you don’t have to do it alone. Together we can find
              a plan that works for you!
            </span>
          </div>
        </label>
        <label
          :class="{ 'bg-teal-50 border-teal-200 z-10': webpageStore.webpageForm.copyblock_1 === 4 }"
          class="relative flex p-4 border cursor-pointer dark:border-gray-600 rounded-bl-md rounded-br-md focus:outline-none"
        >
          <input
            v-model="webpageStore.webpageForm.copyblock_1"
            type="radio"
            name="privacy-setting"
            :value="4"
            class="
              h-4
              w-4
              mt-0.5
              cursor-pointer
              text-teal-600
              border-gray-300
              dark:border-gray-600

            "
            aria-labelledby="privacy-setting-2-label"
            aria-describedby="privacy-setting-2-description"
          >
          <div class="flex flex-col ml-3">
            <span
              :class="{ 'text-teal-900': webpageStore.webpageForm.copyblock_1 === 4 }"
              class="block text-sm text-gray-700 dark:text-gray-200"
            >
              I offer a full line of Medicare products from the nation’s leading
              Medicare carriers. Including:
            </span>
            <!-- Checked: "text-teal-700", Not Checked: "text-gray-500" -->
            <div
              :class="{ 'text-teal-700': webpageStore.webpageForm.copyblock_1 === 4 }"
              class="block text-sm text-gray-500 dark:text-gray-400"
            >
              <ul class="pt-1 pl-2">
                <li>✓ Medicare Supplement (Medigap)</li>
                <li>✓ Medicare Advantage Plans</li>
                <li>✓ Medicare Part D Prescription Drug Coverage</li>
              </ul>
            </div>
          </div>
        </label>
      </div>
    </fieldset>
  </div>
</template>
