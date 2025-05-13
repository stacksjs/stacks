<template>
  <div class="container mx-auto px-4 py-8">
    <header class="mb-6">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-bold">Stacks Community</h1>
        <div class="flex items-center gap-2">
          <a href="/forum/new-topic" class="px-4 py-2 bg-primary text-white rounded-md hover:opacity-90">New Topic</a>
          <a href="#" class="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100">Sign In</a>
        </div>
      </div>
      <nav class="flex gap-1 text-sm">
        <a href="/forum" class="px-3 py-2" :class="currentRoute === 'forum' ? 'bg-gray-100 rounded-md font-medium' : 'hover:bg-gray-100 rounded-md'">All Discussions</a>
        <a href="/forum?filter=popular" class="px-3 py-2" :class="currentRoute === 'forum-popular' ? 'bg-gray-100 rounded-md font-medium' : 'hover:bg-gray-100 rounded-md'">Popular</a>
        <a href="/forum?filter=recent" class="px-3 py-2" :class="currentRoute === 'forum-recent' ? 'bg-gray-100 rounded-md font-medium' : 'hover:bg-gray-100 rounded-md'">Recent</a>
        <a href="/forum?filter=solved" class="px-3 py-2" :class="currentRoute === 'forum-solved' ? 'bg-gray-100 rounded-md font-medium' : 'hover:bg-gray-100 rounded-md'">Solved</a>
      </nav>
    </header>

    <main>
      <slot></slot>
    </main>

    <footer class="mt-12 py-6 border-t text-center text-gray-500 text-sm">
      <p>Stacks Community Forum &copy; {{ new Date().getFullYear() }}</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// In a real app, this would use vue-router to determine the current route
// For now, we'll simulate it with a prop
const props = defineProps<{
  route?: string
}>()

const currentRoute = computed(() => props.route || 'forum')
</script>
