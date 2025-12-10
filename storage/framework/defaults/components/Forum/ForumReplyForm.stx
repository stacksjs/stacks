<template>
  <div class="border rounded-md mb-6">
    <div class="bg-gray-50 px-4 py-3 flex items-center rounded-t-md">
      <h3 class="font-medium">Post a Reply</h3>
    </div>

    <div class="p-4">
      <div class="mb-4">
        <div class="flex gap-2 mb-2">
          <button class="px-2 py-1 text-sm border rounded hover:bg-gray-100" title="Bold">B</button>
          <button class="px-2 py-1 text-sm border rounded hover:bg-gray-100" title="Italic">I</button>
          <button class="px-2 py-1 text-sm border rounded hover:bg-gray-100" title="Link">
            <span class="i-hugeicons-link"></span>
          </button>
          <button class="px-2 py-1 text-sm border rounded hover:bg-gray-100" title="Code">
            <span class="i-hugeicons-code"></span>
          </button>
          <button class="px-2 py-1 text-sm border rounded hover:bg-gray-100" title="Image">
            <span class="i-hugeicons-image"></span>
          </button>
          <button class="px-2 py-1 text-sm border rounded hover:bg-gray-100" title="Quote">
            <span class="i-hugeicons-quote"></span>
          </button>
          <button class="px-2 py-1 text-sm border rounded hover:bg-gray-100" title="List">
            <span class="i-hugeicons-list"></span>
          </button>
        </div>
        <textarea
          v-model="replyContent"
          class="w-full border rounded-md p-3 min-h-32 focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Write your reply here..."
        ></textarea>
        <div class="flex justify-between text-xs text-gray-500 mt-1">
          <span>Markdown formatting supported</span>
          <span>{{ replyContent.length }} characters</span>
        </div>
      </div>

      <div class="flex justify-between items-center">
        <div class="flex items-center gap-4">
          <label class="flex items-center text-sm text-gray-600">
            <input type="checkbox" class="mr-2" v-model="notifyOnReply">
            Notify me of follow-up replies
          </label>

          <button class="text-sm text-gray-600 hover:text-primary">
            Formatting Help
          </button>
        </div>

        <div class="flex gap-2">
          <button class="px-3 py-2 border rounded-md hover:bg-gray-100">
            Preview
          </button>
          <button
            class="px-4 py-2 bg-primary text-white rounded-md hover:opacity-90"
            :disabled="!canSubmit"
            :class="{ 'opacity-50 cursor-not-allowed': !canSubmit }"
            @click="submitReply"
          >
            Post Reply
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const replyContent = ref('')
const notifyOnReply = ref(true)

const canSubmit = computed(() => {
  return replyContent.value.trim().length > 0
})

function submitReply() {
  if (!canSubmit.value) return

  // In a real app, this would submit the reply to the server
  console.log('Submitting reply:', {
    content: replyContent.value,
    notifyOnReply: notifyOnReply.value
  })

  // Reset form after submission
  replyContent.value = ''
}
</script>