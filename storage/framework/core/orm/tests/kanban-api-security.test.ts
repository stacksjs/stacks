import { describe, expect, it } from 'bun:test'
import Board from '../../../defaults/app/Models/Board'
import BoardColumn from '../../../defaults/app/Models/BoardColumn'
import Card from '../../../defaults/app/Models/Card'
import CardComment from '../../../defaults/app/Models/CardComment'
import Label from '../../../defaults/app/Models/Label'

describe('kanban model API security', () => {
  it.each([
    ['board', Board],
    ['board column', BoardColumn],
    ['card', Card],
    ['card comment', CardComment],
    ['label', Label],
  ])('protects every %s API route', (_kind, model) => {
    expect(model.traits.useApi).toMatchObject({
      middleware: ['auth'],
    })
  })
})
