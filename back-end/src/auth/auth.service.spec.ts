/**
 * Testes unitários do AuthService — Fase 2
 *
 * Isolamos completamente o AuthService das suas dependências externas
 * (banco de dados, JwtService, bcrypt) usando mocks manuais e jest.fn().
 * Isso garante que os testes sejam rápidos, determinísticos e focados
 * exclusivamente na lógica de negócio do serviço.
 */

import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';

import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { Person } from '../persons/entities/person.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { Role } from '../common/enums/role.enum';
import { LoginDto } from './dto/login.dto';
import { AuditLogService } from '../audit-logs/audit-logs.service';

// ── helpers de fixture ────────────────────────────────────────────────────────

/**
 * Cria uma Person mínima para uso nos testes.
 * O campo email é customizável para cobrir diferentes cenários.
 */
const makePerson = (overrides: Partial<Person> = {}): Person =>
  ({
    id: 'person-uuid-1',
    name: 'Admin da Org',
    email: 'admin@org.com',
    document: '00000000000',
    ...overrides,
  }) as Person;

/**
 * Cria um User mínimo para uso nos testes.
 * passwordHash pré-calculado para a senha '12345678' com custo 12.
 * userRoles reflete a role org:admin sem deletedAt (role ativa).
 */
const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-uuid-1',
    personId: 'person-uuid-1',
    tenantId: null,
    context: 'organization',
    passwordHash: '', // sobrescrito no beforeEach com bcrypt real
    isActive: true,
    deletedAt: null,
    userRoles: [
      { role: Role.ORG_ADMIN, deletedAt: null } as UserRole,
    ],
    ...overrides,
  }) as User;

/**
 * Cria um RefreshToken armazenado (já com hash) para simular o banco.
 * Por padrão: não revogado, não expirado.
 */
const makeStoredToken = (overrides: Partial<RefreshToken> = {}): RefreshToken =>
  ({
    id: 'rt-uuid-1',
    userId: 'user-uuid-1',
    tokenHash: 'hashed-token',
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000), // 7 dias no futuro
    revokedAt: null,
    user: makeUser(),
    ...overrides,
  }) as RefreshToken;

