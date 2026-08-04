import { describe, expect, it } from 'bun:test'
import routes from '../../../defaults/app/Routes'

describe('default package-project routes', () => {
  it('only registers route files shipped by the project scaffold', () => {
    expect(routes).toEqual({ api: 'api' })
  })
})
