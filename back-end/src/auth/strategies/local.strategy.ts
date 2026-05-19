import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

/**
 * Estratégia Local — valida login (e-mail ou document) + password enviados no body do POST /auth/login.
 * O campo 'login' é mapeado como usernameField do passport-local.
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'login' });
  }

  /**
   * Chamado pelo LocalAuthGuard antes de chegar ao endpoint.
   * Lança UnauthorizedException se as credenciais forem inválidas ou o usuário inativo.
   */
  async validate(login: string, password: string) {
    const user = await this.authService.validateUser(login, password);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return user;
  }
}
