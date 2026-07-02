import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Role } from '../../common/enums/role.enum';
import type { UserContext } from '../entities/user.entity';

const USER_CONTEXTS: UserContext[] = ['organization', 'tenant', 'standalone'];

export class CreateManagedUserDto {
  @ApiProperty({ example: 'Joao da Silva' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'joao@email.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '12345678901', nullable: true })
  @ValidateIf((_obj, value) => value !== undefined && value !== null)
  @IsString()
  @Length(11, 11)
  document?: string | null;

  @ApiPropertyOptional({ example: '11999990000', nullable: true })
  @ValidateIf((_obj, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(11)
  fone?: string | null;

  @ApiPropertyOptional({ example: 'f7b3b53b-d6f6-431f-814c-cb8406f00121', nullable: true })
  @ValidateIf((_obj, value) => value !== undefined && value !== null)
  @IsUUID()
  tenantId?: string | null;

  @ApiProperty({ example: 'tenant', enum: USER_CONTEXTS })
  @IsIn(USER_CONTEXTS, {
    message: "context deve ser 'organization', 'tenant' ou 'standalone'",
  })
  context!: UserContext;

  @ApiProperty({ example: 'NovaSenha@123' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: [Role.TENANT_ADMIN], enum: Role, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(Object.values(Role), { each: true })
  roles!: Role[];
}
