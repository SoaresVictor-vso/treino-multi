/**
 * Testes unitários da LocalStrategy — Fase 2
 *
 * A LocalStrategy é o ponto de entrada do fluxo de login com email+senha.
 * Ela delega a validação das credenciais ao AuthService.validateUser().
 *
 * Responsabilidades testadas:
 * 1. Quando validateUser retorna um User → a estratégia o repassa ao Passport.
 * 2. Quando validateUser retorna null  → lança UnauthorizedException.
 *
 * NÃO testamos o hashing de senha aqui (responsabilidade do AuthService).
 */

import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LocalStrategy } from './local.strategy';
import { AuthService } from '../auth.service';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../common/enums/role.enum';
import { UserRole } from '../../users/entities/user-role.entity';
import { AuditLogService } from '../../audit-logs/audit-logs.service';

/** Usuário mínimo retornado pelo AuthService em caso de sucesso */
const MOCK_USER: Partial<User> = {
	id: 'user-uuid-1',
	personId: 'person-uuid-1',
	context: 'organization',
	tenantId: null,
	isActive: true,
	userRoles: [{ role: Role.ORG_ADMIN, deletedAt: null } as UserRole],
};

describe('LocalStrategy', () => {
	let strategy: LocalStrategy;
	let authService: jest.Mocked<Pick<AuthService, 'validateUser'>>;
	let auditLogService: jest.Mocked<Pick<AuditLogService, 'logAuthentication'>>;
	const request = { ip: '127.0.0.1' } as any;

	beforeEach(async () => {
		const moduleRef = await Test.createTestingModule({
			providers: [
				LocalStrategy,
				{
					/**
					 * Fornecemos apenas o slice do AuthService que a LocalStrategy consome.
					 * Isso torna o mock mais explícito e o teste mais robusto a mudanças
					 * nas outras partes do serviço.
					 */
					provide: AuthService,
					useValue: {
						validateUser: jest.fn(),
					},
				},
				{
					provide: AuditLogService,
					useValue: { logAuthentication: jest.fn().mockResolvedValue(undefined) },
				},
			],
		}).compile();

		strategy = moduleRef.get(LocalStrategy);
		authService = moduleRef.get(AuthService);
		auditLogService = moduleRef.get(AuditLogService);
	});

	describe('validate()', () => {
		/**
		 * Cenário feliz: credenciais válidas.
		 * validate() deve retornar o User recebido do AuthService,
		 * que será anexado a request.user pelo Passport.
		 */
		it('deve retornar o User quando as credenciais são válidas', async () => {
			authService.validateUser.mockResolvedValue(MOCK_USER as User);

			const result = await strategy.validate(request, 'admin@org.com', '12345678');

			expect(result).toEqual(MOCK_USER);
			expect(authService.validateUser).toHaveBeenCalledWith(
				'admin@org.com',
				'12345678',
			);
		});

		/**
		 * Cenário de falha: AuthService.validateUser retorna null (credenciais inválidas
		 * ou usuário inativo). A estratégia deve converter o null em UnauthorizedException
		 * para que o Passport retorne HTTP 401 ao cliente.
		 */
		it('deve lançar UnauthorizedException quando validateUser retorna null', async () => {
			authService.validateUser.mockResolvedValue(null);

			await expect(
				strategy.validate(request, 'errado@org.com', 'senha-errada'),
			).rejects.toThrow(UnauthorizedException);
			expect(auditLogService.logAuthentication).toHaveBeenCalledWith({
				tenantId: null,
				context: 'standalone',
				success: false,
				loginUsed: 'errado@org.com',
				ipAddress: '127.0.0.1',
			});
		});

		/**
		 * Garante que o e-mail é normalizado para minúsculas antes da validação.
		 */
		it('deve repassar email e senha exatamente como recebidos', async () => {
			authService.validateUser.mockResolvedValue(null);

			try {
				await strategy.validate(request, 'Admin@ORG.COM', 'SenhaComMaiusculas');
			} catch {
				// esperado
			}

			expect(authService.validateUser).toHaveBeenCalledWith(
				'admin@org.com',
				'SenhaComMaiusculas',
			);
		});
	});
});
