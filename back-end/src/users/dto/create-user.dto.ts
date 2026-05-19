import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../common/enums/role.enum';

export type UserContext = 'organization' | 'tenant' | 'standalone';

export class CreateUserDto {
  @ApiProperty({ example: 'uuid-da-person' })
  @IsUUID()
  personId: string;

  /**
   * Obrigatório quando context = 'tenant'.
   * Deve ser null/omitido para 'organization' e 'standalone'.
   */
  @ApiProperty({ example: 'uuid-do-tenant' })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  /** Contexto de autenticação: 'organization', 'tenant' ou 'standalone'. */
  @ApiProperty({ example: 'tenant' })
  @IsEnum(['organization', 'tenant', 'standalone'], {
    message: "context deve ser 'organization', 'tenant' ou 'standalone'",
  })
  context: UserContext;

  @ApiProperty({ example: 'S3nh@F0rt3!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: [Role.TENANT_ADMIN] })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(Role, { each: true })
  roles: Role[];
}
