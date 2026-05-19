import { IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ImpersonateDto {
  @ApiProperty({ example: 'uuid-do-tenant' })
  @IsUUID()
  tenantId: string;

  /** ID do usuário-alvo dentro do tenant. Se omitido, usa o primeiro tenant:admin do tenant. */
  @ApiProperty({ example: 'uuid-do-usuario-alvo' })
  @IsOptional()
  @IsUUID()
  targetUserId?: string;
}
