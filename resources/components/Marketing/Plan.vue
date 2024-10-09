<script setup lang="ts">
defineProps<{
  name: string
  price: string
  description: string
  href: string
  features: Array<string>
  featured: boolean
}>()
</script>

<template>
  <section
    class="flex flex-col rounded-3xl px-6 sm:px-8"
    :class="[
      featured ? 'order-first bg-blue-600 py-8 lg:order-none' : 'lg:py-8',
    ]"
  >
    <h3 class="font-display mt-5 text-lg text-white">
      {{ name }}
    </h3>
    <p
      class="mt-2 text-base"
      :class="[
        featured ? 'text-white' : 'text-slate-400',
      ]"
    >
      {{ description }}
    </p>
    <p class="font-display order-first text-5xl text-white font-light tracking-tight">
      {{ price }}
    </p>
    <ul
      role="list"
      class="order-last mt-10 flex flex-col gap-y-3 text-sm"
      :class="[
        featured ? 'text-white' : 'text-slate-200',
      ]"
    >
      <li v-for="(feature, index) in features" :key="index" class="flex">
        <CheckIcon :class="featured ? 'text-white' : 'text-slate-400'" />
        <span class="ml-4">{{ feature }}</span>
      </li>
    </ul>
    <Button
      :href="href"
      :variant="featured ? 'solid' : 'outline'"
      color="white"
      class="mt-8"
      :aria-label="`Get started with the ${name} plan for ${price}`"
    >
      Get started
    </Button>
  </section>
</template>
