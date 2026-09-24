import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { OAuthProvider } from '../../common/enums/oauth-provider.enum';

@Entity('external_identities')
export class ExternalIdentity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId!: string;
  @Column({ type: 'enum', enum: OAuthProvider, enumName: 'oauth_provider_enum' }) provider!: OAuthProvider;
  @Column({ type: 'varchar' }) subject!: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'user_id' }) user!: User;
}
