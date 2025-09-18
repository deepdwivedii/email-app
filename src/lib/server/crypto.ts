import crypto from 'node:crypto';

const getKey = (): Buffer => {
  const keyStr = process.env.ENCRYPTION_KEY_32B || '';
  if (!keyStr) throw new Error('Missing ENCRYPTION_KEY_32B');
  // Accept base64 or utf-8 strings; ensure 32 bytes
  try {
    const buf = Buffer.from(keyStr, 'base64');
    if (buf.length === 32) return buf;
  } catch {}
  const utf = Buffer.from(keyStr, 'utf-8');
  if (utf.length === 32) return utf;
  // Derive from provided string (not ideal); encourages correct key size.
  return crypto.createHash('sha256').update(keyStr).digest();
};

export const encryptJson = (value: unknown): string => {
  const iv = crypto.randomBytes(12); // GCM recommended IV size
  const key = getKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const json = Buffer.from(JSON.stringify(value), 'utf-8');
  const enc = Buffer.concat([cipher.update(json), cipher.final()]);
  const tag = cipher.getAuthTag();
  // pack as base64 segments
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
};

export const decryptJson = <T = unknown>(payload: string): T => {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Invalid encrypted payload');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const key = getKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(dec.toString('utf-8')) as T;
};