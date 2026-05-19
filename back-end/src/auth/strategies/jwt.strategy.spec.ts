/**
 * Testes unitários da JwtStrategy — Fase 2
 *
 * A JwtStrategy é responsável por receber o payload decodificado de um JWT
 * já verificado pelo Passport (assinatura válida + não expirado) e transformá-lo
 * no objeto que ficará em request.user.
 *
 * O objetivo desses testes é garantir que:
 * 1. Um payload bem-formado é retornado íntegro por validate().
 * 2. Um payload sem 'sub' (claim obrigatória) lança UnauthorizedException.
 *
 * Não testamos a verificação da assinatura JWT ou a extração do Bearer token —
 * esses comportamentos pertencem ao passport-jwt, já testado por sua própria suite.
 */

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { Role } from '../../common/enums/role.enum';

/**
 * Payload válido de referência reutilizado em múltiplos testes.
 */
const VALID_PAYLOAD: JwtPayload = {
  sub: 'user-uuid-1',
  personId: 'person-uuid-1',
  context: 'organization',
  tenantId: null,
  roles: [Role.ORG_ADMIN],
  impersonatedBy: null,
};

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          /**
           * Mockamos a ConfigService para fornecer um segredo fixo.
           * O segredo real virá de variáveis de ambiente em produção;
           * aqui queremos apenas instanciar a estratégia sem erros.
           */
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') return 'test-secret';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    strategy = moduleRef.get(JwtStrategy);
  });

  describe('validate()', () => {
    /**
     * Cenário feliz: o payload contém 'sub' e todos os campos exigidos.
     * validate() deve devolver o payload intocado para que fique em request.user.
     * Isso permite que guards e decorators acessem os dados sem DB lookup adicional.
     */
    it('deve retornar o payload quando o claim sub está presente', () => {
      const result = strategy.validate(VALID_PAYLOAD);

      expect(result).toEqual(VALID_PAYLOAD);
    });

    /**
     * Payload de impersonation: impersonatedBy preenchido.
     * O AuthController usará esse campo para identificar ações de suporte
     * e registrá-las corretamente no audit log.
     */
    it('deve retornar o payload de impersonation com impersonatedBy preenchido', () => {
      const impersonationPayload: JwtPayload = {
        ...VALID_PAYLOAD,
        sub: 'tenant-admin-uuid',
        context: 'tenant',
        tenantId: 'tenant-uuid-1',
        roles: [Role.TENANT_ADMIN],
        impersonatedBy: 'org-support-uuid',
      };

      const result = strategy.validate(impersonationPayload);

      expect(result.impersonatedBy).toBe('org-support-uuid');
      expect(result.context).toBe('tenant');
    });

    /**
     * Payload sem 'sub' é inválido — pode ocorrer em tokens malformados
     * ou forjados sem o campo obrigatório.
     * Deve lançar UnauthorizedException imediatamente.
     */
    it('deve lançar UnauthorizedException quando sub está ausente', () => {
      const invalidPayload = { ...VALID_PAYLOAD, sub: '' };

      expect(() => strategy.validate(invalidPayload)).toThrow(UnauthorizedException);
    });

    /**
     * sub = undefined (campo ausente no objeto) também deve ser rejeitado.
     */
    it('deve lançar UnauthorizedException quando sub é undefined', () => {
      const invalidPayload = { ...VALID_PAYLOAD } as Partial<JwtPayload>;
      delete invalidPayload.sub;

      expect(() => strategy.validate(invalidPayload as JwtPayload)).toThrow(
        UnauthorizedException,
      );
    });
  });
});
