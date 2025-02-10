<script setup lang="ts">
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/vue'

const features = [
  {
    name: 'Dashboard',
    summary: 'The UI to your application.',
    description:
      'Whether you are a developer or a client, The Dashboard visualizes your data. Easily extend your admin panel.',
    image:
      'https://salient.tailwindui.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fprofit-loss.2a2f85d5.png&w=1200&q=75',
    icon: '',
  },
  {
    name: 'Buddy CLI',
    summary: 'The Stacks runtime.',
    description:
      'The Buddy toolkit makes it easy to interact with all your application needs. From development to releases and upgrades, this handy yet incredible tool is the last thing you\'ll ever need.',
    image:
      'https://salient.tailwindui.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fprofit-loss.2a2f85d5.png&w=1200&q=75',
    icon: '',
  },

  {
    name: 'CI/CD',
    summary: 'Streamline Your Deployment Process',
    description:
      'Embrace the ease of our CI/CD solutions, designed to simplify your deployment and release management. With Stacks, you can focus on the what and why of your project, leaving the how to us.',
    image:
      'https://salient.tailwindui.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fprofit-loss.2a2f85d5.png&w=1200&q=75',
    icon: '',
  },
]

const tabIndex = ref(0)
// const tabOrientation = ref('horizontal')
const selectedIndex = computed(() => tabIndex.value)
</script>

<template>
  <section id="secondary-features" aria-label="Features for simplifying everyday business tasks" class="pb-14 pt-20 lg:pb-32 sm:pb-20 sm:pt-32">
    <Container>
      <div class="mx-auto max-w-2xl md:text-center">
        <h2 class="font-display text-3xl text-slate-900 tracking-tight sm:text-4xl">
          A Developer Experience Like No Other
        </h2>
        <p class="mt-4 text-lg text-slate-700 tracking-tight">
          Remove the boilerplate. Remove the repetition. Focus on what matters.
        </p>
      </div>

      <!-- FeaturesMobile -->
      <!-- <div class="-mx-4 mt-20 flex flex-col gap-y-10 overflow-hidden px-4 sm:-mx-6 sm:px-6 lg:hidden">
        <div v-for="feature in features" :key="feature.summary">
          <Feature :feature="feature" class="mx-auto max-w-2xl" :is-active="true" />
          <div class="relative mt-10 pb-10">
            <div class="absolute -inset-x-4 bottom-0 top-8 bg-slate-200 sm:-inset-x-6" />
            <div class="relative mx-auto w-[52.75rem] overflow-hidden rounded-xl bg-white shadow-lg shadow-slate-900/5 ring-1 ring-slate-500/10">
              <img class="w-full" :src="feature.image" alt="" sizes="52.75rem">
            </div>
          </div>
        </div>
      </div> -->

      <!-- FeaturesDesktop -->
      <TabGroup as="div" class="hidden lg:mt-20 lg:block">
        <TabList class="grid grid-cols-3 gap-x-8 pt-12">
          <div class="relative">
            <div class="w-9 rounded-lg" :class="{ 'bg-blue-600': 0 === selectedIndex, 'bg-slate-500': 0 !== selectedIndex }">
              <svg aria-hidden="true" class="h-9 w-9" fill="none">
                {{ features?.[0]?.icon }}
              </svg>
            </div>
            <h3 class="mt-6 text-sm font-medium" :class="{ 'text-blue-600': 0 === selectedIndex, 'text-slate-600': 0 !== selectedIndex }">
              <Tab>{{ features?.[0]?.name }}</Tab>
            </h3>
            <p class="font-display mt-2 text-xl text-slate-900">
              {{ features?.[0]?.summary }}
            </p>
            <p class="mt-4 text-sm text-slate-600">
              {{ features?.[0]?.description }}
            </p>
          </div>

          <div class="relative">
            <div class="w-9 rounded-lg" :class="{ 'bg-blue-600': 1 === selectedIndex, 'bg-slate-500': 1 !== selectedIndex }">
              <svg aria-hidden="true" class="h-9 w-9" fill="none">
                {{ features?.[1]?.icon }}
              </svg>
            </div>
            <h3 class="mt-6 text-sm font-medium" :class="{ 'text-blue-600': 1 === selectedIndex, 'text-slate-600': 1 !== selectedIndex }">
              <Tab>{{ features?.[1]?.name }}</Tab>
            </h3>
            <p class="font-display mt-2 text-xl text-slate-900">
              {{ features?.[1]?.summary }}
            </p>
            <p class="mt-4 text-sm text-slate-600">
              {{ features?.[1]?.description }}
            </p>
          </div>

          <div class="relative">
            <div class="w-9 rounded-lg" :class="{ 'bg-blue-600': 2 === selectedIndex, 'bg-slate-500': 2 !== selectedIndex }">
              <svg aria-hidden="true" class="h-9 w-9" fill="none">
                {{ features?.[2]?.icon }}
              </svg>
            </div>
            <h3 class="mt-6 text-sm font-medium" :class="{ 'text-blue-600': 2 === selectedIndex, 'text-slate-600': 2 !== selectedIndex }">
              <Tab>{{ features?.[2]?.name }}</Tab>
            </h3>
            <p class="font-display mt-2 text-xl text-slate-900">
              {{ features?.[2]?.summary }}
            </p>
            <p class="mt-4 text-sm text-slate-600">
              {{ features?.[2]?.description }}
            </p>
          </div>
        </TabList>

        <TabPanels class="rounded-4xl relative mt-20 overflow-hidden bg-slate-200 px-14 py-16 xl:px-16">
          <div class="flex -mx-5">
            <TabPanel :key="features?.[0]?.summary" class="px-5 transition duration-500 ease-in-out ui-not-focus-visible:outline-none" :class="{ 'opacity-60': 0 !== selectedIndex }" :style="{ transform: `translateX(-${selectedIndex * 100}%)` }" :aria-hidden="0 !== selectedIndex">
              <div class="w-[52.75rem] overflow-hidden rounded-xl bg-white shadow-lg shadow-slate-900/5 ring-1 ring-slate-500/10">
                <img class="w-full" :src="features?.[0]?.image" alt="" sizes="52.75rem">
              </div>
            </TabPanel>

            <TabPanel :key="features?.[1]?.summary" class="px-5 transition duration-500 ease-in-out ui-not-focus-visible:outline-none" :class="{ 'opacity-60': 1 !== selectedIndex }" :style="{ transform: `translateX(-${selectedIndex * 100}%)` }" :aria-hidden="1 !== selectedIndex">
              <div class="w-[52.75rem] overflow-hidden rounded-xl bg-white shadow-lg shadow-slate-900/5 ring-1 ring-slate-500/10">
                <img class="w-full" :src="features?.[1]?.image" alt="" sizes="52.75rem">
              </div>
            </TabPanel>

            <TabPanel :key="features?.[2]?.summary" class="px-5 transition duration-500 ease-in-out ui-not-focus-visible:outline-none" :class="{ 'opacity-60': 2 !== selectedIndex }" :style="{ transform: `translateX(-${selectedIndex * 100}%)` }" :aria-hidden="2 !== selectedIndex">
              <div class="w-[52.75rem] overflow-hidden rounded-xl bg-white shadow-lg shadow-slate-900/5 ring-1 ring-slate-500/10">
                <img class="w-full" :src="features?.[2]?.image" alt="" sizes="52.75rem">
              </div>
            </TabPanel>
          </div>
          <div class="rounded-4xl pointer-events-none absolute inset-0 ring-1 ring-slate-900/10 ring-inset" />
        </TabPanels>
      </TabGroup>
    </Container>
  </section>
</template>
