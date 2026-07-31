import { Permission } from './permission.enum';
import { Role } from './role.enum';
import { resolvePermissions, ROLE_PERMISSIONS } from './role-permissions.map';

describe('ROLE_PERMISSIONS', () => {
  it('deve conter uma entrada para cada Role', () => {
    const roles = Object.values(Role);
    roles.forEach((role) => {
      expect(ROLE_PERMISSIONS).toHaveProperty(role);
    });
  });

  it('ORG_ADMIN deve ter todas as permissões', () => {
    const allPerms = Object.values(Permission);
    expect(ROLE_PERMISSIONS[Role.ORG_ADMIN]).toEqual(
      expect.arrayContaining(allPerms),
    );
    expect(ROLE_PERMISSIONS[Role.ORG_ADMIN]).toHaveLength(allPerms.length);
  });

  it('ORG_SUPPORT deve ter USER_IMPERSONATE', () => {
    expect(ROLE_PERMISSIONS[Role.ORG_SUPPORT]).toContain(
      Permission.USER_IMPERSONATE,
    );
  });


  it('todas as permissões mapeadas são valores válidos do enum Permission', () => {
    const validPerms = new Set(Object.values(Permission));
    Object.entries(ROLE_PERMISSIONS).forEach(([role, perms]) => {
      perms.forEach((perm) => {
        expect(validPerms.has(perm)).toBe(true);
      });
    });
  });
});

describe('resolvePermissions', () => {
  it('deve retornar a união de permissões de múltiplas roles', () => {
    const perms = resolvePermissions([
      Role.TENANT_ADMIN,
      Role.TENANT_TRAINER,
    ]);
    expect(perms).toContain(Permission.WORKOUT_TEMPLATES_READ_TENANT);
    expect(perms).toContain(Permission.WORKOUT_TEMPLATES_CREATE);
  });

  it('não deve duplicar permissões compartilhadas entre roles', () => {
    // ORG_ADMIN tem todas; duplicar não deve aumentar o array
    const adminPerms = resolvePermissions([Role.ORG_ADMIN]);
    const uniqueCount = new Set(adminPerms).size;
    expect(adminPerms.length).toBe(uniqueCount);
  });

  it('deve retornar array vazio para roles sem permissões conhecidas', () => {
    // @ts-expect-error: testando role inexistente
    const perms = resolvePermissions(['unknown:role']);
    expect(perms).toEqual([]);
  });

  it('deve retornar vazio para array vazio de roles', () => {
    expect(resolvePermissions([])).toEqual([]);
  });
});
