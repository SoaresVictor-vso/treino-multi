import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthenticationLog } from './entities/authentication-log.entity';
import { CriticalOperationLog } from './entities/critical-operation-log.entity';
import { PasswordChangeLog } from './entities/password-change-log.entity';
import { LogContextType } from './entities/log-context-type.entity';
import { AuditLogService } from './audit-logs.service';
import { AuditLogsController } from './audit-logs.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuthenticationLog,
      CriticalOperationLog,
      PasswordChangeLog,
      LogContextType,
    ]),
  ],
  controllers: [AuditLogsController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogsModule {}
