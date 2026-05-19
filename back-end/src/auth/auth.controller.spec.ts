/**
 * Testes unitários do AuthController — Fase 2
 *
 * O controller é testado isolando o AuthService com mocks.
 * Focamos nos contratos da camada HTTP:
 *
 *   - Quais métodos do serviço são chamados
 *   - O que é retornado ao cliente
 *   - Os status codes corretos (200, 204)
 *   - Que dados sensíveis (password) NÃO chegam ao service diretamente
 *     sem passar pela validação da LocalStrategy
 *
 * Guards (JwtAuthGuard, LocalAuthGuard) são desligados nestes testes unitários
 * para nos concentrarmos apenas na lógica do controller.
 * Os guards possuem suas próprias spec files.
 *
 * Para testes E2E com guards ativos, ver test/app.e2e-spec.ts (Fase 6).
 */

import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService, AuthTokens } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ImpersonateDto } from './dto/impersonate.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { Role } from '../common/enums/role.enum';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ExecutionContext } from '@nestjs/common';
// ExecutionContext used in overrideGuard callback below

/** Payload de usuário autenticado injetado pelo @CurrentUser decorator nos testes */
const ORG_SUPPORT_PAYLOAD: JwtPayload = {
  sub: 'org-support-uuid',
  personId: 'person-uuid-1',
  context: 'organization',
  tenantId: null,
  roles: [Role.ORG_SUPPORT],
  impersonatedBy: null,
};

/** Resposta padrão de login para reusar nos testes */
const AUTH_TOKENS: AuthTokens = {
  accessToken: 'access-token-mock',
  refreshToken: 'refresh-token-mock',
};

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  /**
   * Desligamos os guards reais para não precisar de JWT nem banco nestes testes.
   * O LocalAuthGuard é substituído por um guard que sempre passa (canActivate = true).
   * O JwtAuthGuard também é sobrescrito para confirmar acesso.
   */
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
            refreshAccessToken: jest.fn(),
            logout: jest.fn(),
            impersonate: jest.fn(),
          },
        },
      ],
    })
      /**
       * Substituímos o LocalStrategy guard por um que sempre libera acesso.
       * Em tests unitários de controller não queremos validar a estratégia de auth.
       */
      .overrideGuard(AuthGuard('local'))
      .useValue({ canActivate: () => true })
      // JwtAuthGuard também bypassado para testar rotas protegidas
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          // Injeta o payload mockado em request.user para @CurrentUser funcionar
          const req = ctx.switchToHttp().getRequest();
          req.user = ORG_SUPPORT_PAYLOAD;
          return true;
        },
      })
      /**
       * Guards da Fase 3: também bypassados para testar apenas o controller.
       * Cada um possui sua própria spec file com cobertura completa.
       */
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AuthController);
    authService = module.get(AuthService) as jest.Mocked<AuthService>;
  });

  // ── POST /auth/login ──────────────────────────────────────────────────────

  describe('login()', () => {
    /**
     * Cenário feliz: login retorna { accessToken, refreshToken }.
     * O controller deve repassar ip e userAgent ao AuthService.
     */
    it('deve retornar accessToken e refreshToken', async () => {
      authService.login.mockResolvedValue(AUTH_TOKENS);

      const dto: LoginDto = { login: 'admin@org.com', password: '12345678' };
      const req = { headers: { 'user-agent': 'jest-test-agent' } } as any;

      const result = await controller.login(dto, '127.0.0.1', req);

      expect(result).toEqual(AUTH_TOKENS);
      expect(authService.login).toHaveBeenCalledWith(dto, '127.0.0.1', 'jest-test-agent');
    });

    /**
     * Verifica que sem User-Agent o controller ainda funciona
     * (userAgent = undefined é passado ao serviço).
     */
    it('deve funcionar mesmo sem header User-Agent', async () => {
      authService.login.mockResolvedValue(AUTH_TOKENS);

      const dto: LoginDto = { login: 'admin@org.com', password: '12345678' };
      const req = { headers: {} } as any;

      await controller.login(dto, '127.0.0.1', req);

      expect(authService.login).toHaveBeenCalledWith(dto, '127.0.0.1', undefined);
    });
  });

  // ── POST /auth/refresh ────────────────────────────────────────────────────

  describe('refresh()', () => {
    /**
     * Cenário feliz: token válido → retorna novo accessToken.
     */
    it('deve retornar novo accessToken', async () => {
      authService.refreshAccessToken.mockResolvedValue({ accessToken: 'new-access-token' });

      const dto: RefreshTokenDto = { refreshToken: 'valid-refresh-token' };
      const result = await controller.refresh(dto);

      expect(result).toEqual({ accessToken: 'new-access-token' });
      expect(authService.refreshAccessToken).toHaveBeenCalledWith('valid-refresh-token');
    });

    /**
     * O controller deve propagar exceções do service sem mascarar
     * (UnauthorizedException, NotFoundException, etc.).
     * O filtro global de exceções cuidará do formato da resposta.
     */
    it('deve propagar exceções do AuthService', async () => {
      authService.refreshAccessToken.mockRejectedValue(
        new UnauthorizedException('Token expirado'),
      );

      const dto: RefreshTokenDto = { refreshToken: 'expired-token' };

      await expect(controller.refresh(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── POST /auth/logout ─────────────────────────────────────────────────────

  describe('logout()', () => {
    /**
     * Cenário feliz: logout revoga o token, controller retorna sem body (204).
     * Verificamos que o authService.logout foi chamado com o token correto.
     */
    it('deve chamar authService.logout e retornar void', async () => {
      authService.logout.mockResolvedValue(undefined);

      const dto: RefreshTokenDto = { refreshToken: 'token-to-revoke' };
      const result = await controller.logout(dto);

      expect(result).toBeUndefined();
      expect(authService.logout).toHaveBeenCalledWith('token-to-revoke');
    });
  });

  // ── POST /auth/impersonate ────────────────────────────────────────────────

  describe('impersonate()', () => {
    /**
     * Cenário feliz: org:support solicita impersonation.
     * O controller deve extrair o sub do @CurrentUser e passar ao service.
     */
    it('deve retornar accessToken de impersonation para org:support', async () => {
      authService.impersonate.mockResolvedValue({ accessToken: 'impersonation-token' });

      const dto: ImpersonateDto = { tenantId: 'tenant-uuid-1' };

      const result = await controller.impersonate(ORG_SUPPORT_PAYLOAD, dto);

      expect(result).toEqual({ accessToken: 'impersonation-token' });
      expect(authService.impersonate).toHaveBeenCalledWith(
        ORG_SUPPORT_PAYLOAD.sub, // actorUserId vem do @CurrentUser
        'tenant-uuid-1',
        undefined, // targetUserId não informado no dto
      );
    });

    /**
     * Com targetUserId explícito: deve repassar o UUID ao service.
     */
    it('deve repassar targetUserId quando informado', async () => {
      authService.impersonate.mockResolvedValue({ accessToken: 'impersonation-token' });

      const dto: ImpersonateDto = {
        tenantId: 'tenant-uuid-1',
        targetUserId: 'target-user-uuid',
      };

      await controller.impersonate(ORG_SUPPORT_PAYLOAD, dto);

      expect(authService.impersonate).toHaveBeenCalledWith(
        ORG_SUPPORT_PAYLOAD.sub,
        'tenant-uuid-1',
        'target-user-uuid',
      );
    });
  });
});
