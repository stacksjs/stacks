import { expect, test } from 'bun:test'
import { projectDocumentsFromTrait } from '../src/define-model'

interface TrainingDocument { id: string, title: string }
const document: TrainingDocument = { id: '1', title: 'Training' }

test('closed-interface search projections preserve their fields in single and batch paths', async () => {
  expect(await projectDocumentsFromTrait([{ id: 1 }], { shape: () => document })).toEqual([document])
  expect(await projectDocumentsFromTrait([{ id: 1 }], { shapeMany: async () => [document] })).toEqual([document])
})

test('invalid projection values and projection failures are reported', async () => {
  const malformed = JSON.parse('["not a document"]')
  await expect(projectDocumentsFromTrait([{ id: 1 }], { shapeMany: () => malformed })).rejects.toThrow('document object')
  await expect(projectDocumentsFromTrait([{ id: 1 }], { shape: () => { throw new Error('projection failed') } })).rejects.toThrow('projection failed')
})
