import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AthleteService } from './athlete.service';
import { Role } from '../common/enums/role.enum';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';

function actor(roles: Role[], tenantId: string | null): JwtPayload {
	return { sub: 'user-id', personId: 'person-id', context: tenantId ? 'tenant' : 'organization', tenantId, roles, impersonatedBy: null };
}

describe('AthleteService tenant scope', () => {
	const scope = (user: JwtPayload, selected?: string) =>
		(AthleteService.prototype as any).resolveReadTenantId(user, selected);

	it('requires an explicit tenant for the organization admin', () => {
		expect(() => scope(actor([Role.ORG_ADMIN], null))).toThrow(BadRequestException);
		expect(scope(actor([Role.ORG_ADMIN], null), tenantA)).toBe(tenantA);
	});

	it('prevents tenant users and other global roles from selecting another tenant', () => {
		expect(() => scope(actor([Role.TENANT_ADMIN], tenantA), tenantB)).toThrow(ForbiddenException);
		expect(() => scope(actor([Role.ORG_SUPPORT], null), tenantB)).toThrow(ForbiddenException);
		expect(scope(actor([Role.TENANT_ADMIN], tenantA))).toBe(tenantA);
	});
});
