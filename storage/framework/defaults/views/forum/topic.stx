<template>
  <ForumLayout route="forum-topic">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div class="lg:col-span-2">
        <ForumBreadcrumb :items="[
          { label: 'Forum', link: '/forum' },
          { label: 'Technical Support', link: '/forum/category/support/installation' },
          { label: 'How to implement authentication in a new Stacks.js project?', link: '/forum/topic/1' }
        ]" />

        <ForumPost
          id="1"
          authorName="JohnDoe"
          authorAvatar="/images/avatars/default.png"
          createdAt="2 hours ago"
          :likeCount="7"
          isOriginalPost
          title="How to implement authentication in a new Stacks.js project?"
        >
          <p>Hello everyone,</p>
          <p>I'm trying to implement authentication in my new Stacks.js project but I'm having some issues with the middleware. Here's what I've tried so far:</p>

          <pre class="bg-gray-100 p-4 rounded-md my-4"><code>
// My authentication middleware
function authMiddleware(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}
          </code></pre>

          <p>But when I try to use this middleware, I get the following error:</p>

          <blockquote class="border-l-4 border-gray-300 pl-4 italic my-4">
            Error: req.session is undefined
          </blockquote>

          <p>Any help would be greatly appreciated! I'm using Stacks.js v1.8.2 with Express 4.18.0.</p>
        </ForumPost>

        <ForumPost
          id="2"
          authorName="ExpertUser"
          authorAvatar="/images/avatars/default.png"
          createdAt="1 hour ago"
          :likeCount="3"
        >
          <p>Hi <a href="/forum/profile/johndoe" class="text-primary hover:underline">@JohnDoe</a>,</p>
          <p>It looks like you haven't set up the session middleware correctly. You need to add it before your authentication middleware:</p>

          <pre class="bg-gray-100 p-4 rounded-md my-4"><code>
const session = require('express-session');

app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Now your auth middleware will work
app.use(authMiddleware);
          </code></pre>

          <p>Also, make sure you've installed the express-session package:</p>

          <pre class="bg-gray-100 p-4 rounded-md my-4"><code>
npm install express-session
# or with bun
bun add express-session
          </code></pre>

          <p>Hope this helps!</p>
        </ForumPost>

        <ForumPost
          id="3"
          authorName="JohnDoe"
          authorAvatar="/images/avatars/default.png"
          createdAt="30 minutes ago"
          :likeCount="2"
        >
          <p>Thank you so much, <a href="/forum/profile/expertuser" class="text-primary hover:underline">@ExpertUser</a>! That fixed my issue.</p>
          <p>I completely forgot to set up the session middleware. Your solution works perfectly!</p>
          <p>For anyone else who might run into this issue, I also had to install the express-session types for TypeScript:</p>

          <pre class="bg-gray-100 p-4 rounded-md my-4"><code>
npm install --save-dev @types/express-session
# or with bun
bun add -d @types/express-session
          </code></pre>
        </ForumPost>

        <ForumReplyForm />

        <ForumPagination :currentPage="1" :totalPages="1" />
      </div>

      <div class="lg:col-span-1">
        <ForumSidebar
          :stats="{
            topics: 540,
            posts: 3287,
            members: 1245,
            newestMember: 'NewUser123'
          }"
          :popularTopics="[
            {
              id: 1,
              title: 'How to implement authentication in a new Stacks.js project?',
              link: '/forum/topic/1',
              replyCount: 3,
              viewCount: 45
            },
            {
              id: 2,
              title: 'Best practices for database migrations in Stacks.js',
              link: '/forum/topic/3',
              replyCount: 15,
              viewCount: 128
            },
            {
              id: 3,
              title: 'Introducing myself to the community!',
              link: '/forum/topic/2',
              replyCount: 8,
              viewCount: 32
            }
          ]"
          :onlineUsers="[
            { id: 1, name: 'JohnDoe', avatar: '/images/avatars/default.png' },
            { id: 2, name: 'DatabaseGuru', avatar: '/images/avatars/default.png' },
            { id: 3, name: 'NewUser123', avatar: '/images/avatars/default.png' },
            { id: 4, name: 'ExpertUser', avatar: '/images/avatars/default.png' },
            { id: 5, name: 'StacksMaster', avatar: '/images/avatars/default.png' }
          ]"
        />
      </div>
    </div>
  </ForumLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import ForumLayout from '../../components/Forum/ForumLayout.vue'
import ForumBreadcrumb from '../../components/Forum/ForumBreadcrumb.vue'
import ForumPost from '../../components/Forum/ForumPost.vue'
import ForumReplyForm from '../../components/Forum/ForumReplyForm.vue'
import ForumSidebar from '../../components/Forum/ForumSidebar.vue'
import ForumPagination from '../../components/Forum/ForumPagination.vue'

// Get the topic ID from the route params
const route = useRoute()
const topicId = computed(() => Number(route.params.id) || 0)

// In a real app, we would fetch the topic data based on the ID
// For now, we'll simulate it with some static data
const topic = computed(() => {
  // Sample topic data
  return {
    id: topicId.value,
    title: 'How to implement authentication in a new Stacks.js project?',
    authorName: 'JohnDoe',
    authorAvatar: '/images/avatars/default.png',
    createdAt: '2 hours ago',
    content: `
      <p>Hello everyone,</p>
      <p>I'm trying to implement authentication in my new Stacks.js project but I'm having some issues with the middleware. Has anyone successfully implemented authentication with JWT tokens?</p>
      <p>Here's what I've tried so far:</p>
      <pre><code>// My authentication middleware
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};</code></pre>
      <p>But I'm getting an error when trying to access protected routes. Any help would be appreciated!</p>
    `,
    category: 'Technical Support',
    categoryLink: '/forum/category/support/installation',
    viewCount: 45,
    replyCount: 3,
    likeCount: 7
  }
})
</script>