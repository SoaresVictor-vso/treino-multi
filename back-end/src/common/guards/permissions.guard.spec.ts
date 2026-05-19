/**
 * Testes unitários do PermissionsGuard — Fase 3
 *
 * O PermissionsGuard protege endpoints pelo decorator @RequirePermissions(...).
 *
 * Diferença em relação ao RolesGuard:
 * - Não compara roles diretamente, mas sim as permissões derivadas delas.
 * - Usa resolvePermissions() (ROLE_PERMISSIONS) para calcular a união das
 *   permissões efetivas em runtime — mantendo o JWT pequeno.
 * - A verificação é por INTERSEÇÃO TOTAL: todas as permissões listadas devem
 *   estar presentes no conjunto efetivo do usuário.
 *
 * Cobertura:
 * - Meta ausente → liberado
 * - ORG_ADMIN tem todas as permissões → sempre passa
 * - Role específica cobre a permissão exigida → passa
 * - Role não cobre a permissão → ForbiddenException
 * - Múltiplas permissões exigidas: faltando qualquer uma → ForbiddenException
 * - União de múltiplas roles cobre o conjunto exigido → passa
 */

import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { Permission } from '../enums/permission.enum';
import { Role } from '../enums/role.enum';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

// ── helpers ───────────────────────────────────────────────────────────────────

