import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuthProvider } from '../../common/enums/oauth-provider.enum';
import {
	OAuthIdentity,
	OAuthIdentityProvider,
} from '../interfaces/oauth-identity-provider.interface';

interface GoogleClaims {
	iss: string;
	aud: string;
	sub: string;
	email: string;
	email_verified: boolean | string;
	exp: number;
	iat: number;
	name?: string;
}
interface GoogleKey extends JsonWebKey {
	kid: string;
	alg?: string;
	use?: string;
}
let keyCache: { until: number; keys: GoogleKey[] } | null = null;

const decode = <T>(value: string): T =>
	JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;

/** Verifies signature and mandatory OIDC claims locally using Google's published JWKs. */
export async function verifyGoogleIdToken(
	token: string,
	audience: string,
): Promise<GoogleClaims> {
	try {
		if (!audience) throw new Error('Google audience not configured');
		const parts = token.split('.');
		if (parts.length !== 3) throw new Error('Malformed token');
		const header = decode<{ alg: string; kid: string }>(parts[0]);
		if (header.alg !== 'RS256' || !header.kid)
			throw new Error('Unsupported algorithm');
		if (!keyCache || keyCache.until < Date.now()) {
			const response = await fetch('https://www.googleapis.com/oauth2/v3/certs');
			if (!response.ok) throw new Error('Google keys unavailable');
			const body = (await response.json()) as { keys: GoogleKey[] };
			const maxAge = Number(
				response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] ??
					'3600',
			);
			keyCache = {
				keys: body.keys,
				until: Date.now() + Math.min(maxAge, 86400) * 1000,
			};
		}
		const key = keyCache.keys.find(
			(item) => item.kid === header.kid && item.kty === 'RSA',
		);
		if (!key) throw new Error('Unknown key');
		const valid = crypto.verify(
			'RSA-SHA256',
			Buffer.from(`${parts[0]}.${parts[1]}`),
			crypto.createPublicKey({
				key: key as unknown as crypto.JsonWebKey,
				format: 'jwk',
			}),
			Buffer.from(parts[2], 'base64url'),
		);
		if (!valid) throw new Error('Invalid signature');
		const claims = decode<GoogleClaims>(parts[1]);
		const now = Math.floor(Date.now() / 1000);
		if (
			!['https://accounts.google.com', 'accounts.google.com'].includes(
				claims.iss,
			) ||
			claims.aud !== audience ||
			!claims.sub ||
			!claims.email ||
			(claims.email_verified !== true && claims.email_verified !== 'true') ||
			claims.exp <= now ||
			claims.iat > now + 60
		)
			throw new Error('Invalid claims');
		return claims;
	} catch {
		throw new UnauthorizedException('Identidade Google inválida.');
	}
}

@Injectable()
export class GoogleIdTokenProvider implements OAuthIdentityProvider {
	readonly provider = OAuthProvider.GOOGLE;

	constructor(private readonly config: ConfigService) {}

	async verify(credential: string): Promise<OAuthIdentity> {
		const claims = await verifyGoogleIdToken(
			credential,
			this.config.get<string>('GOOGLE_CLIENT_ID') ?? '',
		);
		return {
			sub: claims.sub,
			email: claims.email,
			name: claims.name,
			iat: claims.iat,
		};
	}
}
