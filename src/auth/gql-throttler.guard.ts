import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  protected getRequestResponse(context: ExecutionContext) {
    if (context.getType() === 'http') {
      const req = context.switchToHttp().getRequest<Request>();
      const res = context.switchToHttp().getResponse();
      return { req, res };
    }

    const gqlCtx = GqlExecutionContext.create(context);
    const ctx = gqlCtx.getContext<{ req?: Request & { user?: { sub?: string } } }>();
    const req = ctx.req ?? ({} as Request);
    return { req, res: (req as Request & { res?: unknown }).res };
  }

  protected async getTracker(req: Request & { user?: { sub?: string } }): Promise<string> {
    if (req.user?.sub) {
      return `user:${req.user.sub}`;
    }

    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0]?.trim() ?? 'anonymous';
    }

    return req.ip ?? 'anonymous';
  }
}
