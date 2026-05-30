import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService, mapDbUserToModel } from '../users/users.service';
import { RegisterInput, LoginInput, AuthPayload } from './auth.dto';
import { User } from '../users/user.model';
import { DemoSeedService } from './demo-seed.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const DEMO_EMAIL_DOMAIN = 'try.botion.app';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly demoSeedService: DemoSeedService,
  ) {}

  async register(input: RegisterInput): Promise<AuthPayload> {
    const normalized = {
      ...input,
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
    };
    const user = await this.usersService.create(normalized);

    // Generate JWT
    const token = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return { token, user };
  }

  async login(input: LoginInput): Promise<AuthPayload> {
    const email = input.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!user.passwordHash || user.passwordHash.length < 20) {
      throw new UnauthorizedException(
        'This account has no password set. Please register again with the same email or use another account.',
      );
    }

    const isPasswordValid = await bcrypt.compare(
      input.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    // Generate JWT
    const token = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return { token, user: mapDbUserToModel(user) };
  }

  async createDemoAccount(): Promise<AuthPayload> {
    if (process.env.DEMO_ACCOUNTS_ENABLED === 'false') {
      throw new ForbiddenException('Demo accounts are not available.');
    }

    const suffix = crypto.randomBytes(4).toString('hex');
    const email = `demo-${suffix}@${DEMO_EMAIL_DOMAIN}`;
    const password = crypto.randomBytes(24).toString('base64url');

    const user = await this.usersService.create({
      name: 'Demo Explorer',
      email,
      password,
      bio: 'Exploring Botion with sample content. Create a real account anytime to keep your work.',
    });

    this.demoSeedService.seedWorkspace(user.id);

    const token = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return { token, user };
  }
}
