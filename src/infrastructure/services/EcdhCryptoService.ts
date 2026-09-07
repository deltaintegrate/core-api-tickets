import * as crypto from 'crypto';
import { EncryptedPayload, ICryptoService } from '../../domain/ports/services/ICryptoService';

export class EcdhCryptoService implements ICryptoService {
  private readonly ecdh: crypto.ECDH;

  constructor(curve = 'prime256v1') {
    this.ecdh = crypto.createECDH(curve);
    this.ecdh.generateKeys();
  }

  getPublicKey(): string {
    return this.ecdh.getPublicKey('base64');
  }

  decrypt(payload: EncryptedPayload): Record<string, unknown> {
    const clientPublicKey = Buffer.from(payload.publicKey, 'base64');
    const sharedSecret = this.ecdh.computeSecret(clientPublicKey);
    const derivedKey = crypto.createHash('sha256').update(sharedSecret).digest();

    const iv = Buffer.from(payload.iv, 'base64');
    const authTag = Buffer.from(payload.authTag, 'base64');
    const encryptedData = Buffer.from(payload.encryptedData, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8')) as Record<string, unknown>;
  }

  encrypt(data: Record<string, unknown>, clientPublicKeyBase64: string): EncryptedPayload {
    const clientPublicKey = Buffer.from(clientPublicKeyBase64, 'base64');
    const sharedSecret = this.ecdh.computeSecret(clientPublicKey);
    const derivedKey = crypto.createHash('sha256').update(sharedSecret).digest();

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
    const plaintext = Buffer.from(JSON.stringify(data), 'utf8');
    const encryptedData = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      publicKey: this.ecdh.getPublicKey('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      encryptedData: encryptedData.toString('base64'),
    };
  }
}
