import { enums } from '@treino-multi/shared';
const { OAuthProvider } = enums;
type OAuthProvider = enums.OAuthProvider;


export interface OAuthIdentity {
  sub: string;
  email: string;
  name?: string;
  iat: number;
}

export interface OAuthIdentityProvider {
  readonly provider: OAuthProvider;
  verify(credential: string): Promise<OAuthIdentity>;
}
