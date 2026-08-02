import {
	ExecutionContext,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Observable } from 'rxjs/internal/Observable';

/**
 * Guard JWT global — aplicado a todas as rotas por padrão.
 * Rotas marcadas com @Public() são liberadas sem exigir token.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
	constructor(private readonly reflector: Reflector) {
		super();
	}

	canActivate(
		context: ExecutionContext,
	): boolean | Promise<boolean> | Observable<boolean> {
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

		return super.canActivate(context);
	}

	handleRequest(
		err: any,
		user: any,
		_info: any,
		context: ExecutionContext,
	): any {
		if (err) throw err;

		if (!user || typeof user !== 'object') {
			throw new UnauthorizedException('Invalid or missing user');
		}

		const req = context.switchToHttp().getRequest();
		if (req) {
			req.user = user;
			req.currentUser = user;
		}

		return user;
	}
}
