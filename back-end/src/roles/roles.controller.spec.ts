/**
 * Testes unitários do RolesController — Fase 4
 *
 * O controller é puramente read-only sobre dados estáticos (enums de código),
 * portanto não há dependências de banco. Testamos diretamente a classe.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { RolesController } from './roles.controller';
import { Role } from '../common/enums/role.enum';
import { Permission } from '../common/enums/permission.enum';
import { ROLE_PERMISSIONS } from '../common/enums/role-permissions.map';

describe('RolesController', () => {
  let controller: RolesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesController],
    }).compile();

    controller = module.get(RolesController);
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('deve retornar uma entrada para cada role do enum', () => {
      const result = controller.findAll();
      const allRoles = Object.values(Role);

      expect(result).toHaveLength(allRoles.length);
      expect(result.map((r) => r.role)).toEqual(expect.arrayContaining(allRoles));
    });

    it('cada entrada deve conter o array de permissões correto', () => {
      const result = controller.findAll();

      for (const entry of result) {
        expect(entry.permissions).toEqual(ROLE_PERMISSIONS[entry.role]);
      }
    });

    it('org:admin deve ter todas as permissões do sistema', () => {
      const result = controller.findAll();
      const orgAdminEntry = result.find((r) => r.role === Role.ORG_ADMIN);

      expect(orgAdminEntry).toBeDefined();
      expect(orgAdminEntry!.permissions).toEqual(
        expect.arrayContaining(Object.values(Permission)),
      );
    });

    it('standalone:user deve ter apenas permissões de autenticação básica', () => {
      const result = controller.findAll();
      const standaloneEntry = result.find((r) => r.role === Role.STANDALONE_USER);

      expect(standaloneEntry).toBeDefined();
      expect(standaloneEntry!.permissions).toContain(Permission.AUTH_LOGIN);
      expect(standaloneEntry!.permissions).toContain(Permission.AUTH_LOGOUT);
      expect(standaloneEntry!.permissions).toContain(Permission.AUTH_REFRESH_TOKEN);
      expect(standaloneEntry!.permissions).not.toContain(Permission.USER_CREATE);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('deve retornar as permissões de uma role válida', () => {
      const result = controller.findOne(Role.ORG_SUPPORT);

      expect(result).toMatchObject({
        role: Role.ORG_SUPPORT,
        permissions: ROLE_PERMISSIONS[Role.ORG_SUPPORT],
      });
    });

    it('deve retornar as permissões corretas para tenant:financial', () => {
      const result = controller.findOne(Role.TENANT_FINANCIAL) as {
        role: Role;
        permissions: Permission[];
      };

      expect(result.permissions).toContain(Permission.FINANCIAL_INVOICES_READ);
      expect(result.permissions).toContain(Permission.FINANCIAL_INVOICES_CREATE);
      expect(result.permissions).not.toContain(Permission.USER_CREATE);
    });

    it('deve retornar objeto de erro para role inexistente', () => {
      const result = controller.findOne('role:inexistente') as { error: string };

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('role:inexistente');
    });
  });
});
