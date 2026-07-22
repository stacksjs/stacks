# Environment encryption security model

Status: experimental pending RFC ratification and independent cryptographic
review ([#2061](https://github.com/stacksjs/stacks/issues/2061)). This document
narrows the guarantee; it is not a certification.

## Assets and trust boundaries

The protected asset is an environment value while its ciphertext is stored in a
repository or another location readable by parties who do not hold the matching
private key. The trusted path includes the machine that encrypts, the private-key
secret store, CI job, deployment transport, deployment host, and runtime process.
Compromise of any host while it handles plaintext or the private key is outside
the envelope's protection.

Version 2 provides recipient confidentiality with ephemeral-static X25519 and
authenticated encryption with AES-256-GCM. HKDF-SHA-256 separates the shared
secret into a per-value key. The ephemeral public key, salt, and nonce are bound
as additional authenticated data. Modified metadata, tag, or ciphertext; a wrong
key; and malformed input are rejected without including secret material in the
error.

It does not provide sender authentication, access control, runtime memory
protection, hardware-backed custody, audit logs, automatic revocation, protection
against a malicious dependency or CI step, or recovery after a private key is
lost. Recipient-private-key compromise permits decryption of previously retained
version 2 envelopes; the design does not promise forward secrecy against that
event.

## Key lifecycle

- Keep `.env.keys` out of version control and restrict it to the operator account.
- Put deployment private keys in the platform's encrypted secret store. The
  public key may accompany ciphertext.
- Generate a separate pair per environment and security boundary.
- Rotate after suspected exposure, operator departure, CI boundary change, or
  according to the application's cryptoperiod.
- Retain the prior ciphertext and matching key in an approved recovery system
  until a canary verifies the new generation. Do not mix ciphertext and keys from
  different generations.
- Revoke the old CI/deployment secret after verification and securely remove
  local recovery copies. A lost key has no recovery path.

`buddy env:rotate` decrypts in memory, prepares both replacement files before
renaming either, and restores the original environment file if the key-file
rename fails. It does not intentionally write plaintext to disk. Cross-file
replacement cannot be globally atomic, so stop processes that read `.env.keys`
during rotation and retain an external rollback copy.

## Legacy migration

The unversioned format used a hash of random private bytes as a so-called public
key, then derived its AES key from that public value. It authenticated ciphertext
but did not provide asymmetric confidentiality because the public value was
sufficient to derive the encryption key.

The library keeps a legacy read path solely so `buddy env:rotate` can migrate old
values. It refuses new encryption with a legacy public key. After rotation:

1. confirm every encrypted value begins `encrypted:v2:`;
2. update the runtime/CI private key to `x25519-private:...`;
3. deploy a canary and verify configuration startup;
4. revoke and remove the legacy key;
5. retain no broad production claim until RFC 0005 and external review complete.

Rollback requires restoring the entire old encrypted file and its matching old
private key together. Never reintroduce the legacy public key for new writes.
