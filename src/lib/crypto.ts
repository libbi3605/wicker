
// For Web Crypto API, ensure this runs in a browser environment or compatible Node.js version.
// This is a simplified example. Proper key management and exchange are crucial for real E2EE.

const ALGORITHM_NAME = 'AES-GCM';
const KEY_LENGTH = 256; // AES-256
const IV_LENGTH = 12; // 96 bits is recommended for AES-GCM

// Helper to convert ArrayBuffer to Base64 string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to convert Base64 string to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generates a new AES-GCM cryptographic key.
 */
export async function generateAESKey(): Promise<CryptoKey> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API not available');
  }
  return window.crypto.subtle.generateKey(
    {
      name: ALGORITHM_NAME,
      length: KEY_LENGTH,
    },
    true, // Can be extracted
    ['encrypt', 'decrypt']
  );
}

/**
 * Exports a CryptoKey to a Base64 string (JWK format).
 */
export async function exportKeyToString(key: CryptoKey): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API not available');
  }
  const jwk = await window.crypto.subtle.exportKey('jwk', key);
  return btoa(JSON.stringify(jwk)); // Base64 encode the JWK string
}

/**
 * Imports a CryptoKey from a Base64 string (JWK format).
 */
export async function importKeyFromString(keyStr: string): Promise<CryptoKey> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API not available');
  }
  const jwk = JSON.parse(atob(keyStr)); // Decode Base64 then parse JSON
  return window.crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: ALGORITHM_NAME, length: KEY_LENGTH },
    true, // Extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext string using AES-GCM.
 * Returns a Base64 encoded string of "iv.ciphertext".
 */
export async function encryptMessage(plaintext: string, key: CryptoKey): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API not available');
  }
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();
  const encodedPlaintext = encoder.encode(plaintext);

  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: ALGORITHM_NAME,
      iv: iv,
    },
    key,
    encodedPlaintext
  );

  // Prepend IV to ciphertext and base64 encode
  const ivAndCiphertext = new Uint8Array(iv.length + ciphertext.byteLength);
  ivAndCiphertext.set(iv);
  ivAndCiphertext.set(new Uint8Array(ciphertext), iv.length);
  
  return arrayBufferToBase64(ivAndCiphertext.buffer);
}

/**
 * Decrypts a ciphertext (Base64 encoded "iv.ciphertext") using AES-GCM.
 */
export async function decryptMessage(ivCiphertextBase64: string, key: CryptoKey): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API not available');
  }
  const ivAndCiphertext = base64ToArrayBuffer(ivCiphertextBase64);
  
  const iv = ivAndCiphertext.slice(0, IV_LENGTH);
  const ciphertext = ivAndCiphertext.slice(IV_LENGTH);

  try {
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: ALGORITHM_NAME,
        iv: iv,
      },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Decryption failed. The key might be incorrect or the data corrupted.");
  }
}


// --- Simplified Key Generation for Demo (NOT SECURE FOR PRODUCTION) ---
// This uses PBKDF2 to derive a key from a string (e.g., chat ID).
// In a real E2EE system, use Diffie-Hellman or a similar key exchange protocol.

async function deriveKey(secretString: string, saltString: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const secretData = encoder.encode(secretString);
  const saltData = encoder.encode(saltString);

  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    secretData,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltData,
      iterations: 100000, // Recommended minimum
      hash: 'SHA-256',
    },
    baseKey,
    { name: ALGORITHM_NAME, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

// Generates an AES key based on a pseudo-secret and exports it as a string for storage/sharing (simplified)
export async function generateAESKeyString(pseudoSecret: string): Promise<string> {
    // For demo, using the pseudoSecret itself as part of salt.
    // In real scenarios, salt should be unique and random per key derivation.
    const salt = `salt-for-${pseudoSecret.substring(0,10)}`; 
    const key = await deriveKey(pseudoSecret, salt);
    return await exportKeyToString(key);
}

// Imports an AES key from its string representation (simplified)
export async function importAESKeyFromString(keyString: string, pseudoSecretContext: string): Promise<CryptoKey> {
    // This function assumes keyString is a JWK that was exported.
    // The pseudoSecretContext is not directly used here if keyString is a full JWK.
    // If keyString was just the raw key material (not JWK), then derivation would be needed.
    // For simplicity, assuming keyString is from exportKeyToString.
    return await importKeyFromString(keyString);
}


// File encryption/decryption (example using the same AES-GCM key)
export async function encryptFile(file: File, key: CryptoKey): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: ALGORITHM_NAME, iv },
    key,
    arrayBuffer
  );

  const ivAndCiphertext = new Uint8Array(iv.length + ciphertext.byteLength);
  ivAndCiphertext.set(iv);
  ivAndCiphertext.set(new Uint8Array(ciphertext), iv.length);
  
  return arrayBufferToBase64(ivAndCiphertext.buffer);
}

export async function decryptFile(base64Ciphertext: string, key: CryptoKey, originalFileType: string): Promise<File> {
  const ivAndCiphertext = base64ToArrayBuffer(base64Ciphertext);
  const iv = ivAndCiphertext.slice(0, IV_LENGTH);
  const ciphertext = ivAndCiphertext.slice(IV_LENGTH);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: ALGORITHM_NAME, iv },
    key,
    ciphertext
  );
  
  return new File([decryptedBuffer], "decrypted_file", { type: originalFileType });
}
