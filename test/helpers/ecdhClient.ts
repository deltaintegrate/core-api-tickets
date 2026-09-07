import * as crypto from 'crypto';
import supertest from 'supertest';
import { Application } from 'express';

export async function encryptBody(
  app: Application,
  body: Record<string, unknown>,
): Promise<{ publicKey: string; iv: string; authTag: string; encryptedData: string }> {
  const { body: keyResponse } = await supertest(app).get('/api/v1/crypto/public-key');
  const serverPublicKeyBase64: string = keyResponse.data.publicKey;

  const clientEcdh = crypto.createECDH('prime256v1');
  clientEcdh.generateKeys();

  const serverPublicKey = Buffer.from(serverPublicKeyBase64, 'base64');
  const sharedSecret = clientEcdh.computeSecret(serverPublicKey);
  const derivedKey = crypto.createHash('sha256').update(sharedSecret).digest();

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
  const plaintext = Buffer.from(JSON.stringify(body), 'utf8');
  const encryptedData = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    publicKey: clientEcdh.getPublicKey('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    encryptedData: encryptedData.toString('base64'),
  };
}
