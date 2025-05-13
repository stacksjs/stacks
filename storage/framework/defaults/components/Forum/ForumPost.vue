<template>
  <div :id="'post-' + id" class="border rounded-md mb-6">
    <div class="bg-gray-50 px-4 py-3 flex items-center justify-between rounded-t-md">
      <div class="flex items-center gap-2">
        <img :src="authorAvatar" :alt="authorName" class="w-6 h-6 rounded-full">
        <span class="font-medium">{{ authorName }}</span>
        <span class="text-xs text-gray-500">{{ createdAt }}</span>
      </div>

      <div class="flex items-center gap-2">
        <button v-if="isOriginalPost" class="text-xs px-2 py-1 rounded border hover:bg-gray-100">
          <span class="i-hugeicons-bookmark mr-1"></span>
          Bookmark
        </button>
        <button class="text-xs px-2 py-1 rounded border hover:bg-gray-100">
          <span class="i-hugeicons-share mr-1"></span>
          Share
        </button>
      </div>
    </div>

    <div class="p-4">
      <h1 v-if="isOriginalPost" class="text-xl font-bold mb-4">{{ title }}</h1>
      <div class="prose max-w-none">
        <slot></slot>
      </div>
    </div>

    <div class="bg-gray-50 px-4 py-3 flex items-center justify-between rounded-b-md">
      <div class="flex items-center gap-3 text-gray-500">
        <button class="flex items-center gap-1 hover:text-primary">
          <span class="i-hugeicons-heart"></span>
          <span>{{ likeCount }}</span>
        </button>

        <button class="flex items-center gap-1 hover:text-primary">
          <span class="i-hugeicons-chat"></span>
          <span>Reply</span>
        </button>
      </div>

      <div class="flex items-center gap-2">
        <button v-if="isOriginalPost && !isSolved" class="text-xs px-2 py-1 rounded bg-success text-dark hover:opacity-90">
          Mark as Solution
        </button>
        <button class="text-xs px-2 py-1 rounded border hover:bg-gray-100">
          <span class="i-hugeicons-flag mr-1"></span>
          Report
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  id: string | number
  authorName: string
  authorAvatar: string
  createdAt: string
  likeCount: number
  isOriginalPost?: boolean
  title?: string
  isSolved?: boolean
}>()
</script>