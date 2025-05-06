import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { destroy } from '../commentables/destroy'
import { fetchCommentById } from '../commentables/fetch'
import { store } from '../commentables/store'
import { update } from '../commentables/update'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Comment Module', () => {
  describe('store', () => {
    it('should create a new comment in the database', async () => {
      const commentData = {
        title: 'Great Post!',
        body: 'This is a very insightful article.',
        status: 'approved',
        user_id: 1,
        commentables_id: 1,
        commentables_type: 'posts',
      }

      const comment = await store(commentData)

      expect(comment).toBeDefined()
      expect(comment?.title).toBe('Great Post!')
      expect(comment?.body).toBe('This is a very insightful article.')
      expect(comment?.status).toBe('approved')
      expect(comment?.user_id).toBe(1)
      expect(comment?.commentables_id).toBe(1)
      expect(comment?.commentables_type).toBe('posts')

      const commentId = comment?.id !== undefined ? Number(comment.id) : undefined

      if (commentId) {
        const fetchedComment = await fetchCommentById(commentId)
        expect(fetchedComment).toBeDefined()
        expect(fetchedComment?.id).toBe(commentId)
      }
    })

    it('should create multiple comments for the same post', async () => {
      const firstComment = await store({
        title: 'First Comment',
        body: 'First comment on this post',
        status: 'approved',
        user_id: 1,
        commentables_id: 1,
        commentables_type: 'posts',
      })

      const secondComment = await store({
        title: 'Second Comment',
        body: 'Second comment on this post',
        status: 'approved',
        user_id: 2,
        commentables_id: 1,
        commentables_type: 'posts',
      })

      expect(firstComment).toBeDefined()
      expect(secondComment).toBeDefined()
      expect(firstComment?.commentables_id).toBe(secondComment?.commentables_id)
      expect(firstComment?.commentables_type).toBe(secondComment?.commentables_type)
      expect(firstComment?.user_id).not.toBe(secondComment?.user_id)
    })

    it('should throw an error when trying to create a comment with invalid data', async () => {
      const commentData = {
        title: '', // Empty title should fail
        body: '', // Empty body should fail
        status: 'invalid_status',
        user_id: -1,
        commentables_id: -1,
        commentables_type: '',
      }

      try {
        await store(commentData)
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
      }
    })

    it('should handle different comment statuses', async () => {
      // Test approved comment
      const approvedComment = await store({
        title: 'Approved Comment',
        body: 'This is an approved comment',
        status: 'approved',
        user_id: 1,
        commentables_id: 1,
        commentables_type: 'posts',
      })

      expect(approvedComment?.status).toBe('approved')

      // Test rejected comment
      const rejectedComment = await store({
        title: 'Rejected Comment',
        body: 'This is a rejected comment',
        status: 'rejected',
        user_id: 1,
        commentables_id: 1,
        commentables_type: 'posts',
      })

      expect(rejectedComment?.status).toBe('rejected')
    })
  })

  describe('fetchById', () => {
    it('should fetch a comment by ID', async () => {
      const commentData = {
        title: 'Test Comment',
        body: 'This is a test comment',
        status: 'approved',
        user_id: 1,
        commentables_id: 1,
        commentables_type: 'posts',
      }

      const comment = await store(commentData)
      const commentId = comment?.id !== undefined ? Number(comment.id) : undefined

      expect(commentId).toBeDefined()
      if (!commentId) {
        throw new Error('Failed to create test comment')
      }

      const fetchedComment = await fetchCommentById(commentId)

      expect(fetchedComment).toBeDefined()
      expect(fetchedComment?.id).toBe(commentId)
      expect(fetchedComment?.title).toBe('Test Comment')
      expect(fetchedComment?.body).toBe('This is a test comment')
      expect(fetchedComment?.status).toBe('approved')
    })
  })

  describe('update', () => {
    it('should update an existing comment', async () => {
      const commentData = {
        title: 'Original Comment',
        body: 'Original comment body',
        status: 'pending',
        user_id: 1,
        commentables_id: 1,
        commentables_type: 'posts',
      }

      const comment = await store(commentData)
      const commentId = comment?.id !== undefined ? Number(comment.id) : undefined

      expect(commentId).toBeDefined()
      if (!commentId) {
        throw new Error('Failed to create test comment')
      }

      const updatedComment = await update(commentId, {
        title: 'Updated Comment',
        body: 'Updated comment body',
        status: 'approved',
      })

      expect(updatedComment).toBeDefined()
      expect(updatedComment?.id).toBe(commentId)
      expect(updatedComment?.title).toBe('Updated Comment')
      expect(updatedComment?.body).toBe('Updated comment body')
      expect(updatedComment?.status).toBe('approved')
    })

    it('should throw an error when trying to update a comment with invalid data', async () => {
      const commentData = {
        title: 'Test Comment',
        body: 'Test comment body',
        status: 'pending',
        user_id: 1,
        commentables_id: 1,
        commentables_type: 'posts',
      }

      const comment = await store(commentData)
      const commentId = comment?.id !== undefined ? Number(comment.id) : undefined

      if (!commentId) {
        throw new Error('Failed to create test comment')
      }

      try {
        await update(commentId, {
          title: '', // Empty title should fail
          body: '', // Empty body should fail
          status: 'invalid_status',
        })
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
      }
    })

    it('should update comment status', async () => {
      const commentData = {
        title: 'Status Test Comment',
        body: 'Testing status changes',
        status: 'pending',
        user_id: 1,
        commentables_id: 1,
        commentables_type: 'posts',
      }

      const comment = await store(commentData)
      const commentId = comment?.id !== undefined ? Number(comment.id) : undefined

      if (!commentId) {
        throw new Error('Failed to create test comment')
      }

      // Update to approved
      const approvedComment = await update(commentId, {
        status: 'approved',
      })

      expect(approvedComment?.status).toBe('approved')

      // Update to rejected
      const rejectedComment = await update(commentId, {
        status: 'rejected',
      })

      expect(rejectedComment?.status).toBe('rejected')
    })
  })

  describe('destroy', () => {
    it('should delete a comment from the database', async () => {
      const commentData = {
        title: 'Comment to Delete',
        body: 'This comment will be deleted',
        status: 'approved',
        user_id: 1,
        commentables_id: 1,
        commentables_type: 'posts',
      }

      const comment = await store(commentData)
      const commentId = comment?.id !== undefined ? Number(comment.id) : undefined

      expect(commentId).toBeDefined()
      if (!commentId) {
        throw new Error('Failed to create test comment')
      }

      let fetchedComment = await fetchCommentById(commentId)
      expect(fetchedComment).toBeDefined()

      await destroy(commentId)

      fetchedComment = await fetchCommentById(commentId)
      expect(fetchedComment).toBeUndefined()
    })

    it('should throw an error when trying to delete a non-existent comment', async () => {
      const nonExistentId = 99999999

      try {
        await destroy(nonExistentId)
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
        expect((error as Error).message).toContain(`Comment with ID ${nonExistentId} not found`)
      }
    })
  })
})
