<script setup lang="ts">
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/vue'

// import backgroundImage from '../../assets/images/background-features.jpg'

const features = [
  {
    title: 'Frontend',
    description: 'Powered by a progressive UI Engine, building application interfaces has never been easier.',
    image:
      'https://salient.tailwindui.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fpayroll.517af4e7.png&w=1920&q=75',
  },
  {
    title: 'Backend',
    description:
      'Building serverless APIs has never been simpler. Focus on your business logic, not your infrastructure.',
    image:
      'https://salient.tailwindui.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fpayroll.517af4e7.png&w=1920&q=75',
  },
  {
    title: 'Cloud',
    description: 'Lorem ipsum dolor sit, amet consectetur adipisicing elit. Tempora in cum blanditiis? Qui omnis unde.',
    image:
      'https://salient.tailwindui.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fpayroll.517af4e7.png&w=1920&q=75',
  },
  {
    title: 'DX',
    description: 'Lorem ipsum dolor sit, amet consectetur adipisicing elit. Tempora in cum blanditiis? Qui omnis unde.',
    image:
      'https://salient.tailwindui.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fpayroll.517af4e7.png&w=1920&q=75',
  },
]

const tabIndex = ref(0)
const tabOrientation = ref('vertical')

function onMediaQueryChange(event) {
  tabOrientation.value = event.matches ? 'vertical' : 'horizontal'
}

const lgMediaQuery = window.matchMedia('(min-width: 1024px)')

onMounted(() => {
  onMediaQueryChange(lgMediaQuery)
  lgMediaQuery.addEventListener('change', onMediaQueryChange)
})

onUnmounted(() => {
  lgMediaQuery.removeEventListener('change', onMediaQueryChange)
})
</script>

