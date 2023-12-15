<script setup lang="ts">
import logoTransistor from '../../assets/images/logos/transistor.svg'
import logoTuple from '../../assets/images/logos/tuple.svg'
import logoStaticKit from '../../assets/images/logos/statickit.svg'
import logoMirage from '../../assets/images/logos/mirage.svg'
import logoLaravel from '../../assets/images/logos/laravel.svg'
import logoStatamic from '../../assets/images/logos/statamic.svg'

const companies = ref([
  [
    { name: 'Transistor', logo: logoTransistor },
    { name: 'Tuple', logo: logoTuple },
    { name: 'StaticKit', logo: logoStaticKit },
  ],
  [
    { name: 'Mirage', logo: logoMirage },
    { name: 'Laravel', logo: logoLaravel },
    { name: 'Statamic', logo: logoStatamic },
  ],
])
</script>

<template>
  <Container class="pb-16 pt-20 text-center lg:pt-32">
    <h1 class="mx-auto max-w-4xl font-display text-5xl font-medium tracking-tight text-slate-900 sm:text-7xl">
      Accounting
      <span class="relative whitespace-nowrap text-blue-600">
        <svg
          aria-hidden="true"
          viewBox="0 0 418 42"
          class="absolute left-0 top-2/3 h-[0.58em] w-full fill-blue-300/70"
          preserveAspectRatio="none"
        >
          <!-- SVG path here -->
        </svg>
        <span class="relative">made simple</span>
      </span>
      for small businesses.
    </h1>
    <p class="mx-auto mt-6 max-w-2xl text-lg tracking-tight text-slate-700">
      Most bookkeeping software is accurate, but hard to use. We make the
      opposite trade-off, and hope you don’t get audited.
    </p>
    <div class="mt-10 flex justify-center gap-x-6">
      <Button href="/register">
        Get 6 months free
      </Button>
      <Button
        href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        variant="outline"
      >
        <svg
          aria-hidden="true"
          class="h-3 w-3 flex-none fill-blue-600 group-active:fill-current"
        >
          <path d="m9.997 6.91-7.583 3.447A1 1 0 0 1 1 9.447V2.553a1 1 0 0 1 1.414-.91L9.997 5.09c.782.355.782 1.465 0 1.82Z" />
        </svg>
        <span class="ml-3">Watch video</span>
      </Button>
    </div>
    <div class="mt-36 lg:mt-44">
      <p class="font-display text-base text-slate-900">
        Trusted by these six companies so far
      </p>
      <ul
        role="list"
        class="mt-8 flex items-center justify-center gap-x-8 sm:flex-col sm:gap-x-0 sm:gap-y-10 xl:flex-row xl:gap-x-12 xl:gap-y-0"
      >
        <li v-for="(group, groupIndex) in companies" :key="groupIndex">
          <ul
            role="list"
            class="flex flex-col items-center gap-y-8 sm:flex-row sm:gap-x-12 sm:gap-y-0"
          >
            <li v-for="company in group" :key="company.name" class="flex">
              <img :src="company.logo" :alt="company.name">
            </li>
          </ul>
        </li>
      </ul>
    </div>
  </Container>
</template>
