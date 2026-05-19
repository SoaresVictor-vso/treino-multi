import { IsOptional, IsString, Length, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  /**
   * Identificador do usuário: pode ser o e-mail ou o document (11 dígitos).
   */
  @ApiProperty({
    example: 'admin@minha-empresa.com',
    description: 'E-mail ou document (CPF) da pessoa física',
  })
  @IsString()
  login: string;

  @ApiProperty({ example: 'S3nh@F0rt3!' })
  @IsString()
  @MinLength(8)
  password: string;

  /** Slug do tenant — presente quando o contexto é 'tenant'. Obrigatório quando context=tenant. */
  @ApiProperty({
    example: 'acme-corp',
  })
  @IsOptional()
  @IsString()
  tenantSlug?: string;
}
