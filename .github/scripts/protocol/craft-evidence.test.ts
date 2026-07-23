import { describe, expect, it } from 'bun:test'
import { craftEvidence, validateCraftEvidence } from './craft-evidence'

describe('Craft protocol evidence', () => {
  it('pins the full native lifecycle and release contract', () => {
    expect(validateCraftEvidence(craftEvidence)).toEqual([])
    expect(craftEvidence.lifecycleMatrix).toHaveLength(4)
    expect(craftEvidence.lifecycleOperations).toEqual(['install', 'launch', 'update', 'rollback', 'uninstall'])
  })

  it('rejects untraceable source and premature signing claims', () => {
    const invalid = structuredClone(craftEvidence) as unknown as typeof craftEvidence
    Object.assign(invalid.source, { tag: 'latest', revision: 'short' })
    Object.assign(invalid.release, { signing: 'enforced', notarization: 'enforced', blockedBy: '' })
    expect(validateCraftEvidence(invalid)).toEqual(expect.arrayContaining([
      'Craft tag does not match its version',
      'Craft revision is not a full commit SHA',
      'Craft signing/notarization cannot be promoted without retained release evidence',
      'Craft release blocker must be linked',
    ]))
  })
})
