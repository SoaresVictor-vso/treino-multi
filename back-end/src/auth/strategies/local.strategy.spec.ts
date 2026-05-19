/**
 * Testes unitários da LocalStrategy — Fase 2
 *
 * A LocalStrategy é o ponto de entrada do fluxo de login com email+senha.
 * Ela delega a validação das credenciais ao AuthService.validateUser().
 *
 * Responsabilidades testadas:
 * 1. Quando validateUser retorna um User → a estratégia o repassa ao Passport.
 * 2. Quando validateUser retorna null  → lança UnauthorizedException.
 *
 * NÃO testamos o hashing de senha aqui (responsabilidade do AuthService).
 */

import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LocalStrategy } from './local.strategy';
import { AuthService } from '../auth.service';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../common/enums/role.enum';
import { UserRole } from '../../users/entities/user-role.entity';

/** Usuário mínimo retornado pelo AuthService em caso de sucesso */
const MOCK_USER: Partial<User> = {
  id: 'user-uuid-1',
  personId: 'person-uuid-1',
  context: 'organization',
  tenantId: null,
  isActive: true,
  userRoles: [{ role: Role.ORG_ADMIN, deletedAt: null } as UserRole],
};

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let authService: jest.Mocked<Pick<AuthService, 'validateUser'>>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        LocalStrategy,
        {
          /**
           * Fornecemos apenas o slice do AuthService que a LocalStrategy consome.
           * Isso torna o mock mais explícito e o teste mais robusto a mudanças
           * nas outras partes do serviço.
           */
          provide: AuthService,
          useValue: {
            validateUser: jest.fn(),
          },
        },
      ],
    }).compile();

    strategy = moduleRef.get(LocalStrategy);
    authService = moduleRef.get(AuthService) as any;
  });

  describe('validate()', () => {
    /**
     * Cenário feliz: credenciais válidas.
     * validate() deve retornar o User recebido do AuthService,
     * que será anexado a request.user pelo Passport.
     */
    it('deve retornar o User quando as credenciais são válidas', async () => {
      authService.validateUser.mockResolvedValue(MOCK_USER as User);

      const result = await strategy.validate('admin@org.com', '12345678');

      expect(result).toEqual(MOCK_USER);
      expect(authService.validateUser).toHaveBeenCalledWith('admin@org.com', '12345678');
    });

    /**
     * Cenário de falha: AuthService.validateUser retorna null (credenciais inválidas
     * ou usuário inativo). A estratégia deve converter o null em UnauthorizedException
     * para que o Passport retorne HTTP 401 ao cliente.
     */
    it('deve lançar UnauthorizedException quando validateUser retorna null', async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate('errado@org.com', 'senha-errada')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    /**
     * Garante que o campo de email é sempre passado lowercase ou como veio —
     * o AuthService é responsável por normalização, não a estratégia.
     * Este teste verifica que o valor repassado ao service é exatamente
     * o que chegou na requisição (sem transformações na estratégia).
     */
    it('deve repassar email e senha exatamente como recebidos', async () => {
      authService.validateUser.mockResolvedValue(null);

      try {
        await strategy.validate('Admin@ORG.COM', 'SenhaComMaiusculas');
      } catch {
        // esperado
      }

      expect(authService.validateUser).toHaveBeenCalledWith(
        'Admin@ORG.COM',
        'SenhaComMaiusculas',
      );
    });
  });
});
