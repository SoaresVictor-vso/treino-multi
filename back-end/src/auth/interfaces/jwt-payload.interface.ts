import { UserContext } from '../../users/entities/user.entity';
import { Role } from '../../common/enums/role.enum';

/**
 * Payload completo embutido no JWT de acesso.
 * Calculado em AuthService.login() e retornado por JwtStrategy.validate().
 */
export interface JwtPayload {
  /** ID do User (vínculo contexto) */
  sub: string;

  /** ID da Person física */
  personId: string;

  /** Contexto de autenticação: 'organization' | 'tenant' | 'standalone' */
  context: UserContext;

  /** UUID do tenant — nulo para contexto org/standalone */
  tenantId: string | null;

  /** Roles ativas do usuário neste contexto */
  roles: Role[];

  /**
   * ID do usuário org:support que iniciou a impersonation.
   * Nulo em fluxos normais de login.
   */
  impersonatedBy: string | null;

  /** Emitido em (Unix timestamp) */
  iat?: number;

  /** Expira em (Unix timestamp) */
  exp?: number;
}
