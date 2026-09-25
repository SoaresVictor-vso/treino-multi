import { enums } from '@treino-multi/shared';
const { Permission, AthleteReadScope } = enums;
type Permission = enums.Permission;
type AthleteReadScope = enums.AthleteReadScope;
import { Body, Controller, Get, Ip, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsEnum, IsString } from 'class-validator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';

import { AthleteTenantAssociationsService } from './athlete-tenant-associations.service';

class InviteDto { @IsEmail() email!: string; @IsString() password!: string; }
class OperatorEndDto { @IsString() password!: string; }
class ScopeDto { @IsEnum(AthleteReadScope) scope!: AthleteReadScope; }

@ApiTags('athlete-tenant-associations')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('athlete-tenant-associations')
export class AthleteTenantAssociationsController {
  constructor(private readonly service: AthleteTenantAssociationsService) {}

  @Get('mine') mine(@CurrentUser() actor: JwtPayload) { return this.service.mine(actor); }

  @Get('tenant-history')
  @RequirePermissions(Permission.ATHLETE_TENANT_ASSOCIATION_MANAGE)
  tenantHistory(@CurrentUser() actor: JwtPayload) { return this.service.tenantHistory(actor); }

  @Get('tenant-active')
  @RequirePermissions(Permission.ATHLETE_TENANT_ASSOCIATION_MANAGE)
  tenantActive(@CurrentUser() actor: JwtPayload) { return this.service.tenantActive(actor); }

  @Post('invite')
  @RequirePermissions(Permission.ATHLETE_TENANT_ASSOCIATION_MANAGE)
  invite(@CurrentUser() actor: JwtPayload, @Body() dto: InviteDto, @Ip() ip: string) {
    return this.service.invite(actor, dto.email, dto.password, ip);
  }

  @Post(':id/revoke')
  @RequirePermissions(Permission.ATHLETE_TENANT_ASSOCIATION_MANAGE)
  revoke(@CurrentUser() actor: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Ip() ip: string) {
    return this.service.revoke(actor, id, ip);
  }

  @Post(':id/accept') accept(@CurrentUser() actor: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Ip() ip: string) {
    return this.service.decide(actor, id, true, ip);
  }
  @Post(':id/reject') reject(@CurrentUser() actor: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Ip() ip: string) {
    return this.service.decide(actor, id, false, ip);
  }
  @Post(':id/end-mine') endMine(@CurrentUser() actor: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Ip() ip: string) {
    return this.service.end(actor, id, undefined, ip);
  }
  @Post(':id/end-tenant')
  @RequirePermissions(Permission.ATHLETE_TENANT_ASSOCIATION_MANAGE)
  endTenant(@CurrentUser() actor: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: OperatorEndDto, @Ip() ip: string) {
    return this.service.end(actor, id, dto.password, ip);
  }
  @Patch(':id/scope') scope(@CurrentUser() actor: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ScopeDto, @Ip() ip: string) {
    return this.service.changeScope(actor, id, dto.scope, ip);
  }
}
