import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

// AES-256-GCM ile JSON config şifreleme/çözme
// ENCRYPTION_KEY env var: 64 hex karakter (32 byte)
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor() {
    const keyHex = process.env.ENCRYPTION_KEY;
    if (keyHex) {
      this.key = Buffer.from(keyHex, 'hex');
    } else {
      // Dev fallback: sabit key (production'da ENCRYPTION_KEY zorunlu)
      this.key = crypto.scryptSync('masrafco-dev-key', 'salt', 32);
    }
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Format: iv(12b) + tag(16b) + ciphertext — base64 encoded
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  decrypt(ciphertext: string): string {
    const buf = Buffer.from(ciphertext, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }

  encryptJson(obj: Record<string, any>): string {
    return this.encrypt(JSON.stringify(obj));
  }

  decryptJson(ciphertext: string): Record<string, any> {
    return JSON.parse(this.decrypt(ciphertext));
  }
}
