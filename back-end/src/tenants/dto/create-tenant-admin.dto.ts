import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class CreateTenantAdminDto {
  @ApiProperty({ example: 'Admin do Tenant', maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'admin@acme-corp.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '12345678901', minLength: 11, maxLength: 11 })
  @IsString()
  @Length(11, 11)
  cpf!: string;

  @ApiProperty({ example: '11999990000', minLength: 11, maxLength: 11 })
  @IsString()
  @Length(11, 11)
  phone!: string;

  @ApiProperty({ example: 'S3nh@F0rt3!' })
  @IsString()
  @MinLength(8)
  password!: string;
}
