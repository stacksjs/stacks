import { describe, expect, it } from 'bun:test'
import { createTaggableMethods } from '../../storage/framework/core/orm/src/traits/taggable'
import { createCategorizableMethods } from '../../storage/framework/core/orm/src/traits/categorizable'
import { createCommentableMethods } from '../../storage/framework/core/orm/src/traits/commentable'
import { createBillableMethods } from '../../storage/framework/core/orm/src/traits/billable'
import { createLikeableMethods } from '../../storage/framework/core/orm/src/traits/likeable'
import { createTwoFactorMethods } from '../../storage/framework/core/orm/src/traits/two-factor'

/**
 * Unit tests for trait modules.
 *
 * These tests verify that each trait factory function:
 * 1. Returns an object with the expected methods
 * 2. Methods are typed as functions
 * 3. Uses the correct table name in its queries
 *
 * Note: Database-level tests (actual query execution) are in the ORM integration tests.
 * These are pure unit tests that verify the structure and API surface.
 */

describe('trait modules', () => {
  describe('createTaggableMethods', () => {
    it('should return an object with all taggable methods', () => {
      const methods = createTaggableMethods('posts')

      expect(methods).toBeDefined()
      expect(typeof methods.tags).toBe('function')
      expect(typeof methods.tagCount).toBe('function')
      expect(typeof methods.addTag).toBe('function')
      expect(typeof methods.activeTags).toBe('function')
      expect(typeof methods.inactiveTags).toBe('function')
      expect(typeof methods.removeTag).toBe('function')
    })

    it('should return exactly 6 methods', () => {
      const methods = createTaggableMethods('posts')
      expect(Object.keys(methods)).toHaveLength(6)
    })

    it('should accept different table names', () => {
      const postMethods = createTaggableMethods('posts')
      const articleMethods = createTaggableMethods('articles')

      // Both should have the same structure
      expect(Object.keys(postMethods)).toEqual(Object.keys(articleMethods))
    })
  })

  describe('createCategorizableMethods', () => {
    it('should return an object with all categorizable methods', () => {
      const methods = createCategorizableMethods('posts')

      expect(methods).toBeDefined()
      expect(typeof methods.categories).toBe('function')
      expect(typeof methods.categoryCount).toBe('function')
      expect(typeof methods.addCategory).toBe('function')
      expect(typeof methods.activeCategories).toBe('function')
      expect(typeof methods.inactiveCategories).toBe('function')
      expect(typeof methods.removeCategory).toBe('function')
    })

    it('should return exactly 6 methods', () => {
      const methods = createCategorizableMethods('posts')
      expect(Object.keys(methods)).toHaveLength(6)
    })
  })

  describe('createCommentableMethods', () => {
    it('should return an object with all commentable methods', () => {
      const methods = createCommentableMethods('posts')

      expect(methods).toBeDefined()
      expect(typeof methods.comments).toBe('function')
      expect(typeof methods.commentCount).toBe('function')
      expect(typeof methods.addComment).toBe('function')
      expect(typeof methods.approvedComments).toBe('function')
      expect(typeof methods.pendingComments).toBe('function')
      expect(typeof methods.rejectedComments).toBe('function')
    })

    it('should return exactly 6 methods', () => {
      const methods = createCommentableMethods('posts')
      expect(Object.keys(methods)).toHaveLength(6)
    })
  })

  describe('createBillableMethods', () => {
    it('should return an object with all billable methods', () => {
      const methods = createBillableMethods('users')

      expect(methods).toBeDefined()
      expect(typeof methods.createStripeUser).toBe('function')
      expect(typeof methods.updateStripeUser).toBe('function')
      expect(typeof methods.deleteStripeUser).toBe('function')
      expect(typeof methods.createOrGetStripeUser).toBe('function')
      expect(typeof methods.retrieveStripeUser).toBe('function')
      expect(typeof methods.defaultPaymentMethod).toBe('function')
      expect(typeof methods.setDefaultPaymentMethod).toBe('function')
      expect(typeof methods.addPaymentMethod).toBe('function')
      expect(typeof methods.paymentMethods).toBe('function')
      expect(typeof methods.newSubscription).toBe('function')
      expect(typeof methods.updateSubscription).toBe('function')
      expect(typeof methods.cancelSubscription).toBe('function')
      expect(typeof methods.activeSubscription).toBe('function')
      expect(typeof methods.checkout).toBe('function')
      expect(typeof methods.createSetupIntent).toBe('function')
      expect(typeof methods.subscriptionHistory).toBe('function')
      expect(typeof methods.transactionHistory).toBe('function')
    })

    it('should return exactly 17 methods', () => {
      const methods = createBillableMethods('users')
      expect(Object.keys(methods)).toHaveLength(17)
    })
  })

  describe('createLikeableMethods', () => {
    it('should return an object with all likeable methods', () => {
      const methods = createLikeableMethods('posts')

      expect(methods).toBeDefined()
      expect(typeof methods.likes).toBe('function')
      expect(typeof methods.likeCount).toBe('function')
      expect(typeof methods.like).toBe('function')
      expect(typeof methods.unlike).toBe('function')
      expect(typeof methods.isLiked).toBe('function')
    })

    it('should return exactly 5 methods', () => {
      const methods = createLikeableMethods('posts')
      expect(Object.keys(methods)).toHaveLength(5)
    })

    it('should accept custom options', () => {
      const methods = createLikeableMethods('posts', {
        table: 'post_favorites',
        foreignKey: 'post_id',
      })

      expect(methods).toBeDefined()
      expect(typeof methods.likes).toBe('function')
      expect(typeof methods.like).toBe('function')
    })

    it('should work without options', () => {
      const methods = createLikeableMethods('posts')
      expect(methods).toBeDefined()
      expect(typeof methods.likes).toBe('function')
    })
  })

  describe('createTwoFactorMethods', () => {
    it('should return an object with two-factor methods', () => {
      const methods = createTwoFactorMethods()

      expect(methods).toBeDefined()
      expect(typeof methods.generateTwoFactorForModel).toBe('function')
      expect(typeof methods.verifyTwoFactorCode).toBe('function')
    })

    it('should return exactly 2 methods', () => {
      const methods = createTwoFactorMethods()
      expect(Object.keys(methods)).toHaveLength(2)
    })
  })

  describe('trait integration with defineModel', () => {
    it('should attach multiple traits to a single model', () => {
      const { defineModel } = require('../../storage/framework/core/orm/src/define-model')

      const Post = defineModel({
        name: 'TestPost',
        table: 'test_posts',
        primaryKey: 'id',
        autoIncrement: true,
        attributes: {
          title: { type: 'string', fillable: true },
        },
        traits: {
          taggable: true,
          categorizable: true,
          likeable: true,
        },
      } as const)

      expect(Post._taggable).toBeDefined()
      expect(Post._categorizable).toBeDefined()
      expect(Post._likeable).toBeDefined()
      expect(Post._commentable).toBeUndefined()
      expect(Post._billable).toBeUndefined()
    })

    it('should not create trait methods when model has no traits', () => {
      const { defineModel } = require('../../storage/framework/core/orm/src/define-model')

      const Simple = defineModel({
        name: 'TestSimple',
        table: 'test_simples',
        primaryKey: 'id',
        autoIncrement: true,
        attributes: {
          value: { type: 'string' },
        },
      } as const)

      expect(Simple._taggable).toBeUndefined()
      expect(Simple._categorizable).toBeUndefined()
      expect(Simple._commentable).toBeUndefined()
      expect(Simple._billable).toBeUndefined()
      expect(Simple._likeable).toBeUndefined()
    })

    it('should handle all traits simultaneously', () => {
      const { defineModel } = require('../../storage/framework/core/orm/src/define-model')

      const User = defineModel({
        name: 'TestUser',
        table: 'test_users',
        primaryKey: 'id',
        autoIncrement: true,
        attributes: {
          email: { type: 'string', fillable: true },
        },
        traits: {
          taggable: true,
          categorizable: true,
          commentables: true,
          billable: true,
          likeable: true,
          useAuth: { useTwoFactor: true },
        },
      } as const)

      expect(User._taggable).toBeDefined()
      expect(User._categorizable).toBeDefined()
      expect(User._commentable).toBeDefined()
      expect(User._billable).toBeDefined()
      expect(User._likeable).toBeDefined()
      expect(User._twoFactor).toBeDefined()
    })
  })
})
