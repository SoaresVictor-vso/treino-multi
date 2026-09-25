import { enums, constants } from '@treino-multi/shared';
const { Role } = enums;
type Role = enums.Role;
const { MEASUREMENT_DEFINITIONS } = constants;
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { UserRole } from '../users/entities/user-role.entity';
import { CriticalOperationLog } from '../audit-logs/entities/critical-operation-log.entity';

import { Measurement } from '../measurements/entities/measurement.entity';
import { Metric } from '../metrics/entities/metric.entity';


function stableJson(value: unknown): string | undefined {
	if (Array.isArray(value))
		return `[${value.map((item) => stableJson(item)).join(',')}]`;
	if (value && typeof value === 'object')
		return `{${Object.entries(value)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
			.join(',')}}`;
	return JSON.stringify(value);
}

@Injectable()
export class DatabaseSyncService implements OnApplicationBootstrap {
	private readonly logger = new Logger(DatabaseSyncService.name);

	constructor(
		@InjectRepository(UserRole)
		private readonly userRoleRepo: Repository<UserRole>,
		@InjectRepository(CriticalOperationLog)
		private readonly criticalLogRepo: Repository<CriticalOperationLog>,
		@InjectRepository(Measurement)
		private readonly measurementRepo: Repository<Measurement>,
		@InjectRepository(Metric)
		private readonly metricRepo: Repository<Metric>,
	) {}

	async onApplicationBootstrap(): Promise<void> {
		await this.revokeObsoleteRoles();
		await this.syncMeasurements();
	}

	private async syncMeasurements(): Promise<void> {
		const [existing, metrics] = await Promise.all([
			this.measurementRepo.find(),
			this.metricRepo.find(),
		]);
		const measurementByKey = new Map(existing.map((item) => [item.key, item]));
		const metricIdByName = new Map(metrics.map((item) => [item.name, item.id]));
		let created = 0;
		let updated = 0;

		for (const definition of MEASUREMENT_DEFINITIONS) {
			const metric1Id = definition.metric1Name
				? metricIdByName.get(definition.metric1Name)
				: null;
			const metric2Id = definition.metric2Name
				? metricIdByName.get(definition.metric2Name)
				: null;
			if (definition.metric1Name && metric1Id === undefined)
				throw new Error(
					`DatabaseSync: métrica "${definition.metric1Name}" exigida por "${definition.key}" não existe.`,
				);
			if (definition.metric2Name && metric2Id === undefined)
				throw new Error(
					`DatabaseSync: métrica "${definition.metric2Name}" exigida por "${definition.key}" não existe.`,
				);

			const fields = {
				name: definition.name,
				metric1Id: metric1Id ?? null,
				metric2Id: metric2Id ?? null,
				formula: definition.formula,
				valueFormula: definition.valueFormula,
				staticWeight: definition.staticWeight,
				dynamicWeight: definition.dynamicWeight,
				icon: definition.icon,
				unit: definition.unit,
				aggregation: definition.aggregation,
				presentation: definition.presentation,
			};
			const current = measurementByKey.get(definition.key);
			if (!current) {
				await this.measurementRepo.save(
					this.measurementRepo.create({
						...fields,
						key: definition.key,
						active: true,
					}),
				);
				created += 1;
				continue;
			}

			const changed = Object.entries(fields).some(([key, value]) => {
				const currentValue = current[key as keyof Measurement];
				if (key === 'staticWeight' || key === 'dynamicWeight')
					return Number(currentValue) !== Number(value);
				return stableJson(currentValue) !== stableJson(value);
			});
			if (!changed) continue;
			await this.measurementRepo.save({ ...current, ...fields });
			updated += 1;
		}

		this.logger.log(
			`DatabaseSync: ${created} medição(ões) criada(s), ${updated} atualizada(s).`,
		);
	}

	private async revokeObsoleteRoles(): Promise<void> {
		const validRoles = Object.values(Role);

		const obsoleteAssignments = await this.userRoleRepo.find({
			where: {
				role: Not(In(validRoles)),
				deletedAt: undefined,
			},
		});

		if (obsoleteAssignments.length === 0) {
			this.logger.log('DatabaseSync: nenhuma role obsoleta encontrada.');
			return;
		}

		for (const assignment of obsoleteAssignments) {
			// Soft-delete da role
			assignment.deletedAt = new Date();
			await this.userRoleRepo.save(assignment);

			// Registro de auditoria estruturado
			await this.criticalLogRepo.save(
				this.criticalLogRepo.create({
					tenantId: null,
					tableName: 'user_roles',
					operation: 'UPDATE',
					recordId: assignment.userId,
					userId: null,
					ipAddress: 'system',
				}),
			);

			this.logger.warn(
				`DatabaseSync: role "${assignment.role}" revogada do usuário ${assignment.userId}`,
			);
		}

		this.logger.log(
			`DatabaseSync: ${obsoleteAssignments.length} role(s) obsoleta(s) revogada(s).`,
		);
	}
}
