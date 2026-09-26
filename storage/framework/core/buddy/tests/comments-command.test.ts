import { describe, expect, it } from 'bun:test'
import { commenter, excerpt, formatCommentRow } from '../src/commands/comments'

/**
 * `buddy comments:list` output. The listing is what an operator reads before
 * deleting something for good, so it has to name the right comment and must
 * not print the one column readers were told stays private.
 */
describe('buddy comments:list formatting', () => {
  const row = {
    id: 7,
    title: '',
    body: 'Great post!\n\nThanks for   writing it.',
    status: 'approved',
    commentables_id: 3,
    commentables_type: 'posts',
    author_name: 'Ada',
    author_email: 'ada@example.com',
    user_id: null,
  }

  it('flattens the body onto one line', () => {
    expect(excerpt(row.body)).toBe('Great post! Thanks for writing it.')
  })

  it('truncates a long body with an ellipsis at the width', () => {
    const cut = excerpt('x'.repeat(100), 20)
    expect(cut).toHaveLength(20)
    expect(cut.endsWith('…')).toBe(true)
  })

  it('names the guest, then the account, then nobody', () => {
    expect(commenter({ author_name: 'Ada', user_id: 4 })).toBe('Ada')
    expect(commenter({ author_name: null, user_id: 4 })).toBe('user #4')
    expect(commenter({ author_name: null, user_id: null })).toBe('anonymous')
  })

  it('shows the id, status and owner, and never the email', () => {
    const line = formatCommentRow(row)
    expect(line).toContain('7')
    expect(line).toContain('approved')
    expect(line).toContain('posts#3')
    expect(line).toContain('Ada')
    expect(line).not.toContain('ada@example.com')
  })
})
