import { OAuthProvider } from '../../common/enums/oauth-provider.enum';

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
