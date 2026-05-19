import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';

export type CriticalOperation = 'CREATE' | 'UPDATE' | 'DELETE' | 'READ' | 'PASSWORD_RESET_TOKEN';

@Entity('critical_operation_logs')
export class CriticalOperationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** null quando contexto = 'organization' */
  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  /** Nome da tabela afetada, ex: 'users', 'tenants', 'persons', 'user_roles' */
  @Column({ name: 'table_name', type: 'varchar' })
  tableName: string;

  @Column({
    type: 'varchar',
    enum: ['CREATE', 'UPDATE', 'DELETE', 'READ', 'PASSWORD_RESET_TOKEN'],
  })
  operation: CriticalOperation;

  /** ID (string) do registro afetado */
  @Column({ name: 'record_id', type: 'varchar' })
  recordId: string;

  /**
   * Snapshot das alterações de campos críticos.
   * Formato sugerido: { field: { before: any, after: any } }
   * Obrigatório para UPDATE; null em CREATE/DELETE/READ.
   */
  @Column({ type: 'jsonb', nullable: true })
  diff: Record<string, { before: unknown; after: unknown }> | null;

  /** null apenas em operações automáticas do bootstrap/sistema */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'ip_address', type: 'varchar', nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Tenant, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;
}
