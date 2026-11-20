const crypto = require('crypto');

/**
 * Derives a 32-byte key from the environment variable
 */
function getEncryptionKey() {
  const secret = process.env.GITHUB_TOKEN_ENCRYPTION_KEY || 'preply_default_secure_aes256_token_key_32bytes';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts plain text using AES-256-GCM
 * Format: ivHex:authTagHex:encryptedHex
 */
function encryptToken(plainText) {
  if (!plainText) return null;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts AES-256-GCM encrypted text
 */
function decryptToken(encryptedString) {
  if (!encryptedString) return null;
  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }
  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = {
  encryptToken,
  decryptToken,
};
