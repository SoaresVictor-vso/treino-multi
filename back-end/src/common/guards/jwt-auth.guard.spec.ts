/**
 * Testes unitários do JwtAuthGuard — Fase 2
 *
 * O JwtAuthGuard é aplicado globalmente e protege todas as rotas por padrão.
 * Sua única responsabilidade além da validação JWT (delegada ao Passport) é:
 *
 *   → Verificar se a rota possui o metadata IS_PUBLIC_KEY (setado pelo @Public()).
 *     Se sim, permite acesso imediato sem verificar token.
 *
 * Testamos o comportamento do guard isolando-o do Passport via mock do
 * AuthGuard('jwt') e do Reflector.
 *
 * O AuthGuard('jwt') base já é testado pelo @nestjs/passport — aqui focamos
 * apenas no diferencial do nosso guard: a lógica de bypass via @Public().
 */

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Cria um ExecutionContext mínimo com handler e class passados como parâmetro.
 * Usado para simular contextos com e sem o decorator @Public().
 */
const makeContext = (isPublic: boolean): ExecutionContext =>
  ({
    getHandler: () => ({ IS_PUBLIC_KEY: isPublic }),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization: 'Bearer fake-token' } }),
    }),
  }) as unknown as ExecutionContext;

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;

  /**
   * Substituímos o Reflector por um mock para controlar
   * o valor retornado por getAllAndOverride sem precisar de decorators reais.
   */
  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = moduleRef.get(JwtAuthGuard);
    reflector = moduleRef.get(Reflector) as any;
  });

  describe('canActivate()', () => {
    /**
     * Rota marcada com @Public():
     * getAllAndOverride retorna true → o guard deve retornar true
     * IMEDIATAMENTE, sem nem invocar o Passport (super.canActivate).
     *
     * Isso é fundamental para endpoints como POST /auth/login e POST /auth/refresh
     * que precisam ser acessíveis sem token.
     */
    it('deve permitir acesso sem verificar JWT em rota @Public()', () => {
      reflector.getAllAndOverride.mockReturnValue(true); // isPublic = true

      const context = makeContext(true);
      const result = guard.canActivate(context);

      // O resultado deve ser true diretamente (não uma Promise do AuthGuard)
      expect(result).toBe(true);
    });

    /**
     * Rota SEM @Public():
     * getAllAndOverride retorna false/undefined → o guard deve delegar ao
     * AuthGuard('jwt') base chamando super.canActivate(context).
     *
     * Mockamos o método do prototype para evitar dependência do Passport real.
     */
    it('deve delegar ao AuthGuard("jwt") em rota protegida', () => {
      reflector.getAllAndOverride.mockReturnValue(false); // isPublic = false

      // Espiamos super.canActivate para verificar que foi chamado
      const superSpy = jest
        .spyOn(AuthGuard('jwt').prototype, 'canActivate')
        .mockReturnValue(true);

      const context = makeContext(false);
      guard.canActivate(context);

      expect(superSpy).toHaveBeenCalledWith(context);

      superSpy.mockRestore();
    });

    /**
     * Garante que o Reflector é consultado com IS_PUBLIC_KEY,
     * verificando tanto o handler quanto a classe do controller.
     * Isso permite @Public() aplicado em nível de controller inteiro.
     */
    it('deve consultar o Reflector com IS_PUBLIC_KEY para handler e classe', () => {
      reflector.getAllAndOverride.mockReturnValue(false);

      // Mock do super para não falhar no teste
      jest
        .spyOn(AuthGuard('jwt').prototype, 'canActivate')
        .mockReturnValue(true);

      const context = makeContext(false);
      guard.canActivate(context);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        IS_PUBLIC_KEY,
        [context.getHandler(), context.getClass()],
      );
    });
  });
});
