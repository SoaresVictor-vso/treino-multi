import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { Role } from '../enums/role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * RolesGuard — verifica se o usuário autenticado possui pelo menos uma das
 * roles exigidas pelo decorator @Roles().
 *
 * Comportamento:
 * - Se nenhuma role for exigida (metadata ausente), o acesso é liberado.
 * - A lista de roles vem de request.user.roles, populado pelo JwtStrategy.
 * - Deve ser usado APÓS o JwtAuthGuard (que garante que request.user existe).
 * - A verificação é por INCLUSÃO: basta ter UMA das roles listadas.
 *
 * Uso:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles(Role.ORG_ADMIN)
 *   @Get('admin-only')
 *   adminAction() { ... }
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Lê as roles exigidas do handler ou do controller (herança de metadados)
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Sem restrição de role → acesso liberado
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user: JwtPayload }>();

    // JwtAuthGuard deve garantir que user existe; defensivamente checamos aqui
    if (!user || !Array.isArray(user.roles)) {
      throw new ForbiddenException('Acesso negado: usuário não autenticado');
    }

    const hasRole = requiredRoles.some((role) => user.roles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(
        `Acesso negado: role(s) exigida(s): [${requiredRoles.join(', ')}]`,
      );
    }

    return true;
  }
}
