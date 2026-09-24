import * as crypto from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { GoogleIdTokenProvider, verifyGoogleIdToken } from './google-id-token';
import { OAuthProvider } from '../../common/enums/oauth-provider.enum';

describe('Google ID token verification', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicJwk = publicKey.export({ format: 'jwk' }) as crypto.JsonWebKey;
  const audience = 'test-client-id';
  const now = Math.floor(Date.now() / 1000);
  const makeToken = (claims: Record<string, unknown>) => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', aud: audience,
      sub: 'google-subject', email: 'athlete@example.com', email_verified: true,
      exp: now + 3600, iat: now, ...claims })).toString('base64url');
    const signature = crypto.sign('RSA-SHA256', Buffer.from(`${header}.${body}`), privateKey).toString('base64url');
    return `${header}.${body}.${signature}`;
  };
  beforeAll(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true,
      headers: { get: () => 'max-age=3600' },
      json: async () => ({ keys: [{ ...publicJwk, kid: 'test-key', alg: 'RS256', use: 'sig' }] }),
    }) as unknown as typeof fetch;
  });
  it('accepts a signed token with matching audience and verified email', async () => {
    await expect(verifyGoogleIdToken(makeToken({}), audience)).resolves.toMatchObject({ sub: 'google-subject' });
  });
  it('implements the OAuth provider contract with normalized identity fields', async () => {
    const provider = new GoogleIdTokenProvider({ get: () => audience } as any);
    expect(provider.provider).toBe(OAuthProvider.GOOGLE);
    await expect(provider.verify(makeToken({}))).resolves.toMatchObject({
      sub: 'google-subject', email: 'athlete@example.com', iat: now,
    });
  });
  it('rejects a token issued to another OAuth client', async () => {
    await expect(verifyGoogleIdToken(makeToken({ aud: 'other-client' }), audience)).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('rejects an unverified email', async () => {
    await expect(verifyGoogleIdToken(makeToken({ email_verified: false }), audience)).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('rejects an expired token', async () => {
    await expect(verifyGoogleIdToken(makeToken({ exp: now - 1 }), audience)).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('rejects a tampered signature', async () => {
    const valid = makeToken({});
    const parts = valid.split('.');
    parts[2] = (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1);
    await expect(verifyGoogleIdToken(parts.join('.'), audience))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });
});
