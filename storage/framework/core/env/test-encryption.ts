/**
 * Simple test script for encryption/decryption functionality
 */

import { decryptValue, encryptValue, generateKeypair } from './src/crypto'

console.log('Testing encryption/decryption...\n')

// 1. Generate a keypair
console.log('1. Generating keypair...')
const { publicKey, privateKey } = generateKeypair()
console.log('   Public key:', publicKey.slice(0, 16) + '...')
console.log('   Private key:', privateKey.slice(0, 16) + '...')
console.log('   ✓ Keypair generated\n')

// 2. Encrypt a value
const testValue = 'my-super-secret-password-123'
console.log('2. Encrypting value:', testValue)
const encrypted = encryptValue(testValue, publicKey)
console.log('   Encrypted:', encrypted.slice(0, 50) + '...')
console.log('   ✓ Value encrypted\n')

// 3. Decrypt the value
console.log('3. Decrypting value...')
const decrypted = decryptValue(encrypted, privateKey)
console.log('   Decrypted:', decrypted)
console.log('   ✓ Value decrypted\n')

// 4. Verify
if (decrypted === testValue) {
  console.log('✅ Success! Encryption/decryption works correctly')
  console.log('\nNext steps:')
  console.log('- Run: buddy env:set TEST_SECRET "my-secret-value"')
  console.log('- Run: buddy env:get TEST_SECRET')
  console.log('- Run: buddy env:encrypt')
  console.log('- Run: buddy env:decrypt')
}
else {
  console.error('❌ Error: Decrypted value does not match original')
  console.error('Expected:', testValue)
  console.error('Got:', decrypted)
  process.exit(1)
}
