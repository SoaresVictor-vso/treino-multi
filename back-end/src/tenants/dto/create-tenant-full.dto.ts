import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { CreateTenantAdminDto } from './create-tenant-admin.dto';
import { CreateTenantDto } from './create-tenant.dto';

export class CreateTenantFullDto {
  @ApiProperty({ type: () => CreateTenantAdminDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateTenantAdminDto)
  admin!: CreateTenantAdminDto;

  @ApiProperty({ type: () => CreateTenantDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateTenantDto)
  tenant!: CreateTenantDto;
}
