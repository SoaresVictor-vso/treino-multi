/**
 * Testes E2E do módulo de autenticação — Fase 6
 *
 * Estratégia:
 * - Cria um módulo de teste self-contained reutilizando os controllers e guards
 *   reais, substituindo o AuthService por um mock (sem necessidade de DB real).
 * - Testa a camada HTTP de ponta a ponta: ValidationPipe, LocalStrategy,
 *   JwtAuthGuard, RolesGuard, PermissionsGuard e respostas HTTP corretas.
 */

import {
  INestApplication,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { App } from 'supertest/types';

import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { LocalStrategy } from '../src/auth/strategies/local.strategy';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { PermissionsGuard } from '../src/common/guards/permissions.guard';
import { JwtPayload } from '../src/auth/interfaces/jwt-payload.interface';
import { Role } from '../src/common/enums/role.enum';

// ── constantes ────────────────────────────────────────────────────────────────

const TEST_JWT_SECRET = 'e2e-test-secret-key-256-bits-long!!';
const MOCK_ACCESS_TOKEN = 'mock-access-token-returned-by-service';
const MOCK_REFRESH_TOKEN = 'mock-refresh-token-abc123';
const VALID_TENANT_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const VALID_USER_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// ── mock do AuthService ───────────────────────────────────────────────────────

const mockAuthService = {
  validateUser: jest.fn(),
  login: jest.fn(),
  refreshAccessToken: jest.fn(),
  logout: jest.fn(),
  impersonate: jest.fn(),
};

// ── helper: JWT de teste ──────────────────────────────────────────────────────

let _jwtService: JwtService;
const makeToken = (overrides: Partial<JwtPayload> = {}): string =>
  _jwtService.sign({
    sub: 'user-uuid-1',
    personId: 'person-uuid-1',
    context: 'organization',
    tenantId: null,
    roles: [Role.ORG_ADMIN],
    impersonatedBy: null,
    ...overrides,
  });

// ── suite ─────────────────────────────────────────────────────────────────────

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({
          secret: TEST_JWT_SECRET,
          signOptions: { expiresIn: '15m' },
        }),
      ],
      controllers: [AuthController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        {
          provide: JwtStrategy,
          useFactory: () =>
            new JwtStrategy({
              get: (key: string) =>
                key === 'JWT_SECRET' ? TEST_JWT_SECRET : undefined,
            } as unknown as ConfigService),
        },
        LocalStrategy,
        RolesGuard,
        PermissionsGuard,
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    _jwtService = module.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthService.validateUser.mockResolvedValue({
      id: 'user-uuid-1',
      personId: 'person-uuid-1',
      context: 'organization',
      tenantId: null,
      isActive: true,
      userRoles: [{ role: Role.ORG_ADMIN, deletedAt: null }],
    });
    mockAuthService.login.mockResolvedValue({
      accessToken: MOCK_ACCESS_TOKEN,
      refreshToken: MOCK_REFRESH_TOKEN,
    });
    mockAuthService.refreshAccessToken.mockResolvedValue({
      accessToken: MOCK_ACCESS_TOKEN,
    });
    mockAuthService.logout.mockResolvedValue(undefined);
    mockAuthService.impersonate.mockResolvedValue({
      accessToken: MOCK_ACCESS_TOKEN,
    });
  });

  // ── POST /auth/login ────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('deve retornar 200 com accessToken e refreshToken em credenciais válidas', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ login: 'admin@org.com', password: 'S3nha@Forte' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken', MOCK_ACCESS_TOKEN);
      expect(res.body).toHaveProperty('refreshToken', MOCK_REFRESH_TOKEN);
    });

    it('deve retornar 401 quando validateUser retorna null (credenciais inválidas)', async () => {
      mockAuthService.validateUser.mockResolvedValueOnce(null);

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ login: 'errado@org.com', password: 'SenhaErrada1' });

      expect(res.status).toBe(401);
    });

    it('deve retornar 401 quando o campo login está ausente (LocalStrategy rejeita antes do ValidationPipe)', async () => {
      // A rota usa @UseGuards(AuthGuard('local')), que executa antes do ValidationPipe.
      // validateUser recebe undefined no lugar do login → retorna null → 401.
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ password: 'S3nha@Forte' });

      expect(res.status).toBe(401);
    });

    it('deve retornar 400 quando password tem menos de 8 caracteres', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ login: 'admin@org.com', password: 'curto' });

      expect(res.status).toBe(400);
    });

    it('deve retornar 401 quando o body está completamente vazio (LocalStrategy rejeita antes do ValidationPipe)', async () => {
      // Mesmo comportamento: LocalStrategy executa validateUser com undefined,
      // retorna null e o Passport responde com 401 antes do ValidationPipe.
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({});

      expect(res.status).toBe(401);
    });

    it('deve aceitar tenantSlug opcional e repassá-lo ao AuthService.login', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          login: 'user@tenant.com',
          password: 'Senha@1234',
          tenantSlug: 'acme-corp',
        });

      expect(res.status).toBe(200);
      // Verifica que o DTO com tenantSlug foi repassado ao service
      expect(mockAuthService.login).toHaveBeenCalledWith(
        expect.objectContaining({ tenantSlug: 'acme-corp' }),
        expect.any(String), // IP address
        undefined, // userAgent é undefined no supertest
      );
      const [dto] = mockAuthService.login.mock.calls[0];
      expect(dto.tenantSlug).toBe('acme-corp');
    });
  });

  // ── POST /auth/refresh ──────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('deve retornar 200 com novo accessToken para refreshToken válido', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: MOCK_REFRESH_TOKEN });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken', MOCK_ACCESS_TOKEN);
    });

    it('deve retornar 401 para refreshToken inválido ou expirado', async () => {
      mockAuthService.refreshAccessToken.mockRejectedValueOnce(
        new UnauthorizedException('Refresh token inválido'),
      );

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'token-invalido-qualquer' });

      expect(res.status).toBe(401);
    });

    it('deve retornar 400 quando refreshToken está ausente no body', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ── POST /auth/logout ───────────────────────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('deve retornar 204 sem body ao efetuar logout', async () => {
      const token = makeToken({ roles: [Role.ORG_ADMIN] });

      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ refreshToken: MOCK_REFRESH_TOKEN });

      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
      expect(mockAuthService.logout).toHaveBeenCalledWith(MOCK_REFRESH_TOKEN);
    });

    it('deve retornar 401 quando não há JWT no Authorization header', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken: MOCK_REFRESH_TOKEN });

      expect(res.status).toBe(401);
    });

    it('deve retornar 404 quando o refreshToken não é encontrado', async () => {
      mockAuthService.logout.mockRejectedValueOnce(
        new NotFoundException('Refresh token não encontrado'),
      );

      const token = makeToken({ roles: [Role.ORG_ADMIN] });
      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ refreshToken: 'token-inexistente' });

      expect(res.status).toBe(404);
    });

    it('deve retornar 400 quando refreshToken está ausente no body do logout', async () => {
      const token = makeToken({ roles: [Role.ORG_ADMIN] });

      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ── POST /auth/impersonate ──────────────────────────────────────────────────

  describe('POST /auth/impersonate', () => {
    it('deve retornar 200 e token de impersonation para usuário com role org:support', async () => {
      const token = makeToken({ roles: [Role.ORG_SUPPORT] });

      const res = await request(app.getHttpServer())
        .post('/auth/impersonate')
        .set('Authorization', `Bearer ${token}`)
        .send({ tenantId: VALID_TENANT_UUID });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken', MOCK_ACCESS_TOKEN);
    });

    it('deve chamar impersonate com sub do token, tenantId e targetUserId corretamente', async () => {
      const token = makeToken({ sub: 'org-support-uuid', roles: [Role.ORG_SUPPORT] });

      await request(app.getHttpServer())
        .post('/auth/impersonate')
        .set('Authorization', `Bearer ${token}`)
        .send({ tenantId: VALID_TENANT_UUID, targetUserId: VALID_USER_UUID });

      expect(mockAuthService.impersonate).toHaveBeenCalledWith(
        'org-support-uuid',
        VALID_TENANT_UUID,
        VALID_USER_UUID,
      );
    });

    it('deve retornar 403 para role tenant:admin (não possui USER_IMPERSONATE)', async () => {
      const token = makeToken({ roles: [Role.TENANT_ADMIN] });

      const res = await request(app.getHttpServer())
        .post('/auth/impersonate')
        .set('Authorization', `Bearer ${token}`)
        .send({ tenantId: VALID_TENANT_UUID });

      expect(res.status).toBe(403);
    });

    it('deve retornar 403 para standalone:user', async () => {
      const token = makeToken({ roles: [Role.STANDALONE_USER] });

      const res = await request(app.getHttpServer())
        .post('/auth/impersonate')
        .set('Authorization', `Bearer ${token}`)
        .send({ tenantId: VALID_TENANT_UUID });

      expect(res.status).toBe(403);
    });

    it('deve retornar 401 sem token de autenticação', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/impersonate')
        .send({ tenantId: VALID_TENANT_UUID });

      expect(res.status).toBe(401);
    });

    it('deve retornar 400 quando tenantId não é UUID válido', async () => {
      const token = makeToken({ roles: [Role.ORG_SUPPORT] });

      const res = await request(app.getHttpServer())
        .post('/auth/impersonate')
        .set('Authorization', `Bearer ${token}`)
        .send({ tenantId: 'nao-e-uuid' });

      expect(res.status).toBe(400);
    });

    it('deve retornar 400 quando targetUserId não é UUID válido', async () => {
      const token = makeToken({ roles: [Role.ORG_SUPPORT] });

      const res = await request(app.getHttpServer())
        .post('/auth/impersonate')
        .set('Authorization', `Bearer ${token}`)
        .send({ tenantId: VALID_TENANT_UUID, targetUserId: 'invalido' });

      expect(res.status).toBe(400);
    });
  });

  // ── @Public() — rotas acessíveis sem JWT ───────────────────────────────────

  describe('@Public() — bypass do JwtAuthGuard', () => {
    it('POST /auth/login deve ser acessível sem JWT (rota pública)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ login: 'user@org.com', password: 'S3nh@Forte' });

      // Rota pública não bloqueia com 401 — qualquer outro status é aceitável
      expect(res.status).not.toBe(401);
    });

    it('POST /auth/refresh deve ser acessível sem JWT (rota pública)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: MOCK_REFRESH_TOKEN });

      expect(res.status).not.toBe(401);
    });
  });
});
