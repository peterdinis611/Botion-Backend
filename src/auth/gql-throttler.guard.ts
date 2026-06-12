import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import type { JwtPayload } from './current-user.decorator';

type GqlContext = {
  req?: Request & { user?: JwtPayload };
  user?: JwtPayload;
};

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      const gqlCtx = GqlExecutionContext.create(context);
      const operation = gqlCtx.getInfo()?.operation?.operation;
      if (operation === 'subscription') {
        return true;
      }
    }

    return super.canActivate(context);
  }

  protected getRequestResponse(context: ExecutionContext) {
    if (context.getType() === 'http') {
      const req = context.switchToHttp().getRequest<Request>();
      const res = context.switchToHttp().getResponse();
      return { req, res };
    }

    const gqlCtx = GqlExecutionContext.create(context);
    const ctx = gqlCtx.getContext<GqlContext>();
    const baseReq = ctx.req ?? ({} as Request & { user?: JwtPayload });

    const req = {
      ...baseReq,
      headers: baseReq.headers ?? {},
      user: baseReq.user ?? ctx.user,
    } as Request & { user?: JwtPayload };

    return { req, res: (baseReq as Request & { res?: unknown }).res };
  }

  protected async getTracker(
    req: Request & { user?: JwtPayload },
  ): Promise<string> {
    if (req?.user?.sub) {
      return `user:${req.user.sub}`;
    }

    const forwarded = req?.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0]?.trim() ?? 'anonymous';
    }

    return req?.ip ?? 'anonymous';
  }
}
