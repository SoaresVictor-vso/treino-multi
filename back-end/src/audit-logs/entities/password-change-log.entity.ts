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

@Entity('password_change_logs')
export class PasswordChangeLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** null quando contexto = 'organization' */
  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /**
   * true  = usuário autenticado alterou a própria senha
   * false = via fluxo de recuperação de senha
   */
  @Column({ name: 'is_session', type: 'boolean' })
  isSession: boolean;

  @Column({ name: 'ip_address', type: 'varchar', nullable: true })
  ipAddress: string | null;

  @Column({ name: 'used_token', type: 'varchar', nullable: true })
  usedToken: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Tenant, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
