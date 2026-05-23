import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from './current-user.decorator';

function extractBearerToken(
  authorization: string | undefined,
): string | null {
  if (!authorization) {
    return null;
  }
  const [bearer, token] = authorization.split(' ');
  if (bearer !== 'Bearer' || !token) {
    return null;
  }
  return token;
}

@Injectable()
export class GqlAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const gqlContext = ctx.getContext<{
      req?: { headers?: { authorization?: string }; user?: JwtPayload };
      connectionParams?: Record<string, string>;
      user?: JwtPayload;
    }>();

    let req = gqlContext.req;

    if (!req) {
      req = { headers: {} };
      gqlContext.req = req;
    }

    if (!req.headers?.authorization) {
      const fromParams =
        gqlContext.connectionParams?.authorization ??
        gqlContext.connectionParams?.Authorization;
      if (fromParams) {
        req.headers = {
          ...req.headers,
          authorization: fromParams.startsWith('Bearer ')
            ? fromParams
            : `Bearer ${fromParams}`,
        };
      }
    }

    if (req.user || gqlContext.user) {
      req.user = req.user ?? gqlContext.user;
      return true;
    }

    const token = extractBearerToken(req.headers?.authorization);
    if (!token) {
      throw new UnauthorizedException('Authorization header is missing.');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      req.user = payload;
      gqlContext.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }
}
