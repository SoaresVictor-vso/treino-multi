import { constants, enums } from '@treino-multi/shared';
const { MEASUREMENT_DEFINITIONS } = constants;
const { Role } = enums;
type Role = enums.Role;
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DatabaseSyncService } from './database-sync.service';
import { UserRole } from '../users/entities/user-role.entity';
import { CriticalOperationLog } from '../audit-logs/entities/critical-operation-log.entity';
import { Measurement } from '../measurements/entities/measurement.entity';
import { Metric } from '../metrics/entities/metric.entity';



const makeUserRole = (overrides: Partial<UserRole> = {}): UserRole =>
	Object.assign(new UserRole(), {
		userId: 'user-uuid-1',
		role: 'obsolete:role' as Role,
		deletedAt: null,
		...overrides,
	});

describe('DatabaseSyncService', () => {
	let service: DatabaseSyncService;
	let userRoleRepo: jest.Mocked<Repository<UserRole>>;
	let criticalLogRepo: jest.Mocked<Repository<CriticalOperationLog>>;

	beforeEach(async () => {
		const mockRepo = () => ({
			find: jest.fn(),
			save: jest.fn(),
			create: jest.fn((dto: any) => ({ ...dto })),
		});

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				DatabaseSyncService,
				{ provide: getRepositoryToken(UserRole), useFactory: mockRepo },
				{ provide: getRepositoryToken(CriticalOperationLog), useFactory: mockRepo },
				{ provide: getRepositoryToken(Measurement), useFactory: () => ({
					...mockRepo(), find: jest.fn().mockResolvedValue([]),
				}) },
				{ provide: getRepositoryToken(Metric), useFactory: () => ({
					...mockRepo(), find: jest.fn().mockResolvedValue(
						[...new Set(MEASUREMENT_DEFINITIONS.flatMap(item =>
							[item.metric1Name, item.metric2Name].filter(Boolean)))].map((name, id) => ({ name, id: id + 1 }))),
				}) },
			],
		}).compile();

		service = module.get<DatabaseSyncService>(DatabaseSyncService);
		userRoleRepo = module.get(getRepositoryToken(UserRole));
		criticalLogRepo = module.get(getRepositoryToken(CriticalOperationLog));
	});

	describe('onApplicationBootstrap', () => {
		it('não deve revogar nada quando todas as roles são válidas', async () => {
			userRoleRepo.find.mockResolvedValue([]);

			await service.onApplicationBootstrap();

			expect(userRoleRepo.save).not.toHaveBeenCalled();
			expect(criticalLogRepo.save).not.toHaveBeenCalled();
		});

		it('deve revogar roles obsoletas e criar critical_operation_log para cada uma', async () => {
			const obsoleteRole = makeUserRole({ userId: 'user-1' });
			userRoleRepo.find.mockResolvedValue([obsoleteRole]);
			criticalLogRepo.save.mockResolvedValue({} as CriticalOperationLog);
			userRoleRepo.save.mockResolvedValue(obsoleteRole);

			await service.onApplicationBootstrap();

			// revogação: deletedAt deve ser setado
			expect(userRoleRepo.save).toHaveBeenCalledTimes(1);
			const savedRole = userRoleRepo.save.mock.calls[0][0] as Partial<UserRole>;
			expect(savedRole.deletedAt).toBeInstanceOf(Date);

			// critical_operation_log deve ser criado
			expect(criticalLogRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					tenantId: null,
					tableName: 'user_roles',
					operation: 'UPDATE',
					recordId: 'user-1',
					userId: null,
					ipAddress: 'system',
				}),
			);
			expect(criticalLogRepo.save).toHaveBeenCalledTimes(1);
		});

		it('deve revogar múltiplas roles obsoletas independentemente', async () => {
			const roles = [
				makeUserRole({ userId: 'user-1', role: 'old:role1' as Role }),
				makeUserRole({ userId: 'user-2', role: 'old:role2' as Role }),
			];
			userRoleRepo.find.mockResolvedValue(roles);
			criticalLogRepo.save.mockResolvedValue({} as CriticalOperationLog);
			userRoleRepo.save.mockResolvedValue(new UserRole());

			await service.onApplicationBootstrap();

			expect(userRoleRepo.save).toHaveBeenCalledTimes(2);
			expect(criticalLogRepo.save).toHaveBeenCalledTimes(2);
		});

		it('o critical_operation_log deve conter recordId igual ao userId da role revogada', async () => {
			const obsoleteRole = makeUserRole({
				userId: 'user-abc',
				role: 'removed:role' as Role,
			});
			userRoleRepo.find.mockResolvedValue([obsoleteRole]);
			criticalLogRepo.save.mockResolvedValue({} as CriticalOperationLog);
			userRoleRepo.save.mockResolvedValue(obsoleteRole);

			await service.onApplicationBootstrap();

			const logDto = criticalLogRepo.create.mock
				.calls[0][0] as Partial<CriticalOperationLog>;
			expect(logDto.recordId).toBe('user-abc');
			expect(logDto.tableName).toBe('user_roles');
			expect(logDto.operation).toBe('UPDATE');
			expect(logDto.userId).toBeNull();
			expect(logDto.ipAddress).toBe('system');
		});
	});
});
