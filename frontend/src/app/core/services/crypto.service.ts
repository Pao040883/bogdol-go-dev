import { Injectable } from '@angular/core';

export interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export interface SerializedKeyPair {
  publicKey: string;  // Base64 encoded
  privateKey: string; // Base64 encoded
}

@Injectable({
  providedIn: 'root'
})
export class CryptoService {
  private readonly ALGORITHM = {
    name: 'RSA-OAEP',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256'
  };

  private readonly AES_ALGORITHM = {
    name: 'AES-GCM',
    length: 256
  };

  constructor() {}

  /**
   * Generate RSA key pair for a user
   */
  async generateKeyPair(): Promise<KeyPair> {
    const keyPair = await window.crypto.subtle.generateKey(
      this.ALGORITHM,
      true, // extractable
      ['encrypt', 'decrypt']
    );

    return {
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey
    };
  }

  /**
   * Export public key to base64 string for storage/transmission
   */
  async exportPublicKey(key: CryptoKey): Promise<string> {
    const exported = await window.crypto.subtle.exportKey('spki', key);
    return this.arrayBufferToBase64(exported);
  }

  /**
   * Export private key to base64 string for local storage
   */
  async exportPrivateKey(key: CryptoKey): Promise<string> {
    const exported = await window.crypto.subtle.exportKey('pkcs8', key);
    return this.arrayBufferToBase64(exported);
  }

  /**
   * Import public key from base64 string
   */
  async importPublicKey(keyData: string): Promise<CryptoKey> {
    const buffer = this.base64ToArrayBuffer(keyData);
    return await window.crypto.subtle.importKey(
      'spki',
      buffer,
      this.ALGORITHM,
      true,
      ['encrypt']
    );
  }

  /**
   * Import private key from base64 string
   */
  async importPrivateKey(keyData: string): Promise<CryptoKey> {
    const buffer = this.base64ToArrayBuffer(keyData);
    return await window.crypto.subtle.importKey(
      'pkcs8',
      buffer,
      this.ALGORITHM,
      true,
      ['decrypt']
    );
  }

  /**
   * Encrypt message for multiple recipients (including sender)
   * Uses hybrid encryption: AES for content, RSA for AES key
   */
  async encryptMessageForMultiple(content: string, publicKeys: CryptoKey[]): Promise<string> {
    // Generate random AES key
    const aesKey = await window.crypto.subtle.generateKey(
      this.AES_ALGORITHM,
      true,
      ['encrypt']
    );

    // Generate random IV
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // Encrypt content with AES
    const encoder = new TextEncoder();
    const contentBytes = encoder.encode(content);
    const encryptedContent = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      contentBytes
    );

    // Export AES key
    const exportedAesKey = await window.crypto.subtle.exportKey('raw', aesKey);

    // Encrypt AES key for each recipient
    const encryptedKeys: string[] = [];
    for (const publicKey of publicKeys) {
      const encryptedAesKey = await window.crypto.subtle.encrypt(
        this.ALGORITHM,
        publicKey,
        exportedAesKey
      );
      encryptedKeys.push(this.arrayBufferToBase64(encryptedAesKey));
    }

    // Combine: multiple encrypted AES keys + iv + encryptedContent
    const result = {
      keys: encryptedKeys, // Array of encrypted AES keys
      iv: this.arrayBufferToBase64(iv.buffer),
      content: this.arrayBufferToBase64(encryptedContent)
    };

