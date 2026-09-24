import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';

/** Exact frontend origins shared by CORS and cookie-backed auth routes. */
export function getTrustedOrigins(configured = process.env.FRONT_END_URL ?? ''): string[] {
	const values = configured.split(',').map((value) => value.trim()).filter(Boolean);
	if (!values.length) throw new Error('FRONT_END_URL must configure at least one trusted origin.');
	return values.map((value) => {
		if (value === '*') throw new Error('Wildcard origins are not allowed for credentialed CORS.');
		let parsed: URL;
		try {
			parsed = new URL(value);
		} catch {
			throw new Error(`Invalid frontend origin in FRONT_END_URL: ${value}`);
		}
		if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== value.replace(/\/$/, ''))
			throw new Error(`FRONT_END_URL entries must be exact origins without paths: ${value}`);
		return parsed.origin;
	});
}

export function assertTrustedOrigin(request: Pick<Request, 'headers'>): void {
	const origin = request.headers.origin;
	if (!origin || !getTrustedOrigins().includes(origin))
		throw new ForbiddenException('Origem não autorizada.');
}
