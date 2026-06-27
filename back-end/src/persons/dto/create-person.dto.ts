import { IsEmail, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePersonDto {
  @ApiProperty({ example: 'João da Silva' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'joao@email.com' })
  @IsEmail()
  email!: string;

  /** Documento de identificação da pessoa (CPF) — exatamente 11 dígitos, sem pontuação. */
  @ApiProperty({ example: '12345678901' })
  @IsOptional()
  @IsString()
  @Length(11)
  document?: string;

  @ApiProperty({ example: '11999990000' })
  @IsOptional()
  @IsString()
  @MaxLength(11)
  phone?: string;
}
