<script setup>
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/vue'
import { onMounted, onUnmounted, ref } from 'vue'

import backgroundImage from '../../assets/images/screenshots/background-features.jpg'

// import screenshotExpenses from '@/images/screenshots/expenses.png'
import screenshotPayroll from '../../assets/images/screenshots/payroll.webp'

// import screenshotReporting from '@/images/screenshots/reporting.png'
// import screenshotVatReturns from '@/images/screenshots/vat-returns.png'

const features = [
  {
    title: 'Payroll',
    description:
      'Keep track of everyone\'s salaries and whether or not they\'ve been paid. Direct deposit not supported.',
    image: screenshotPayroll,
  },
  {
    title: 'Claim expenses',
    description: 'All of your receipts organized into one place, as long as you don\'t mind typing in the data by hand.',
    // image: screenshotExpenses,
  },
  {
    title: 'VAT handling',
    description:
      'We only sell our software to companies who don\'t deal with VAT at all, so technically we do all the VAT stuff they need.',
    // image: screenshotVatReturns,
  },
  {
    title: 'Reporting',
    description:
      'Easily export your data into an Excel spreadsheet where you can do whatever the hell you want with it.',
    // image: screenshotReporting,
  },
]

const tabOrientation = ref('horizontal')

onMounted(() => {
  const lgMediaQuery = window.matchMedia('(min-width: 1024px)')

  function onMediaQueryChange(event) {
    tabOrientation.value = event.matches ? 'vertical' : 'horizontal'
  }

  onMediaQueryChange(lgMediaQuery)
  lgMediaQuery.addEventListener('change', onMediaQueryChange)

  onUnmounted(() => {
    lgMediaQuery.removeEventListener('change', onMediaQueryChange)
  })
})
</script>