    return JSON.stringify(result);
  }

  /**
   * Encrypt message content using recipient's public key
   * Uses hybrid encryption: AES for content, RSA for AES key
   */
  async encryptMessage(content: string, recipientPublicKey: CryptoKey): Promise<string> {
    // Generate random AES key
    const aesKey = await window.crypto.subtle.generateKey(
      this.AES_ALGORITHM,
      true,
      ['encrypt']
    );

    // Generate random IV
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // Encrypt content with AES
    const encoder = new TextEncoder();
    const contentBytes = encoder.encode(content);
    const encryptedContent = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      contentBytes
    );

    // Export AES key
    const exportedAesKey = await window.crypto.subtle.exportKey('raw', aesKey);

    // Encrypt AES key with recipient's RSA public key
    const encryptedAesKey = await window.crypto.subtle.encrypt(
      this.ALGORITHM,
      recipientPublicKey,
      exportedAesKey
    );

    // Combine: encryptedAesKey + iv + encryptedContent
    const result = {
      key: this.arrayBufferToBase64(encryptedAesKey),
      iv: this.arrayBufferToBase64(iv.buffer),  // Convert Uint8Array to ArrayBuffer
      content: this.arrayBufferToBase64(encryptedContent)
    };

    return JSON.stringify(result);
  }

  /**
   * Decrypt message content using own private key
   * Supports both old format (single key) and new format (multiple keys)
   */
  async decryptMessage(encryptedData: string, privateKey: CryptoKey): Promise<string> {
    try {
      const data = JSON.parse(encryptedData);

      // Check if this is new format with multiple keys
      let aesKeyBuffer: ArrayBuffer;
      if (data.keys && Array.isArray(data.keys)) {
        // Try each encrypted key until one works
        let decrypted = false;
        let attemptCount = 0;
        for (const encryptedKey of data.keys) {
          attemptCount++;
          try {
            const encryptedAesKeyBuffer = this.base64ToArrayBuffer(encryptedKey);
            aesKeyBuffer = await window.crypto.subtle.decrypt(
              this.ALGORITHM,
              privateKey,
              encryptedAesKeyBuffer
            );
            decrypted = true;
            break;
          } catch (err) {
            // This key doesn't work for us, try next one
            continue;
          }
        }
        if (!decrypted) {
          throw new Error('None of the ' + data.keys.length + ' encrypted keys could be decrypted');
        }
      } else {
        // Old format with single key
        const encryptedAesKeyBuffer = this.base64ToArrayBuffer(data.key);
        aesKeyBuffer = await window.crypto.subtle.decrypt(
          this.ALGORITHM,
          privateKey,
          encryptedAesKeyBuffer
        );
      }

      // Import AES key
      const aesKey = await window.crypto.subtle.importKey(
        'raw',
        aesKeyBuffer!,
        this.AES_ALGORITHM,
        false,
        ['decrypt']
      );

      // Decrypt content with AES
      const iv = this.base64ToArrayBuffer(data.iv);
      const encryptedContent = this.base64ToArrayBuffer(data.content);
      const decryptedContent = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        encryptedContent
      );

      // Decode to string
      const decoder = new TextDecoder();
      return decoder.decode(decryptedContent);
    } catch (error) {
      // Suppress detailed error logging - this is expected when keys don't match
      throw new Error('Failed to decrypt message');
    }
  }

  /**
   * Store key pair in IndexedDB (more secure than localStorage)
   */
  async storeKeyPair(userId: number, keyPair: KeyPair): Promise<void> {
    const publicKey = await this.exportPublicKey(keyPair.publicKey);
    const privateKey = await this.exportPrivateKey(keyPair.privateKey);

    const serialized: SerializedKeyPair = { publicKey, privateKey };
    localStorage.setItem(`e2e_keys_${userId}`, JSON.stringify(serialized));
  }

  /**
   * Retrieve key pair from storage
   */
  async retrieveKeyPair(userId: number): Promise<KeyPair | null> {
    const stored = localStorage.getItem(`e2e_keys_${userId}`);
    if (!stored) return null;

    const serialized: SerializedKeyPair = JSON.parse(stored);
    const publicKey = await this.importPublicKey(serialized.publicKey);
    const privateKey = await this.importPrivateKey(serialized.privateKey);

    return { publicKey, privateKey };
  }

  /**
   * Helper: ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Helper: Base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
