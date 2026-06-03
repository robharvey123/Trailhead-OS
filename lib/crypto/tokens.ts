import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// AES-256-GCM token encryption. The key comes from APP_ENCRYPTION_KEY (32 bytes,
// base64). Stored ciphertext is base64(iv[12] | tag[16] | ciphertext) as TEXT —
// simpler to round-trip through supabase-js than a bytea column.
//
// IMPORTANT: this module must NOT throw at import time. The Google integration
// is live; if the key is unset or malformed we fall back to plaintext storage
// (see lib/google/oauth.ts) rather than breaking calendar/mail sync.

function getKey(): Buffer | null {
  const raw = process.env.APP_ENCRYPTION_KEY
  if (!raw) return null
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('APP_ENCRYPTION_KEY must decode to 32 bytes (generate with: openssl rand -base64 32)')
  return key
}

/** True only when a valid 32-byte key is configured. Never throws. */
export function tokenEncryptionReady(): boolean {
  try {
    return getKey() !== null
  } catch {
    return false
  }
}

/** Encrypt to base64(iv|tag|ciphertext). Throws if no valid key — guard with tokenEncryptionReady(). */
export function encryptToken(plain: string): string {
  const key = getKey()
  if (!key) throw new Error('APP_ENCRYPTION_KEY is not set')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

/** Decrypt base64(iv|tag|ciphertext). Throws if no valid key or the blob is tampered. */
export function decryptToken(blobB64: string): string {
  const key = getKey()
  if (!key) throw new Error('APP_ENCRYPTION_KEY is not set')
  const blob = Buffer.from(blobB64, 'base64')
  const iv = blob.subarray(0, 12)
  const tag = blob.subarray(12, 28)
  const enc = blob.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}
