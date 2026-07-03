import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable, isObservable, tap } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Guard JWT global — aplicado a todas as rotas por padrão.
 * Rotas marcadas com @Public() são liberadas sem exigir token.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      const req = context.switchToHttp().getRequest();
      req.user = {};
      req.currentUser = {};
      return true;
    }

    const result = super.canActivate(context);

    if (isObservable(result)) {
      return result.pipe(
        tap((ok) => {
          if (ok) this.ensureUserOnRequest(context);
        }),
      );
    }

    if (result instanceof Promise) {
      return result.then((ok) => {
        if (ok) this.ensureUserOnRequest(context);
        return ok;
      });
    }

    if (result) {
      this.ensureUserOnRequest(context);
    }

    return result;
  }

  handleRequest(err: any, user: any, _info: any, context: ExecutionContext): any {
    if (err) throw err;

    console.log('JwtAuthGuard.handleRequest: user', user);

    if (!user || typeof user !== 'object') {
      throw new UnauthorizedException('Invalid or missing user');
    }

    // Explicitly set on request so decorators see it immediately
    const req = context.switchToHttp().getRequest();
    if (req) {
      req.user = user;
      req.currentUser = user;
    }

    return user;
  }

  private ensureUserOnRequest(context: ExecutionContext): void {
    const req = context.switchToHttp().getRequest();
    if (!req.user) {
      throw new UnauthorizedException('User not set on request');
    }
  }
}
