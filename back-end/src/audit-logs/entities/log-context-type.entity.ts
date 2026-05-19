import { Column, Entity, PrimaryColumn } from 'typeorm';

export type LogContextTypeName = 'organization' | 'tenant' | 'standalone';

/**
 * Tabela de lookup com os três contextos de log.
 * Seedada na migration — nunca alterada em runtime.
 *
 * | id | name           |
 * |----|----------------|
 * |  1 | organization   |
 * |  2 | tenant         |
 * |  3 | standalone     |
 */
@Entity('log_context_types')
export class LogContextType {
  @PrimaryColumn({ type: 'smallint' })
  id: number;

  @Column({ type: 'varchar', unique: true })
  name: LogContextTypeName;
}
