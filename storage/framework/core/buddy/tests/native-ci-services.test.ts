import { expect, test } from 'bun:test'
import { configureCiServices } from '../../../../../.github/scripts/configure-ci-services'

const serviceEnvironment = {
  POSTGRES_SERVICE_VERSION: '17.11',
  MYSQL_SERVICE_VERSION: '26.7.0',
  REDIS_SERVICE_VERSION: '8.8.0',
  DYNAMODB_SERVICE_VERSION: '3.3.0',
  POSTGRES_URL: 'postgres://postgres:postgres-job-secret@127.0.0.1:45123/pantry_ci',
  MYSQL_URL: 'mysql://pantry:mysql-job-secret@127.0.0.1:45124/pantry_ci?ssl=true',
  REDIS_URL: 'redis://default:redis-job-secret@127.0.0.1:45125/0',
  DYNAMODB_URL: 'http://127.0.0.1:45126',
  DYNAMODB_REGION: 'us-east-1',
  DYNAMODB_ACCESS_KEY_ID: 'PantryLocalOnly',
  DYNAMODB_SECRET_ACCESS_KEY: 'PantryLocalSecret',
}

test('all ordinary test processes use the action\'s private services', () => {
  expect(configureCiServices(serviceEnvironment)).toEqual({
    STACKS_TEST_MYSQL_URL: 'mysql://pantry:mysql-job-secret@127.0.0.1:45124/pantry_ci?ssl=true',
    STACKS_TEST_POSTGRES_URL: 'postgres://postgres:postgres-job-secret@127.0.0.1:45123/pantry_ci',
    STACKS_TEST_REDIS_URL: 'redis://default:redis-job-secret@127.0.0.1:45125/0',
    AWS_DYNAMODB_ENDPOINT: 'http://127.0.0.1:45126',
    AWS_ENDPOINT_URL: 'http://127.0.0.1:45126',
    AWS_REGION: 'us-east-1',
    AWS_DEFAULT_REGION: 'us-east-1',
    AWS_ACCESS_KEY_ID: 'PantryLocalOnly',
    AWS_SECRET_ACCESS_KEY: 'PantryLocalSecret',
    AWS_SESSION_TOKEN: '',
  })
})

test('missing action output fails before database tests can silently skip', () => {
  for (const name of Object.keys(serviceEnvironment)) {
    expect(() => configureCiServices({ ...serviceEnvironment, [name]: undefined }), name).toThrow()
  }
})

test('a stale provider version fails before tests run against a different service', () => {
  for (const name of ['POSTGRES_SERVICE_VERSION', 'MYSQL_SERVICE_VERSION', 'REDIS_SERVICE_VERSION', 'DYNAMODB_SERVICE_VERSION']) {
    expect(() => configureCiServices({ ...serviceEnvironment, [name]: '0.0.1' }), name).toThrow('version mismatch')
  }
})

test('fixed default ports, remote services and unauthenticated SQL/Redis are rejected', () => {
  const invalid = {
    POSTGRES_URL: [
      'postgres://postgres:secret@127.0.0.1:5432/pantry_ci',
      'postgres://postgres:secret@example.com:45123/pantry_ci',
      'postgres://127.0.0.1:45123/pantry_ci',
    ],
    MYSQL_URL: [
      'mysql://pantry:secret@127.0.0.1:3306/pantry_ci?ssl=true',
      'mysql://pantry:secret@127.0.0.1:45124/pantry_ci',
      'mysql://pantry:secret@127.0.0.1:45124/pantry_ci?ssl=false',
    ],
    REDIS_URL: [
      'redis://default:secret@127.0.0.1:6379/0',
      'redis://127.0.0.1:45125/0',
    ],
    DYNAMODB_URL: [
      'http://127.0.0.1:8000',
      'https://dynamodb.us-east-1.amazonaws.com',
      'http://user:secret@127.0.0.1:45126',
      'http://127.0.0.1:45126/wrong-target',
    ],
  }
  for (const [name, values] of Object.entries(invalid)) {
    for (const value of values)
      expect(() => configureCiServices({ ...serviceEnvironment, [name]: value }), `${name}: ${value}`).toThrow()
  }
})

test('service credentials cannot inject another GitHub environment entry', () => {
  expect(() => configureCiServices({ ...serviceEnvironment, DYNAMODB_SECRET_ACCESS_KEY: 'secret\nOTHER=value' })).toThrow('invalid')
})
