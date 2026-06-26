import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './entities/tenant.entity';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Person } from '../persons/entities/person.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, Person, User, UserRole]),
    AuditLogsModule,
  ],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
