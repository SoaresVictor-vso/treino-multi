import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { UserRole } from '../users/entities/user-role.entity';
import { CriticalOperationLog } from '../audit-logs/entities/critical-operation-log.entity';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class DatabaseSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseSyncService.name);

  constructor(
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(CriticalOperationLog)
    private readonly criticalLogRepo: Repository<CriticalOperationLog>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.revokeObsoleteRoles();
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