// ── setup do módulo de teste ──────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;
  let personRepo: jest.Mocked<Repository<Person>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let refreshTokenRepo: jest.Mocked<Repository<RefreshToken>>;
  let jwtService: jest.Mocked<JwtService>;

  /**
   * Antes de cada test recriamos o módulo para garantir isolamento completo.
   * Cada repositório é substituído por um mock manual que expõe apenas
   * os métodos utilizados pelo AuthService.
   */
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(Person),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserRole),
          useValue: {},
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn((dto) => dto),
            update: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mocked-access-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: string) => {
              const cfg: Record<string, string> = {
                JWT_REFRESH_EXPIRES_IN: '7d',
                JWT_EXPIRES_IN: '15m',
              };
              return cfg[key] ?? fallback;
            }),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            logAuthentication: jest.fn().mockResolvedValue(undefined),
            logCriticalOperation: jest.fn().mockResolvedValue(undefined),
            logPasswordChange: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: UsersService,
          useValue: {
            resetPassword: jest.fn().mockResolvedValue(undefined),
            generatePasswordResetToken: jest.fn().mockResolvedValue({ token: 'mock-token', expiresInMinutes: 30 }),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    personRepo = module.get(getRepositoryToken(Person));
    userRepo = module.get(getRepositoryToken(User));
    refreshTokenRepo = module.get(getRepositoryToken(RefreshToken));
    jwtService = module.get(JwtService);
  });

  // ── validateUser ──────────────────────────────────────────────────────────

  describe('validateUser()', () => {
    /**
     * Cenário feliz: e-mail encontrado, senha correta, usuário ativo.
     * Deve retornar o objeto User completo para que login() prossiga.
     */
    it('deve retornar o User quando as credenciais são válidas', async () => {
      const hash = await bcrypt.hash('12345678', 12);
      const user = makeUser({ passwordHash: hash });

      personRepo.findOne.mockResolvedValue(makePerson());
      userRepo.findOne.mockResolvedValue(user);

      const result = await service.validateUser('admin@org.com', '12345678');

      expect(result).toEqual(user);
    });

    /**
     * Cenário: e-mail não encontrado no banco.
     * Deve retornar null — não lança exceção (responsabilidade do caller).
     */
    it('deve retornar null quando a Person não existe', async () => {
      personRepo.findOne.mockResolvedValue(null);

      const result = await service.validateUser('naoexiste@org.com', '12345678');

      expect(result).toBeNull();
    });

    /**
     * Cenário: e-mail existe mas a senha está errada.
     * O bcrypt.compare retorna false → deve retornar null.
     */
    it('deve retornar null quando a senha está incorreta', async () => {
      const hash = await bcrypt.hash('senha-correta', 12);
      const user = makeUser({ passwordHash: hash });

      personRepo.findOne.mockResolvedValue(makePerson());
      userRepo.findOne.mockResolvedValue(user);

      const result = await service.validateUser('admin@org.com', 'senha-errada');

      expect(result).toBeNull();
    });

    /**
     * Cenário: Person existe mas não há User ativo vinculado
     * (is_active = false faz o findOne retornar null via where clause).
     * Deve retornar null — usuário desativado não pode logar.
     */
    it('deve retornar null quando o User está inativo', async () => {
      personRepo.findOne.mockResolvedValue(makePerson());
      userRepo.findOne.mockResolvedValue(null); // nenhum user ativo

      const result = await service.validateUser('admin@org.com', '12345678');

      expect(result).toBeNull();
    });
  });

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login()', () => {
    let user: User;

    /**
     * Configura credenciais válidas para todos os testes de login.
     */
    beforeEach(async () => {
      const hash = await bcrypt.hash('12345678', 12);
      user = makeUser({ passwordHash: hash });
      personRepo.findOne.mockResolvedValue(makePerson());
      userRepo.findOne.mockResolvedValue(user);
      userRepo.update.mockResolvedValue(undefined as any);
      refreshTokenRepo.save.mockResolvedValue(undefined as any);
    });

    /**
     * Cenário feliz: login bem-sucedido deve retornar accessToken e refreshToken.
     * O accessToken é gerado pelo JwtService.sign() (mockado).
     * O refreshToken é a string bruta aleatória (não o hash).
     */
    it('deve retornar accessToken e refreshToken em login bem-sucedido', async () => {
      const dto: LoginDto = { login: 'admin@org.com', password: '12345678' };

      const result = await service.login(dto);

      expect(result).toHaveProperty('accessToken', 'mocked-access-token');
      expect(result).toHaveProperty('refreshToken');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshToken.length).toBeGreaterThan(0);
    });

    /**
     * O payload do JWT deve conter todos os campos definidos na interface JwtPayload:
     * sub, personId, context, tenantId, roles e impersonatedBy.
     * Isso é validado inspecionando o argumento passado ao jwtService.sign().
     */
    it('deve assinar o JWT com o payload completo', async () => {
      const dto: LoginDto = { login: 'admin@org.com', password: '12345678' };
      await service.login(dto);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: user.id,
          personId: user.personId,
          context: 'organization',
          tenantId: null,
          roles: [Role.ORG_ADMIN],
          impersonatedBy: null,
        }),
      );
    });

    /**
     * O hash SHA-256 do refreshToken bruto deve ser o que fica salvo no banco.
     * Verificamos que refreshTokenRepo.save foi chamado com um objeto que possui tokenHash.
     */
    it('deve salvar o hash do refreshToken (nunca o token bruto) no banco', async () => {
      const dto: LoginDto = { login: 'admin@org.com', password: '12345678' };
      const result = await service.login(dto);

      const expectedHash = crypto
        .createHash('sha256')
        .update(result.refreshToken)
        .digest('hex');

      expect(refreshTokenRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ tokenHash: expectedHash }),
      );
    });

    /**
     * Após login bem-sucedido o campo lastLoginAt do User deve ser atualizado.
     */
    it('deve atualizar lastLoginAt do User após login', async () => {
      const dto: LoginDto = { login: 'admin@org.com', password: '12345678' };
      await service.login(dto);

      expect(userRepo.update).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({ lastLoginAt: expect.any(Date) }),
      );
    });

    /**
     * Credenciais inválidas devem lançar UnauthorizedException.
     * Para isso, mockamos personRepo para retornar null (simula e-mail não encontrado).
     */
    it('deve lançar UnauthorizedException com credenciais inválidas', async () => {
      personRepo.findOne.mockResolvedValue(null);

      const dto: LoginDto = { login: 'errado@org.com', password: '12345678' };

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── refreshAccessToken ────────────────────────────────────────────────────

  describe('refreshAccessToken()', () => {
    const RAW_TOKEN = 'raw-refresh-token-value';

    /**
     * Cenário feliz: token válido, não revogado, não expirado.
     * Deve retornar um novo accessToken assinado pelo JwtService.
     */
    it('deve retornar novo accessToken para token válido', async () => {
      const stored = makeStoredToken();
      // O hash esperado para este token bruto
      const tokenHash = crypto.createHash('sha256').update(RAW_TOKEN).digest('hex');
      stored.tokenHash = tokenHash;

      refreshTokenRepo.findOne.mockResolvedValue(stored);

      const result = await service.refreshAccessToken(RAW_TOKEN);

      expect(result).toHaveProperty('accessToken', 'mocked-access-token');
    });

    /**
     * Token inexistente no banco deve lançar UnauthorizedException.
     * Isso cobre o cenário de token falsificado ou já deletado fisicamente.
     */
    it('deve lançar UnauthorizedException para token inválido (não encontrado)', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(null);

      await expect(service.refreshAccessToken('token-inexistente')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    /**
     * Token com revokedAt preenchido deve lançar UnauthorizedException.
     * Cobre o cenário de logout já realizado ou rotação de token detectada.
     */
    it('deve lançar UnauthorizedException para token revogado', async () => {
      const stored = makeStoredToken({ revokedAt: new Date(Date.now() - 5000) });
      refreshTokenRepo.findOne.mockResolvedValue(stored);

      await expect(service.refreshAccessToken(RAW_TOKEN)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    /**
     * Token com expiresAt no passado deve lançar UnauthorizedException.
     * Garante que o sistema não aceita tokens vencidos mesmo sem revogação explícita.
     */
    it('deve lançar UnauthorizedException para token expirado', async () => {
      const stored = makeStoredToken({
        expiresAt: new Date(Date.now() - 1000), // expirou há 1 segundo
      });
      refreshTokenRepo.findOne.mockResolvedValue(stored);

      await expect(service.refreshAccessToken(RAW_TOKEN)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ── logout ────────────────────────────────────────────────────────────────

  describe('logout()', () => {
    const RAW_TOKEN = 'raw-token-to-revoke';

    /**
     * Cenário feliz: deve setar revokedAt no registro do refreshToken.
     */
    it('deve revogar o refreshToken (setar revokedAt)', async () => {
      const stored = makeStoredToken({ revokedAt: null });
      refreshTokenRepo.findOne.mockResolvedValue(stored);
      refreshTokenRepo.update.mockResolvedValue(undefined as any);

      await service.logout(RAW_TOKEN);

      expect(refreshTokenRepo.update).toHaveBeenCalledWith(
        stored.id,
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });

    /**
     * Token já revogado — deve ser idempotente:
     * não chama update novamente, não lança erro.
     */
    it('deve ser idempotente quando o token já foi revogado', async () => {
      const stored = makeStoredToken({ revokedAt: new Date() });
      refreshTokenRepo.findOne.mockResolvedValue(stored);

      await service.logout(RAW_TOKEN);

      expect(refreshTokenRepo.update).not.toHaveBeenCalled();
    });

    /**
     * Token não encontrado no banco deve lançar NotFoundException.
     */
    it('deve lançar NotFoundException para token inexistente', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(null);

      await expect(service.logout(RAW_TOKEN)).rejects.toThrow(NotFoundException);
    });
  });

  // ── impersonate ───────────────────────────────────────────────────────────

  describe('impersonate()', () => {
    const ACTOR_USER_ID = 'org-support-user-uuid';
    const TENANT_ID = 'tenant-uuid-1';
    const TARGET_USER_ID = 'tenant-admin-user-uuid';

    /**
     * Cenário feliz com targetUserId explícito:
     * deve emitir um JWT onde impersonatedBy = actorUserId.
     */
    it('deve emitir accessToken com impersonatedBy preenchido', async () => {
      const targetUser = makeUser({
        id: TARGET_USER_ID,
        tenantId: TENANT_ID,
        context: 'tenant',
        userRoles: [{ role: Role.TENANT_ADMIN, deletedAt: null } as UserRole],
      });

      userRepo.findOne.mockResolvedValue(targetUser);

      const result = await service.impersonate(ACTOR_USER_ID, TENANT_ID, TARGET_USER_ID);

      expect(result).toHaveProperty('accessToken', 'mocked-access-token');
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: TARGET_USER_ID,
          tenantId: TENANT_ID,
          context: 'tenant',
          impersonatedBy: ACTOR_USER_ID,
        }),
      );
    });

    /**
     * targetUserId inexistente ou inativo → NotFoundException.
     */
    it('deve lançar NotFoundException quando o usuário alvo não é encontrado', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.impersonate(ACTOR_USER_ID, TENANT_ID, 'uuid-invalido'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
