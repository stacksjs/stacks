import type { Posts, StorePost } from '../../types/defaults'
import { useFetch, useStorage } from '@vueuse/core'

// Create a persistent posts array using VueUse's useStorage
const posts = useStorage<Posts[]>('posts', [])

const baseURL = 'http://localhost:3008'

// Basic fetch function to get all posts
async function fetchPosts() {
  const { error, data } = await useFetch(`${baseURL}/cms/posts`).get().json()

  const postsJson = data.value as Posts[]
  if (error.value) {
    console.error('Error fetching posts:', error.value)
    return []
  }

  // Ensure data is an array before assigning
  if (Array.isArray(data.value)) {
    posts.value = postsJson
    return data.value
  }
  else {
    console.error('Expected array of posts but received:', typeof data.value)
    return []
  }
}

async function createPost(post: Partial<StorePost>): Promise<Posts | null> {
  const { error, data } = await useFetch(`${baseURL}/cms/posts`)
    .post(JSON.stringify(post))
    .json()

  if (error.value) {
    console.error('Error creating post:', error.value)
    return null
  }

  const newPost = data.value as Posts
  if (newPost) {
    posts.value.unshift(newPost)
    return newPost
  }
  return null
}

async function updatePost(id: number, post: Partial<Posts>) {
  const { error, data } = await useFetch(`${baseURL}/cms/posts/${id}`)
    .patch(JSON.stringify({
      ...post,
      author_name: post.author_name,
      author_email: post.author_email,
    }))
    .json()

  if (error.value) {
    console.error('Error updating post:', error.value)
    return null
  }

  const updatedPost = data.value as Posts
  if (updatedPost) {
    const index = posts.value.findIndex(p => p.id === id)
    if (index !== -1) {
      posts.value[index] = updatedPost
    }
    return updatedPost
  }
  return null
}

async function deletePost(id: number) {
  const { error } = await useFetch(`${baseURL}/cms/posts/${id}`)
    .delete()
    .json()

  if (error.value) {
    console.error('Error deleting post:', error.value)
    return false
  }

  const index = posts.value.findIndex(p => p.id === id)
  if (index !== -1) {
    posts.value.splice(index, 1)
  }

  return true
}

// Export the composable
export function usePosts() {
  return {
    posts,
    fetchPosts,
    createPost,
    updatePost,
    deletePost,
  }
}
