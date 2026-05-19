import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Person } from '../persons/entities/person.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { AuditLog } from '../audit-logs/entities/audit-log.entity';
import { AuthenticationLog } from '../audit-logs/entities/authentication-log.entity';
import { CriticalOperationLog } from '../audit-logs/entities/critical-operation-log.entity';
import { PasswordChangeLog } from '../audit-logs/entities/password-change-log.entity';
import { LogContextType } from '../audit-logs/entities/log-context-type.entity';

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: [Person, Tenant, User, UserRole, RefreshToken, AuditLog, AuthenticationLog, CriticalOperationLog, PasswordChangeLog, LogContextType],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});