<template>
  <section id="features" aria-label="Features for running your books" class="relative overflow-hidden bg-blue-600 pb-28 pt-20 sm:py-32">
    <Container class="relative">
      <div class="max-w-2xl md:mx-auto xl:max-w-none md:text-center">
        <h2 class="font-display text-3xl text-white tracking-tight md:text-5xl sm:text-4xl">
          Build. Ship. Grow.
        </h2>
        <p class="mt-6 text-lg text-blue-100 tracking-tight">
          Stacks helps you build, ship, and grow your SaaS business with its powerful set of tools.
        </p>
      </div>

      <TabGroup
        v-model="tabIndex"
        as="div"
        class="grid grid-cols-1 mt-16 items-center gap-y-2 pt-10 lg:grid-cols-12 md:mt-20 sm:gap-y-6 lg:pt-0"
        vertical
      >
        <TabList
          class="mt-16 flex overflow-x-auto pb-4 lg:col-span-5 -mx-4 sm:mx-0 sm:overflow-visible sm:pb-0"
          :class="selectedIndex === featureIndex
            ? 'bg-white lg:bg-white/10 lg:ring-1 lg:ring-inset lg:ring-white/10'
            : 'hover:bg-white/10 lg:hover:bg-white/5'"
        >
          <Tab
            class="group relative rounded-full px-4 py-1 lg:rounded-l-xl lg:rounded-r-none lg:p-6"
            :class="selectedIndex === featureIndex
              ? 'text-blue-600 lg:text-white'
              : 'text-blue-100 hover:text-white lg:text-white'"
          >
            <h3>
              <span class="font-display text-lg ui-not-focus-visible:outline-none">
                <span class="absolute inset-0 rounded-full lg:rounded-l-xl lg:rounded-r-none" />
                {{ features?.[0]?.title }}
              </span>
            </h3>
            <p
              class="mt-2 hidden text-sm lg:block"
              :class="selectedIndex === featureIndex
                ? 'text-white'
                : 'text-blue-100 group-hover:text-white'"
            >
              {{ features?.[0]?.description }}
            </p>
          </Tab>

          <Tab class="group relative rounded-full px-4 py-1 lg:rounded-l-xl lg:rounded-r-none lg:p-6">
            <h3>
              <span class="font-display text-lg ui-not-focus-visible:outline-none">
                <span class="absolute inset-0 rounded-full lg:rounded-l-xl lg:rounded-r-none" />
                {{ features?.[1]?.title }}
              </span>
            </h3>
            <p class="mt-2 hidden text-sm lg:block">
              {{ features?.[1]?.description }}
            </p>
          </Tab>

          <Tab class="group relative rounded-full px-4 py-1 lg:rounded-l-xl lg:rounded-r-none lg:p-6">
            <h3>
              <span class="font-display text-lg ui-not-focus-visible:outline-none">
                <span class="absolute inset-0 rounded-full lg:rounded-l-xl lg:rounded-r-none" />
                {{ features?.[2]?.title }}
              </span>
            </h3>
            <p class="mt-2 hidden text-sm lg:block">
              {{ features?.[2]?.description }}
            </p>
          </Tab>

          <Tab class="group relative rounded-full px-4 py-1 lg:rounded-l-xl lg:rounded-r-none lg:p-6">
            <h3>
              <span class="font-display text-lg ui-not-focus-visible:outline-none">
                <span class="absolute inset-0 rounded-full lg:rounded-l-xl lg:rounded-r-none" />
                {{ features?.[3]?.title }}
              </span>
            </h3>
            <p class="mt-2 hidden text-sm lg:block">
              {{ features?.[3]?.description }}
            </p>
          </Tab>
        </TabList>

        <TabPanels class="lg:col-span-7">
          <TabPanel>
            <div class="relative lg:hidden sm:px-6">
              <div class="absolute bottom-[-4.25rem] top-[-6.5rem] bg-white/10 ring-1 ring-white/10 ring-inset -inset-x-4 sm:inset-x-0 sm:rounded-t-xl" />
              <p class="relative mx-auto max-w-2xl text-base text-white sm:text-center">
                {{ features?.[0]?.description }}
              </p>
            </div>
            <div class="mt-10 w-[45rem] overflow-hidden rounded-xl bg-slate-50 shadow-blue-900/20 shadow-xl lg:mt-0 lg:w-[67.8125rem] sm:w-auto">
              <img src="https://salient.tailwindui.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fpayroll.517af4e7.png&w=1920&q=75" alt="" class="w-full">
            </div>
          </TabPanel>

          <TabPanel>
            <div class="relative lg:hidden sm:px-6">
              <div class="absolute bottom-[-4.25rem] top-[-6.5rem] bg-white/10 ring-1 ring-white/10 ring-inset -inset-x-4 sm:inset-x-0 sm:rounded-t-xl" />
              <p class="relative mx-auto max-w-2xl text-base text-white sm:text-center">
                {{ features?.[1]?.description }}
              </p>
            </div>
            <div class="mt-10 w-[45rem] overflow-hidden rounded-xl bg-slate-50 shadow-blue-900/20 shadow-xl lg:mt-0 lg:w-[67.8125rem] sm:w-auto">
              <img :src="features?.[1]?.image" alt="" class="w-full">
            </div>
          </TabPanel>

          <TabPanel>
            <div class="relative lg:hidden sm:px-6">
              <div class="absolute bottom-[-4.25rem] top-[-6.5rem] bg-white/10 ring-1 ring-white/10 ring-inset -inset-x-4 sm:inset-x-0 sm:rounded-t-xl" />
              <p class="relative mx-auto max-w-2xl text-base text-white sm:text-center">
                {{ features?.[2]?.description }}
              </p>
            </div>
            <div class="mt-10 w-[45rem] overflow-hidden rounded-xl bg-slate-50 shadow-blue-900/20 shadow-xl lg:mt-0 lg:w-[67.8125rem] sm:w-auto">
              <img :src="features?.[2]?.image" alt="" class="w-full">
            </div>
          </TabPanel>

          <TabPanel>
            <div class="relative lg:hidden sm:px-6">
              <div class="absolute bottom-[-4.25rem] top-[-6.5rem] bg-white/10 ring-1 ring-white/10 ring-inset -inset-x-4 sm:inset-x-0 sm:rounded-t-xl" />
              <p class="relative mx-auto max-w-2xl text-base text-white sm:text-center">
                {{ features?.[3]?.description }}
              </p>
            </div>
            <div class="mt-10 w-[45rem] overflow-hidden rounded-xl bg-slate-50 shadow-blue-900/20 shadow-xl lg:mt-0 lg:w-[67.8125rem] sm:w-auto">
              <img :src="features?.[3]?.image" alt="" class="w-full">
            </div>
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </Container>
  </section>
</template>
