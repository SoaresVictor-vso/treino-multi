import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const emptyStringToNull = ({ value }: { value: unknown }) =>
  value === '' ? null : value;

export class CreateTenantDto {
  @ApiProperty({ example: 'ACME Corp', maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  trade_name!: string;

  @ApiProperty({ example: 'acme-corp' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug deve conter apenas letras minúsculas, dígitos e hífens',
  })
  slug!: string;

  @ApiProperty({ example: '12345678000199', required: false })
  @IsOptional()
  @Transform(emptyStringToNull)
  @IsString()
  @Length(14, 14)
  cnpj?: string;

  @ApiProperty({ example: 'ACME Industria e Comercio LTDA', required: false, maxLength: 120 })
  @IsOptional()
  @Transform(emptyStringToNull)
  @IsString()
  @MaxLength(120)
  registered_name?: string;

  @ApiProperty({ example: '11999990000', minLength: 11, maxLength: 11 })
  @IsString()
  @Length(11, 11)
  phone!: string;

  @ApiProperty({ example: 'contato@acme-corp.com' })
  @IsEmail()
  email!: string;
}
