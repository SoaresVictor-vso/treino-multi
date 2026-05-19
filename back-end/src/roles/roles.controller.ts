import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Permission } from '../common/enums/permission.enum';
import { Role } from '../common/enums/role.enum';
import { ROLE_PERMISSIONS } from '../common/enums/role-permissions.map';

/**
 * Módulo readonly que expõe o mapa estático de roles→permissões.
 * Restrito a org:admin via permissão USER_READ.
 */
@ApiTags('roles')
@ApiBearerAuth('JWT')
@Controller('roles')
export class RolesController {
  /**
   * GET /roles
   * Retorna lista de todas as roles com suas permissões efetivas.
   */
  @ApiOperation({ summary: 'Lista todas as roles e suas permissões' })
  @ApiResponse({ status: 200, description: 'Mapa role → permissões' })
  @Get()
  @RequirePermissions(Permission.USER_READ)
  findAll() {
    return Object.values(Role).map((role) => ({
      role,
      permissions: ROLE_PERMISSIONS[role],
    }));
  }

  /**
   * GET /roles/:role
   * Retorna as permissões de uma role específica.
   */
  @ApiOperation({ summary: 'Busca permissões de uma role específica' })
  @ApiResponse({ status: 200, description: 'Role encontrada' })
  @Get(':role')
  @RequirePermissions(Permission.USER_READ)
  findOne(@Param('role') role: string) {
    const r = role as Role;
    if (!Object.values(Role).includes(r)) {
      return { error: `Role "${role}" não existe.` };
    }
    return { role: r, permissions: ROLE_PERMISSIONS[r] };
  }
}
