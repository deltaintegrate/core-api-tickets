export interface EncryptedPayload {
  publicKey: string;
  iv: string;
  authTag: string;
  encryptedData: string;
}

export interface ICryptoService {
  getPublicKey(): string;
  decrypt(payload: EncryptedPayload): Record<string, unknown>;
  encrypt(data: Record<string, unknown>, clientPublicKeyBase64: string): EncryptedPayload;
}
