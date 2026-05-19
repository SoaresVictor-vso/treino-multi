/**
 * Testes unitários do RolesGuard — Fase 3
 *
 * O RolesGuard protege endpoints pelo decorator @Roles(...).
 * Sua lógica é simples e determinística: compara request.user.roles com
 * a lista de roles exigidas no metadata.
 *
 * Estratégia de teste:
 * - Instanciamos o guard diretamente (sem módulo NestJS) para máxima simplicidade.
 * - Criamos um ExecutionContext mínimo que expõe request.user e os metadados.
 * - Mockamos o Reflector para controlar quais roles são exigidas por rota.
 */

import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '../enums/role.enum';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { ROLES_KEY } from '../decorators/roles.decorator';

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Cria um ExecutionContext mínimo que simula uma requisição autenticada.
 * O user é o payload JWT; handler e class são objetos vazios (não importam
 * para este guard, pois o Reflector já é mockado externamente).
 */
const makeContext = (userRoles: Role[]) => {
  const userPayload: Partial<JwtPayload> = {
    sub: 'user-uuid-1',
    roles: userRoles,
    context: 'organization',
    tenantId: null,
    impersonatedBy: null,
  };

  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: userPayload }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
};

// ── suite ─────────────────────────────────────────────────────────────────────

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as any;
    guard = new RolesGuard(reflector);
  });

  // ── meta ausente ──────────────────────────────────────────────────────────

  /**
   * Rota sem @Roles() → sem restrição de role → qualquer usuário autenticado
   * pode acessar. O guard não deve interferir.
   */
  it('deve permitir acesso quando nenhuma role é exigida (metadata ausente)', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const context = makeContext([]);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('deve permitir acesso quando a lista de roles exigidas está vazia', () => {
    reflector.getAllAndOverride.mockReturnValue([]);

    const context = makeContext([]);
    expect(guard.canActivate(context)).toBe(true);
  });

  // ── cenários felizes ──────────────────────────────────────────────────────

  /**
   * Usuário possui exatamente a role exigida → acesso permitido.
   */
  it('deve permitir acesso quando o usuário possui a role exigida', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ORG_ADMIN]);

    const context = makeContext([Role.ORG_ADMIN]);
    expect(guard.canActivate(context)).toBe(true);
  });

  /**
   * São exigidas duas roles (OR lógico), e o usuário possui uma delas.
   * Basta ter pelo menos uma.
   */
  it('deve permitir acesso quando o usuário possui ao menos uma das roles exigidas', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ORG_ADMIN, Role.TENANT_ADMIN]);

    const context = makeContext([Role.TENANT_ADMIN]);
    expect(guard.canActivate(context)).toBe(true);
  });

  /**
   * Usuário multi-role (ex: tenant:admin + tenant:financial).
   * Se o endpoint exige tenant:financial, o acesso deve ser permitido.
   */
  it('deve permitir acesso para usuário com múltiplas roles quando uma coincide', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.TENANT_FINANCIAL]);

    const context = makeContext([Role.TENANT_ADMIN, Role.TENANT_FINANCIAL]);
    expect(guard.canActivate(context)).toBe(true);
  });

  // ── cenários de rejeição ──────────────────────────────────────────────────

  /**
   * Usuário não possui nenhuma das roles exigidas → ForbiddenException (403).
   */
  it('deve lançar ForbiddenException quando o usuário não possui a role exigida', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ORG_ADMIN]);

    const context = makeContext([Role.STANDALONE_USER]);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  /**
   * Usuário com lista de roles vazia — não possui nenhuma role.
   */
  it('deve lançar ForbiddenException quando o usuário não possui nenhuma role', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ORG_ADMIN]);

    const context = makeContext([]);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  /**
   * Rota protegida mas sem usuário autenticado (request.user inexistente).
   * Isso não deveria ocorrer (JwtAuthGuard bloqueia antes), mas o guard
   * deve se comportar de forma defensiva.
   */
  it('deve lançar ForbiddenException quando request.user está ausente', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ORG_ADMIN]);

    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user: null }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  // ── verificação da chave de metadata ─────────────────────────────────────

  /**
   * Garante que o Reflector é consultado com ROLES_KEY para handler E classe.
   * Isso permite @Roles() em nível de controller inteiro (herança de metadados).
   */
  it('deve consultar o Reflector com ROLES_KEY para handler e classe', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ORG_ADMIN]);
    const context = makeContext([Role.ORG_ADMIN]);

    guard.canActivate(context);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });
});
