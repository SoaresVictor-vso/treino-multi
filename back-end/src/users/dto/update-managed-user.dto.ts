import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateManagedUserDto {
  @ApiPropertyOptional({ example: 'Joao da Silva' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'joao@email.com' })
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional({ example: '12345678901', nullable: true })
  @IsOptional()
  @IsString()
  @Length(11, 11)
  document?: string | null;

  @ApiPropertyOptional({ example: '11999990000', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(11)
  fone?: string | null;
}