<template>
  <section
    id="features"
    aria-label="Features for running your books"
    class="relative overflow-hidden bg-blue-600 pb-28 pt-20 sm:py-32"
  >
    <img
      class="absolute left-1/2 top-1/2 max-w-none translate-x-[-44%] translate-y-[-42%]"
      :src="backgroundImage"
      alt=""
      width="2245"
      height="1636"
      unoptimized
    >
    <Container class="relative">
      <div class="max-w-2xl md:mx-auto xl:max-w-none md:text-center">
        <h2 class="font-display text-3xl text-white tracking-tight md:text-5xl sm:text-4xl">
          Everything you need to run your books.
        </h2>
        <p class="mt-6 text-lg text-blue-100 tracking-tight">
          Well everything you need if you aren’t that picky about minor
          details like tax compliance.
        </p>
      </div>

      <TabGroup
        as="div"
        class="grid grid-cols-1 mt-16 items-center gap-y-2 pt-10 lg:grid-cols-12 md:mt-20 sm:gap-y-6 lg:pt-0"
        :vertical="tabOrientation === 'vertical'"
      >
        <template #default="{ selectedIndex }">
          <div class="flex overflow-x-auto pb-4 lg:col-span-5 -mx-4 sm:mx-0 sm:overflow-visible sm:pb-0">
            <TabList class="relative z-10 flex gap-x-4 whitespace-nowrap px-4 lg:mx-0 sm:mx-auto lg:block lg:gap-x-0 lg:gap-y-1 lg:whitespace-normal sm:px-0">
              <div
                class="group relative rounded-full px-4 py-1 lg:rounded-l-xl lg:rounded-r-none lg:p-6" :class="{
                  'bg-white lg:bg-white/10 lg:ring-1 lg:ring-inset lg:ring-white/10': selectedIndex === 0,
                  'hover:bg-white/10 lg:hover:bg-white/5': selectedIndex !== 0,
                }"
              >
                <h3>
                  <Tab
                    class="font-display text-lg ui-not-focus-visible:outline-none" :class="{
                      'text-blue-600 lg:text-white': selectedIndex === 0,
                      'text-blue-100 hover:text-white lg:text-white': selectedIndex !== 0,
                    }"
                  >
                    <span class="absolute inset-0 rounded-full lg:rounded-l-xl lg:rounded-r-none" />
                    {{ features[0].title }}
                  </Tab>
                </h3>
                <p
                  v-if="tabOrientation === 'vertical'"
                  class="mt-2 hidden text-sm lg:block" :class="{
                    'text-white': selectedIndex === 0,
                    'text-blue-100 group-hover:text-white': selectedIndex !== 0,
                  }"
                >
                  {{ features[0].description }}
                </p>
              </div>

              <div
                class="group relative rounded-full px-4 py-1 lg:rounded-l-xl lg:rounded-r-none lg:p-6" :class="{
                  'bg-white lg:bg-white/10 lg:ring-1 lg:ring-inset lg:ring-white/10': selectedIndex === 1,
                  'hover:bg-white/10 lg:hover:bg-white/5': selectedIndex !== 1,
                }"
              >
                <h3>
                  <Tab
                    class="font-display text-lg ui-not-focus-visible:outline-none" :class="{
                      'text-blue-600 lg:text-white': selectedIndex === 1,
                      'text-blue-100 hover:text-white lg:text-white': selectedIndex !== 1,
                    }"
                  >
                    <span class="absolute inset-0 rounded-full lg:rounded-l-xl lg:rounded-r-none" />
                    {{ features[1].title }}
                  </Tab>
                </h3>
                <p
                  v-if="tabOrientation === 'vertical'"
                  class="mt-2 hidden text-sm lg:block" :class="{
                    'text-white': selectedIndex === 1,
                    'text-blue-100 group-hover:text-white': selectedIndex !== 1,
                  }"
                >
                  {{ features[1].description }}
                </p>
              </div>

              <div
                class="group relative rounded-full px-4 py-1 lg:rounded-l-xl lg:rounded-r-none lg:p-6" :class="{
                  'bg-white lg:bg-white/10 lg:ring-1 lg:ring-inset lg:ring-white/10': selectedIndex === 2,
                  'hover:bg-white/10 lg:hover:bg-white/5': selectedIndex !== 2,
                }"
              >
                <h3>
                  <Tab
                    class="font-display text-lg ui-not-focus-visible:outline-none" :class="{
                      'text-blue-600 lg:text-white': selectedIndex === 2,
                      'text-blue-100 hover:text-white lg:text-white': selectedIndex !== 2,
                    }"
                  >
                    <span class="absolute inset-0 rounded-full lg:rounded-l-xl lg:rounded-r-none" />
                    {{ features[2].title }}
                  </Tab>
                </h3>
                <p
                  v-if="tabOrientation === 'vertical'"
                  class="mt-2 hidden text-sm lg:block" :class="{
                    'text-white': selectedIndex === 2,
                    'text-blue-100 group-hover:text-white': selectedIndex !== 2,
                  }"
                >
                  {{ features[2].description }}
                </p>
              </div>
            </TabList>
          </div>
          <TabPanels class="lg:col-span-7">
            <TabPanel
              unmount="false"
            >
              <div class="relative lg:hidden sm:px-6">
                <div class="absolute bottom-[-4.25rem] top-[-6.5rem] bg-white/10 ring-1 ring-white/10 ring-inset -inset-x-4 sm:inset-x-0 sm:rounded-t-xl" />
                <p class="relative mx-auto max-w-2xl text-base text-white sm:text-center">
                  {{ features[0].description }}
                </p>
              </div>

              <div class="mt-10 w-[45rem] overflow-hidden rounded-xl bg-slate-50 shadow-blue-900/20 shadow-xl lg:mt-0 lg:w-[67.8125rem] sm:w-auto">
                <img
                  class="w-full"
                  :src="features[0].image"
                  alt=""
                  priority
                  sizes="(min-width: 1024px) 67.8125rem, (min-width: 640px) 100vw, 45rem"
                >
              </div>

              {{ features[0].image }}
            </TabPanel>
          </TabPanels>
        </template>
      </TabGroup>
    </Container>
  </section>
</template>
