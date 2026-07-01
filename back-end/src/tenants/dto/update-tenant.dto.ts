import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { CreateTenantDto } from './create-tenant.dto';
import { IsBoolean, IsOptional } from 'class-validator';

class UpdateTenantBaseDto extends PartialType(
  OmitType(CreateTenantDto, ['slug'] as const),
) {}

export class UpdateTenantDto extends UpdateTenantBaseDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
