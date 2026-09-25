import { enums } from '@treino-multi/shared';
const { OAuthProvider } = enums;
type OAuthProvider = enums.OAuthProvider;
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';


const actor = { sub: 'user-1' } as any;

function setup(passwordHash: string | null, providerCount = 1) {
  const user = { id: 'user-1', isActive: true, passwordHash, person: { email: 'user@example.com' } };
  const linked = { id: 'identity-1', userId: user.id, provider: OAuthProvider.GOOGLE, subject: 'google-1' };
  const manager = {
    findOneOrFail: jest.fn().mockResolvedValue(user),
    findOne: jest.fn().mockResolvedValue(linked),
    count: jest.fn().mockResolvedValue(providerCount),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const dataSource = { transaction: jest.fn(async (run: (value: any) => Promise<unknown>) => run(manager)) };
  const google = { provider: OAuthProvider.GOOGLE, verify: jest.fn().mockResolvedValue({ sub: linked.subject, email: user.person.email, iat: Math.floor(Date.now() / 1000) }) };
  const service = new AuthService(
    { findOne: jest.fn().mockResolvedValue(user) } as any,
    {} as any,
    dataSource as any,
    {} as any,
    google as any,
    {} as any,
    {} as any,
    {} as any,
  );
  return { service, manager, google };
}

describe('AuthService.unlinkProvider', () => {
  it('removes a provider after verifying the account password', async () => {
    const { service, manager, google } = setup(await bcrypt.hash('correct-password', 4));
    await expect(service.unlinkProvider(actor, OAuthProvider.GOOGLE, 'correct-password')).resolves.toEqual({ provider: OAuthProvider.GOOGLE, linked: false });
    expect(google.verify).not.toHaveBeenCalled();
    expect(manager.delete).toHaveBeenCalled();
  });

  it('rejects an incorrect password without removing the provider', async () => {
    const { service, manager } = setup(await bcrypt.hash('correct-password', 4));
    await expect(service.unlinkProvider(actor, OAuthProvider.GOOGLE, 'wrong-password')).rejects.toThrow('Senha atual inválida.');
    expect(manager.delete).not.toHaveBeenCalled();
  });

  it('uses provider confirmation when the account has no password and preserves the last method', async () => {
    const { service, manager, google } = setup(null);
    await expect(service.unlinkProvider(actor, OAuthProvider.GOOGLE, undefined, 'google-token')).rejects.toThrow('A conta deve manter ao menos um método de login.');
    expect(google.verify).toHaveBeenCalledWith('google-token');
    expect(manager.delete).not.toHaveBeenCalled();
  });
});
