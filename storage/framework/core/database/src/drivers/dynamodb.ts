import { Table } from 'dynamodb-toolbox/table'
import { Entity } from 'dynamodb-toolbox/entity'
import { item } from 'dynamodb-toolbox/schema/item'
import { string } from 'dynamodb-toolbox/schema/string'

// Define the main table
const AppTable: Table = new Table({
  name: 'app-table',
  partitionKey: {
    name: 'pk',
    type: 'string'
  },
  sortKey: {
    name: 'sk',
    type: 'string'
  },
  indexes: {
    GSI1: {
      type: 'global',
      partitionKey: {
        name: 'gsi1pk',
        type: 'string'
      },
      sortKey: {
        name: 'gsi1sk',
        type: 'string'
      }
    },
    GSI2: {
      type: 'global',
      partitionKey: {
        name: 'gsi2pk',
        type: 'string'
      },
      sortKey: {
        name: 'gsi2sk',
        type: 'string'
      }
    }
  }
})

// User Entity
const userSchema = item({
  id: string().required(),
  name: string().required(),
  email: string().required(),
  job_title: string(),
  password: string().required(),
  public_passkey: string(),
  stripe_id: string(),
  uuid: string(),
  created_at: string(),
  updated_at: string()
})

const UserEntity: Entity = new Entity({
  name: 'User',
  table: AppTable,
  schema: userSchema,
  computeKey: (keyInput: any) => ({
    pk: `USER#${keyInput.id}`,
    sk: `USER#${keyInput.id}`
  })
})

// Post Entity
const postSchema = item({
  id: string().required(),
  user_id: string().required(),
  title: string().required(),
  body: string().required(),
  created_at: string(),
  updated_at: string()
})

const PostEntity: Entity = new Entity({
  name: 'Post',
  table: AppTable,
  schema: postSchema,
  computeKey: (keyInput: any) => ({
    pk: `POST#${keyInput.id}`,
    sk: `POST#${keyInput.id}`
  })
})

// Helper functions for key generation
const generateKeys = {
  user: (id: string) => ({
    pk: `USER#${id}`,
    sk: `USER#${id}`,
    gsi1pk: `USER#EMAIL`,
    gsi1sk: `USER#${id}`,
    gsi2pk: `USER#NAME`,
    gsi2sk: `USER#${id}`
  }),
  post: (id: string, userId: string) => ({
    pk: `POST#${id}`,
    sk: `POST#${id}`,
    gsi1pk: `USER#${userId}`,
    gsi1sk: `POST#${id}`
  })
}

export {
  AppTable,
  UserEntity,
  PostEntity,
  generateKeys,
}
