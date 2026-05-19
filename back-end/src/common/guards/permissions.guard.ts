import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { Permission } from '../enums/permission.enum';
import { Role } from '../enums/role.enum';
import { resolvePermissions } from '../enums/role-permissions.map';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

/**
 * PermissionsGuard — verifica se o usuário autenticado possui TODAS as
 * permissões exigidas pelo decorator @RequirePermissions().
 *
 * Comportamento:
 * - Se nenhuma permissão for exigida (metadata ausente), o acesso é liberado.
 * - As permissões efetivas são calculadas em runtime como a UNIÃO das permissões
 *   de todas as roles do usuário, usando o mapa estático ROLE_PERMISSIONS.
 *   Isso mantém o JWT pequeno (só carrega roles) e garante revogação imediata
 *   caso uma role seja removida do enum (processada pelo DatabaseSyncService).
 * - A verificação é por INTERSEÇÃO TOTAL: o usuário precisa ter TODAS as
 *   permissões listadas.
 * - Deve ser usado APÓS o JwtAuthGuard.
 *
 * Uso:
 *   @UseGuards(JwtAuthGuard, PermissionsGuard)
 *   @RequirePermissions(Permission.TENANT_CREATE)
 *   @Post('tenants')
 *   createTenant() { ... }
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Lê as permissões exigidas do handler ou do controller
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Sem restrição de permissão → acesso liberado
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user: JwtPayload }>();

    if (!user || !Array.isArray(user.roles)) {
      throw new ForbiddenException('Acesso negado: usuário não autenticado');
    }

    // Calcula as permissões efetivas em runtime (não vêm do JWT)
    const effectivePermissions = resolvePermissions(user.roles as Role[]);

    const missingPermissions = requiredPermissions.filter(
      (p) => !effectivePermissions.includes(p),
    );

    if (missingPermissions.length > 0) {
      throw new ForbiddenException(
        `Acesso negado: permissão(ões) ausente(s): [${missingPermissions.join(', ')}]`,
      );
    }

    return true;
  }
}
