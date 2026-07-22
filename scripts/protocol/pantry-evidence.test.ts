import { describe, expect, it } from 'bun:test'
import { pantryEvidence, validatePantryEvidence } from './pantry-evidence'

describe('Pantry protocol evidence', () => {
  it('pins both verified upstream contracts', () => {
    expect(validatePantryEvidence(pantryEvidence)).toEqual([])
    expect(pantryEvidence.contracts.map(contract => contract.id)).toEqual(['package-manager', 'registry'])
  })

  it('rejects an untraceable release or contract digest', () => {
    const invalid = structuredClone(pantryEvidence) as unknown as typeof pantryEvidence
    Object.assign(invalid.source, { tag: 'latest', revision: 'short' })
    Object.assign(invalid.contracts[0], { sha256: 'not-a-digest' })
    expect(validatePantryEvidence(invalid)).toEqual(expect.arrayContaining([
      'Pantry tag does not match its version',
      'Pantry revision is not a full commit SHA',
      'package-manager: invalid SHA-256 digest',
    ]))
  })
})
