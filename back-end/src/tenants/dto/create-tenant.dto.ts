import {
  IsEmail,
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({ example: 'ACME Corp' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  /**
   * Slug único que identifica o tenant nas rotas e no JWT.
   * Deve conter apenas letras minúsculas, dígitos e hífens.
   */
  @ApiProperty({ example: 'acme-corp' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug deve conter apenas letras minúsculas, dígitos e hífens',
  })
  slug!: string;

  @ApiProperty({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ example: 'Admin do Tenant' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  adminName!: string;

  @ApiProperty({ example: 'admin@acme-corp.com' })
  @IsEmail()
  adminEmail!: string;

  @ApiProperty({ example: '12345678901' })
  @IsString()
  @Length(11, 14)
  adminDocument!: string;

  @ApiProperty({ example: '+5511999990000', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  adminPhone?: string;

  @ApiProperty({ example: 'S3nh@F0rt3!' })
  @IsString()
  @MinLength(8)
  adminPassword!: string;
}
