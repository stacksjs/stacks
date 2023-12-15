<script setup lang="ts">
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/vue'
import Container from '../Container.vue'

import backgroundImage from '../../assets/images/background-features.jpg'
import screenshotExpenses from '../../assets/images/screenshots/expenses.png'
import screenshotPayroll from '../../assets/images/screenshots/payroll.png'
import screenshotReporting from '../../assets/images/screenshots/reporting.png'
import screenshotVatReturns from '../../assets/images/screenshots/vat-returns.png'

const features = [
  {
    title: 'Payroll',
    description: 'Keep track of everyone\'s salaries and whether or not they\'ve been paid. Direct deposit not supported.',
    image: screenshotPayroll,
  },
  {
    title: 'Claim expenses',
    description: 'All of your receipts organized into one place, as long as you don\'t mind typing in the data by hand.',
    image: screenshotExpenses,
  },
  {
    title: 'VAT handling',
    description: 'We only sell our software to companies who don\'t deal with VAT at all, so technically we do all the VAT stuff they need.',
    image: screenshotVatReturns,
  },
  {
    title: 'Reporting',
    description: 'Easily export your data into an Excel spreadsheet where you can do whatever the hell you want with it.',
    image: screenshotReporting,
  },
]

const tabIndex = ref(0)
</script>

<template>
  <section id="features" aria-label="Features for running your books" class="relative overflow-hidden bg-blue-600 pb-28 pt-20 sm:py-32">
    <Container class="relative">
      <div class="max-w-2xl md:mx-auto md:text-center xl:max-w-none">
        <h2 class="font-display text-3xl tracking-tight text-white sm:text-4xl md:text-5xl">
          Everything you need to run your books.
        </h2>
        <p class="mt-6 text-lg tracking-tight text-blue-100">
          Well everything you need if you aren’t that picky about minor details like tax compliance.
        </p>
      </div>
      <!-- <TabGroup v-model="tabIndex" class="mt-16 grid grid-cols-1 items-center gap-y-2 pt-10 sm:gap-y-6 md:mt-20 lg:grid-cols-12 lg:pt-0">
        <TabList class="-mx-4 flex overflow-x-auto pb-4 sm:mx-0 sm:overflow-visible sm:pb-0 lg:col-span-5">
          <Tab v-for="(feature, index) in features" :key="index" class="group relative rounded-full px-4 py-1 lg:rounded-l-xl lg:rounded-r-none lg:p-6">
            <h3>
              <span class="font-display text-lg ui-not-focus-visible:outline-none">
                <span class="absolute inset-0 rounded-full lg:rounded-l-xl lg:rounded-r-none" />
                {{ feature.title }}
              </span>
            </h3>
            <p class="mt-2 hidden text-sm lg:block">
              {{ feature.description }}
            </p>
          </Tab>
        </TabList>
        <TabPanels class="lg:col-span-7">
          <TabPanel v-for="(feature, index) in features" :key="index">
            <div class="relative sm:px-6 lg:hidden">
              <div class="absolute -inset-x-4 bottom-[-4.25rem] top-[-6.5rem] bg-white/10 ring-1 ring-inset ring-white/10 sm:inset-x-0 sm:rounded-t-xl" />
              <p class="relative mx-auto max-w-2xl text-base text-white sm:text-center">
                {{ feature.description }}
              </p>
            </div>
            <div class="mt-10 w-[45rem] overflow-hidden rounded-xl bg-slate-50 shadow-xl shadow-blue-900/20 sm:w-auto lg:mt-0 lg:w-[67.8125rem]">
              <img :src="feature.image" alt="" class="w-full">
            </div>
          </TabPanel>
        </TabPanels>
      </TabGroup> -->
    </Container>
  </section>
</template>
