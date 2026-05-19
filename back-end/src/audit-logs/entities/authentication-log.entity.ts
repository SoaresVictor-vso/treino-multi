import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { LogContextType } from './log-context-type.entity';

@Entity('authentication_logs')
export class AuthenticationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** null quando contexto = 'organization' */
  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ name: 'context_type_id', type: 'smallint' })
  contextTypeId: number;

  @Column({ type: 'boolean' })
  success: boolean;

  @Column({ name: 'login_used', type: 'varchar' })
  loginUsed: string;

  @Column({ name: 'ip_address', type: 'varchar', nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Tenant, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant | null;

  @ManyToOne(() => LogContextType, { eager: false })
  @JoinColumn({ name: 'context_type_id' })
  contextType: LogContextType;
}
