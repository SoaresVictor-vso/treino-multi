import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('persons')
export class Person {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  email?: string | null;

  /**
   * documento de identificação da pessoa (CPF etc.).
   * 11 caracteres, obrigatório, único.
   */
  @Column({ type: 'char', length: 11, unique: true, nullable: true })
  document?: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;

  @OneToMany(() => User, (user) => user.person)
  users?: User[];
}
