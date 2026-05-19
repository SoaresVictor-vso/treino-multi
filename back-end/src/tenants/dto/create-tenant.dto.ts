import {
  IsBoolean,
  IsOptional,
  IsString,
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
  name: string;

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
  slug: string;

  @ApiProperty({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
