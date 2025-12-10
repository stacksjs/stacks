<template>
  <ForumLayout route="forum-new-topic">
    <div class="max-w-3xl mx-auto">
      <ForumBreadcrumb :items="[
        { label: 'Forum', link: '/forum' },
        { label: 'New Topic', link: '/forum/new-topic' }
      ]" />

      <div class="border rounded-md mb-6">
        <div class="bg-gray-50 px-4 py-3 flex items-center rounded-t-md">
          <h1 class="font-medium text-lg">Create New Topic</h1>
        </div>

        <div class="p-4">
          <div class="space-y-4">
            <div>
              <label class="block mb-1 font-medium">Title</label>
              <input
                type="text"
                placeholder="Enter a descriptive title for your topic"
                class="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              >
              <div class="text-xs text-gray-500 mt-1">
                Be specific and imagine you're asking a question to another person
              </div>
            </div>

            <div>
              <label class="block mb-1 font-medium">Category</label>
              <select class="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Select a category</option>
                <optgroup label="General Discussion">
                  <option value="general-chat">General Chat</option>
                  <option value="introductions">Introductions</option>
                  <option value="feedback">Feedback & Suggestions</option>
                </optgroup>
                <optgroup label="Technical Support">
                  <option value="installation">Installation & Setup</option>
                  <option value="troubleshooting">Troubleshooting</option>
                  <option value="feature-requests">Feature Requests</option>
                </optgroup>
              </select>
            </div>

            <div>
              <label class="block mb-1 font-medium">Content</label>
              <div class="mb-2">
                <div class="flex gap-2 mb-2">
                  <button class="px-2 py-1 text-sm border rounded hover:bg-gray-100">B</button>
                  <button class="px-2 py-1 text-sm border rounded hover:bg-gray-100">I</button>
                  <button class="px-2 py-1 text-sm border rounded hover:bg-gray-100">
                    <span class="i-hugeicons-link"></span>
                  </button>
                  <button class="px-2 py-1 text-sm border rounded hover:bg-gray-100">
                    <span class="i-hugeicons-code"></span>
                  </button>
                  <button class="px-2 py-1 text-sm border rounded hover:bg-gray-100">
                    <span class="i-hugeicons-image"></span>
                  </button>
                </div>
                <textarea
                  class="w-full border rounded-md p-3 min-h-40 focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Describe your topic in detail. Include any relevant code, error messages, or screenshots."
                ></textarea>
              </div>
            </div>

            <div>
              <label class="block mb-1 font-medium">Tags</label>
              <input
                type="text"
                placeholder="Add tags separated by commas (e.g. javascript, vue, api)"
                class="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              >
              <div class="text-xs text-gray-500 mt-1">
                Add up to 5 tags to help categorize your topic and make it more discoverable
              </div>
            </div>

            <div class="flex items-center">
              <input type="checkbox" id="notify" class="mr-2" checked>
              <label for="notify" class="text-sm text-gray-600">
                Notify me when someone replies to this topic
              </label>
            </div>

            <div class="flex justify-end gap-2">
              <a href="/forum" class="px-4 py-2 border rounded-md hover:bg-gray-100">
                Cancel
              </a>
              <button class="px-4 py-2 bg-primary text-white rounded-md hover:opacity-90">
                Create Topic
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="border rounded-md p-4 bg-gray-50">
        <h3 class="font-medium mb-2">Forum Guidelines</h3>
        <ul class="list-disc list-inside text-sm text-gray-600 space-y-1">
          <li>Be respectful and courteous to other community members</li>
          <li>Search before posting to avoid duplicate topics</li>
          <li>Use descriptive titles that summarize your question or discussion</li>
          <li>Format code using the code formatting button for better readability</li>
          <li>Tag your topic appropriately to help others find it</li>
          <li>If you're asking for help, include relevant details like version numbers and error messages</li>
        </ul>
      </div>
    </div>
  </ForumLayout>
</template>

<script setup lang="ts">
import ForumLayout from '../../components/Forum/ForumLayout.vue'
import ForumBreadcrumb from '../../components/Forum/ForumBreadcrumb.vue'
</script>