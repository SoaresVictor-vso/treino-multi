import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (request.currentUser && typeof request.currentUser === 'object') {
      return request.currentUser;
    }

    if (request.user && typeof request.user === 'object') {
      return request.user;
    }

    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('User not authenticated');
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.decode(token);
      if (!decoded) {
        throw new UnauthorizedException('User not authenticated');
      }
      return decoded;
    } catch (error) {
      throw new UnauthorizedException('User not authenticated');
    }
  },
);
