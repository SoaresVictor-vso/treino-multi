import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export enum UserOrderBy {
  ID = 'id',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  NAME = 'name',
}

export class FindUsersQueryDto {
  @ApiPropertyOptional({
    example: 'f7b3b53b-d6f6-431f-814c-cb8406f00121',
    description: "Use 'null' para listar usuarios sem tenant.",
  })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ example: 'joao' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'tenant:admin', enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({
    example: UserOrderBy.CREATED_AT,
    enum: UserOrderBy,
    description: 'Campo usado na ordenação e no cursor de paginação.',
  })
  @IsOptional()
  @IsEnum(UserOrderBy)
  orderBy?: UserOrderBy;

  @ApiPropertyOptional({
    example: '2026-07-02T10:00:00.000Z',
    description: 'Valor do campo de ordenação do último elemento recebido.',
  })
  @IsOptional()
  @IsString()
  start?: string;

  @ApiPropertyOptional({ example: '20' })
  @IsOptional()
  @IsString()
  limit?: string;
}