const makeContext = (userRoles: Role[]) => {
  const userPayload: Partial<JwtPayload> = {
    sub: 'user-uuid-1',
    roles: userRoles,
    context: 'tenant',
    tenantId: 'tenant-uuid-1',
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

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as any;
    guard = new PermissionsGuard(reflector);
  });

  // ── meta ausente ──────────────────────────────────────────────────────────

  /**
   * Endpoint sem @RequirePermissions() → nenhuma permissão exigida → acesso livre.
   */
  it('deve permitir acesso quando nenhuma permissão é exigida (metadata ausente)', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(makeContext([]))).toBe(true);
  });

  it('deve permitir acesso quando a lista de permissões exigidas está vazia', () => {
    reflector.getAllAndOverride.mockReturnValue([]);

    expect(guard.canActivate(makeContext([]))).toBe(true);
  });

  // ── ORG_ADMIN tem acesso total ────────────────────────────────────────────

  /**
   * ORG_ADMIN tem Object.values(Permission) no mapa → deve passar qualquer
   * combinação de permissões exigidas.
   */
  it('deve permitir acesso ao ORG_ADMIN para qualquer permissão', () => {
    reflector.getAllAndOverride.mockReturnValue([
      Permission.TENANT_DELETE,
      Permission.USER_IMPERSONATE,
      Permission.FINANCIAL_REPORTS_READ,
    ]);

    expect(guard.canActivate(makeContext([Role.ORG_ADMIN]))).toBe(true);
  });

  // ── cenários felizes por role ─────────────────────────────────────────────

  /**
   * TENANT_ADMIN tem FINANCIAL_INVOICES_READ → deve passar.
   */
  it('deve permitir acesso ao TENANT_ADMIN para FINANCIAL_INVOICES_READ', () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.FINANCIAL_INVOICES_READ]);

    expect(guard.canActivate(makeContext([Role.TENANT_ADMIN]))).toBe(true);
  });

  /**
   * TENANT_FINANCIAL tem FINANCIAL_INVOICES_CREATE → deve passar.
   */
  it('deve permitir acesso ao TENANT_FINANCIAL para FINANCIAL_INVOICES_CREATE', () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.FINANCIAL_INVOICES_CREATE]);

    expect(guard.canActivate(makeContext([Role.TENANT_FINANCIAL]))).toBe(true);
  });

  /**
   * TENANT_ATTENDANT tem ATTENDANCE_TICKETS_UPDATE → deve passar.
   */
  it('deve permitir acesso ao TENANT_ATTENDANT para ATTENDANCE_TICKETS_UPDATE', () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.ATTENDANCE_TICKETS_UPDATE]);

    expect(guard.canActivate(makeContext([Role.TENANT_ATTENDANT]))).toBe(true);
  });

  /**
   * ORG_SUPPORT tem USER_IMPERSONATE → deve passar (base da proteção de /auth/impersonate).
   */
  it('deve permitir acesso ao ORG_SUPPORT para USER_IMPERSONATE', () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.USER_IMPERSONATE]);

    expect(guard.canActivate(makeContext([Role.ORG_SUPPORT]))).toBe(true);
  });

  // ── permissões por union de roles ─────────────────────────────────────────

  /**
   * Usuário com TENANT_FINANCIAL + TENANT_ATTENDANT:
   * permissões efetivas = união de ambas as listas.
   * Se o endpoint exige FINANCIAL_INVOICES_READ + ATTENDANCE_TICKETS_CREATE,
   * a união cobre ambas → acesso permitido.
   */
  it('deve considerar a união de permissões de múltiplas roles', () => {
    reflector.getAllAndOverride.mockReturnValue([
      Permission.FINANCIAL_INVOICES_READ,
      Permission.ATTENDANCE_TICKETS_CREATE,
    ]);

    const context = makeContext([Role.TENANT_FINANCIAL, Role.TENANT_ATTENDANT]);
    expect(guard.canActivate(context)).toBe(true);
  });

  // ── cenários de rejeição ──────────────────────────────────────────────────

  /**
   * STANDALONE_USER só tem auth:login/logout/refresh — não tem USER_CREATE.
   */
  it('deve lançar ForbiddenException quando o usuário não tem a permissão exigida', () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.USER_CREATE]);

    expect(() => guard.canActivate(makeContext([Role.STANDALONE_USER]))).toThrow(
      ForbiddenException,
    );
  });

  /**
   * TENANT_FINANCIAL não tem USER_DELETE.
   */
  it('deve lançar ForbiddenException quando TENANT_FINANCIAL tenta USER_DELETE', () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.USER_DELETE]);

    expect(() => guard.canActivate(makeContext([Role.TENANT_FINANCIAL]))).toThrow(
      ForbiddenException,
    );
  });

  /**
   * TENANT_FINANCIAL + TENANT_ATTENDANT, mas o endpoint exige USER_IMPERSONATE
   * (exclusivo de ORG_SUPPORT) — nenhuma das roles cobre isso.
   */
  it('deve lançar ForbiddenException quando nenhuma das roles cobre USER_IMPERSONATE', () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.USER_IMPERSONATE]);

    const context = makeContext([Role.TENANT_FINANCIAL, Role.TENANT_ATTENDANT]);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  /**
   * Múltiplas permissões exigidas, mas falta uma:
   * TENANT_ADMIN tem FINANCIAL_INVOICES_READ mas NÃO tem FINANCIAL_INVOICES_CREATE.
   * Como ambas são exigidas, deve rejeitar.
   */
  it('deve lançar ForbiddenException quando o usuário tem apenas parte das permissões exigidas', () => {
    reflector.getAllAndOverride.mockReturnValue([
      Permission.FINANCIAL_INVOICES_READ,
      Permission.FINANCIAL_INVOICES_CREATE, // TENANT_ADMIN não tem esta
    ]);

    expect(() => guard.canActivate(makeContext([Role.TENANT_ADMIN]))).toThrow(
      ForbiddenException,
    );
  });

  /**
   * Usuário sem roles → sem permissões efetivas → qualquer exigência falha.
   */
  it('deve lançar ForbiddenException quando o usuário não possui nenhuma role', () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.TENANT_READ]);

    expect(() => guard.canActivate(makeContext([]))).toThrow(ForbiddenException);
  });

  /**
   * Sem usuário autenticado — comportamento defensivo.
   */
  it('deve lançar ForbiddenException quando request.user está ausente', () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.TENANT_READ]);

    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user: null }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  // ── verificação da chave de metadata ─────────────────────────────────────

  /**
   * O Reflector deve ser consultado com PERMISSIONS_KEY para handler e classe,
   * permitindo uso do decorator tanto em handlers individuais quanto no controller.
   */
  it('deve consultar o Reflector com PERMISSIONS_KEY para handler e classe', () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.TENANT_READ]);
    const context = makeContext([Role.ORG_ADMIN]);

    guard.canActivate(context);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });
});
