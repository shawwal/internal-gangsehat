import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }
  return Buffer.from(key, 'hex')
}

export function encrypt(text: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // Format: iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

function isEncryptedFormat(text: string): boolean {
  const parts = text.split(':')
  if (parts.length !== 3) return false
  // Check if parts look like hex strings (iv and authTag should be 32 hex chars each for 16 bytes)
  const hexPattern = /^[0-9a-fA-F]+$/
  return parts[0].length === 32 && parts[1].length === 32 && hexPattern.test(parts[0]) && hexPattern.test(parts[1])
}

// Check if a string looks like base64 encoded data
function isBase64(text: string): boolean {
  // Base64 pattern: alphanumeric + / and = for padding
  const base64Pattern = /^[A-Za-z0-9+/]+=*$/
  // Must be at least 4 chars and divisible by 4 (with padding)
  if (text.length < 4) return false
  return base64Pattern.test(text)
}

// Try to decode base64, return null if it fails or doesn't look like valid decoded text
function tryDecodeBase64(text: string): string | null {
  try {
    const decoded = Buffer.from(text, 'base64').toString('utf8')
    // Check if decoded text contains mostly printable characters
    // This helps avoid false positives where random data gets decoded to garbage
    const printableChars = decoded.replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '')
    if (printableChars.length >= decoded.length * 0.8) {
      return decoded
    }
    return null
  } catch {
    return null
  }
}

export function decrypt(encryptedText: string): string {
  // Handle empty or null-ish values
  if (!encryptedText) {
    return encryptedText
  }

  // First, try AES-256-GCM decryption if it matches the format
  if (isEncryptedFormat(encryptedText)) {
    try {
      const key = getEncryptionKey()
      const parts = encryptedText.split(':')

      const iv = Buffer.from(parts[0], 'hex')
      const authTag = Buffer.from(parts[1], 'hex')
      const encrypted = parts[2]

      const decipher = createDecipheriv(ALGORITHM, key, iv)
      decipher.setAuthTag(authTag)

      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')

      return decrypted
    } catch {
      // AES decryption failed, continue to try base64
    }
  }

  // Try base64 decoding for legacy data
  if (isBase64(encryptedText)) {
    const decoded = tryDecodeBase64(encryptedText)
    if (decoded) {
      return decoded
    }
  }

  // Return as-is if no decryption method worked
  return encryptedText
}

export interface PatientPII {
  name: string
  phone: string
  address?: string
  idNumber?: string
  birthDate?: string
  emergencyContact?: string
}

export interface EncryptedPatientPII {
  encrypted_name: string
  encrypted_phone: string
  encrypted_address?: string
  encrypted_id_number?: string
  encrypted_birth_date?: string
  encrypted_emergency_contact?: string
}

export function encryptPatientPII(pii: PatientPII): EncryptedPatientPII {
  return {
    encrypted_name: encrypt(pii.name),
    encrypted_phone: encrypt(pii.phone),
    encrypted_address: pii.address ? encrypt(pii.address) : undefined,
    encrypted_id_number: pii.idNumber ? encrypt(pii.idNumber) : undefined,
    encrypted_birth_date: pii.birthDate ? encrypt(pii.birthDate) : undefined,
    encrypted_emergency_contact: pii.emergencyContact ? encrypt(pii.emergencyContact) : undefined,
  }
}

export function decryptPatientPII(encrypted: EncryptedPatientPII): PatientPII {
  return {
    name: encrypted.encrypted_name ? decrypt(encrypted.encrypted_name) : '',
    phone: encrypted.encrypted_phone ? decrypt(encrypted.encrypted_phone) : '',
    address: encrypted.encrypted_address ? decrypt(encrypted.encrypted_address) : undefined,
    idNumber: encrypted.encrypted_id_number ? decrypt(encrypted.encrypted_id_number) : undefined,
    birthDate: encrypted.encrypted_birth_date ? decrypt(encrypted.encrypted_birth_date) : undefined,
    emergencyContact: encrypted.encrypted_emergency_contact ? decrypt(encrypted.encrypted_emergency_contact) : undefined,
  }
}

export function encryptAddress(address: string): string {
  return encrypt(address)
}

export function decryptAddress(encryptedAddress: string): string {
  return decrypt(encryptedAddress)
}
