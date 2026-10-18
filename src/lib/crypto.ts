import { DecryptedCredentialsSchema, type DecryptedCredentials } from '../types/env';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(base64Url: string): Uint8Array {
  const padded = base64Url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(base64Url.length + ((4 - (base64Url.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Compute SHA-256 hex digest using WebCrypto
 */
export async function sha256Hex(input: string): Promise<string> {
  const data = encoder.encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Compute SHA-256 base64url digest (used for OAuth PKCE S256 & compact KV keys)
 */
export async function sha256Base64Url(input: string): Promise<string> {
  const data = encoder.encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToBase64Url(new Uint8Array(digest));
}

/**
 * Derive a 256-bit AES-GCM CryptoKey from the Worker's ENCRYPTION_SECRET
 */
async function deriveAesGcmKey(secret: string): Promise<CryptoKey> {
  const rawHash = await crypto.subtle.digest('SHA-256', encoder.encode(`flareroute-vault:${secret}`));
  return crypto.subtle.importKey('raw', rawHash, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Encrypt provider credentials object using AES-256-GCM.
 * Output format: `v1:<iv_base64url>:<ciphertext_base64url>`
 */
export async function encryptCredentials(
  credentials: DecryptedCredentials,
  secret: string
): Promise<string> {
  const key = await deriveAesGcmKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(credentials));
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plaintext
  );
  return `v1:${bytesToBase64Url(iv)}:${bytesToBase64Url(new Uint8Array(encryptedBuffer))}`;
}

/**
 * Decrypt provider credentials from `v1:<iv>:<ciphertext>` using AES-256-GCM
 */
export async function decryptCredentials(
  payload: string,
  secret: string
): Promise<DecryptedCredentials> {
  if (!payload.startsWith('v1:')) {
    // Graceful fallback if stored as plain JSON during testing
    const parsed: unknown = JSON.parse(payload);
    return DecryptedCredentialsSchema.parse(parsed);
  }
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid AES-256-GCM vault payload format');
  }
  const iv = base64UrlToBytes(parts[1]);
  const ciphertext = base64UrlToBytes(parts[2]);
  const key = await deriveAesGcmKey(secret);
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertext as BufferSource
  );
  const jsonStr = decoder.decode(decryptedBuffer);
  const parsed: unknown = JSON.parse(jsonStr);
  return DecryptedCredentialsSchema.parse(parsed);
}

/**
 * Generate OAuth 2.0 PKCE Verifier & S256 Challenge
 */
export async function generatePkcePair(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
  state: string;
}> {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const stateBytes = crypto.getRandomValues(new Uint8Array(16));
  const codeVerifier = bytesToBase64Url(verifierBytes);
  const codeChallenge = await sha256Base64Url(codeVerifier);
  const state = bytesToHex(stateBytes);
  return { codeVerifier, codeChallenge, state };
}

/**
 * Generate a new BansosRouter client API key (`bansos_live_...`) and its SHA-256 hash
 */
export async function generateClientApiKey(): Promise<{
  rawKey: string;
  keyPrefix: string;
  keyHash: string;
}> {
  const randomBytes = crypto.getRandomValues(new Uint8Array(24));
  const tokenPart = bytesToBase64Url(randomBytes);
  const rawKey = `bansos_live_${tokenPart}`;
  const keyPrefix = `${rawKey.slice(0, 18)}...`;
  const keyHash = await sha256Hex(rawKey);
  return { rawKey, keyPrefix, keyHash };
}

/**
 * Sign a Google Cloud / Vertex AI Service Account JWT using RS256 via WebCrypto
 */
export async function signGoogleServiceAccountJwt(
  serviceAccountEmail: string,
  privateKeyPem: string,
  scopes: string[] = ['https://www.googleapis.com/auth/cloud-platform']
): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: serviceAccountEmail,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSec,
    exp: nowSec + 3600,
  };

  const encodedHeader = bytesToBase64Url(encoder.encode(JSON.stringify(header)));
  const encodedClaims = bytesToBase64Url(encoder.encode(JSON.stringify(claimSet)));
  const signingInput = `${encodedHeader}.${encodedClaims}`;

  const pemClean = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const binaryDer = atob(pemClean);
  const derBytes = new Uint8Array(binaryDer.length);
  for (let i = 0; i < binaryDer.length; i++) {
    derBytes[i] = binaryDer.charCodeAt(i);
  }

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    derBytes.buffer as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(signingInput)
  );

  return `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`;
}
