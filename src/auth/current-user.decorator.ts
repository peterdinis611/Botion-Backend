import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext): JwtPayload => {
    if (context.getType() === 'http') {
      return context.switchToHttp().getRequest().user;
    }
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req.user;
  },
);
