<template>
  <div class="flex items-start p-4 hover:bg-gray-50">
    <div class="flex-shrink-0 mr-4">
      <img :src="authorAvatar" :alt="authorName" class="w-10 h-10 rounded-full">
    </div>

    <div class="flex-grow min-w-0">
      <div class="flex items-center gap-2">
        <h3 class="font-medium text-primary hover:underline">
          <a :href="link">{{ title }}</a>
        </h3>
        <span v-if="isPinned" class="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded">Pinned</span>
        <span v-if="isSolved" class="bg-success text-dark text-xs px-2 py-0.5 rounded">Solved</span>
      </div>

      <div class="flex items-center text-xs text-gray-500 mt-1">
        <span>{{ authorName }}</span>
        <span class="mx-1">•</span>
        <span>{{ createdAt }}</span>
        <span v-if="category" class="mx-1">•</span>
        <a v-if="category" :href="categoryLink" class="text-gray-700 hover:underline">{{ category }}</a>
      </div>

      <p v-if="excerpt" class="text-gray-600 text-sm mt-2 line-clamp-2">{{ excerpt }}</p>

      <div class="flex items-center gap-4 mt-2 text-xs text-gray-500">
        <div class="flex items-center gap-1">
          <div class="i-hugeicons-eye"></div>
          <span>{{ viewCount }}</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="i-hugeicons-chat"></div>
          <span>{{ replyCount }}</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="i-hugeicons-heart"></div>
          <span>{{ likeCount }}</span>
        </div>
      </div>
    </div>

    <div v-if="lastReplyAuthorAvatar" class="flex-shrink-0 ml-4 text-right">
      <img :src="lastReplyAuthorAvatar" :alt="lastReplyAuthorName" class="w-6 h-6 rounded-full inline-block">
      <div class="text-xs text-gray-500 mt-1">{{ lastReplyAt }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  link: string
  authorName: string
  authorAvatar: string
  createdAt: string
  viewCount: number
  replyCount: number
  likeCount: number
  isPinned?: boolean
  isSolved?: boolean
  category?: string
  categoryLink?: string
  excerpt?: string
  lastReplyAuthorName?: string
  lastReplyAuthorAvatar?: string
  lastReplyAt?: string
}>()
</script>
