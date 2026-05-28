import { createAuthToken, readAuthTokenSecret, verifyPassword } from '@ai-quality-platform/shared-auth';
import { createRuntimePrismaClient } from '@ai-quality-platform/shared-database';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginUser {
  username: string;
  displayName: string;
  roleCode: string;
  token: string;
}

interface AuthUserRecord {
  username: string;
  displayName: string;
  passwordHash: string;
  roleCode: string;
  enabled: boolean;
}

interface AuthUserStore {
  findByUsername(username: string): Promise<AuthUserRecord | null>;
}

type AuthPrismaClient = {
  user: {
    findUnique(input: { where: { username: string } }): Promise<unknown | null>;
  };
};

class AuthDatabase implements AuthUserStore {
  private readonly prismaPromise = createRuntimePrismaClient<AuthPrismaClient>();

  /**
   * @author codex
   * Reads local platform users from MySQL instead of accepting hard-coded credentials.
   */
  async findByUsername(username: string): Promise<AuthUserRecord | null> {
    const prisma = await this.prismaPromise;
    const record = await prisma.user.findUnique({ where: { username } });
    if (!record || typeof record !== 'object') return null;
    const data = record as Partial<AuthUserRecord>;
    if (
      typeof data.username !== 'string' ||
      typeof data.displayName !== 'string' ||
      typeof data.passwordHash !== 'string' ||
      typeof data.roleCode !== 'string' ||
      typeof data.enabled !== 'boolean'
    ) {
      return null;
    }
    return {
      username: data.username,
      displayName: data.displayName,
      passwordHash: data.passwordHash,
      roleCode: data.roleCode,
      enabled: data.enabled,
    };
  }
}

export class AuthService {
  constructor(
    private readonly userStore: AuthUserStore = new AuthDatabase(),
    private readonly tokenSecret = readAuthTokenSecret(),
  ) {}

  /**
   * @author codex
   * Authenticates local platform users from MySQL and returns a signed session token.
   */
  async login(request: LoginRequest): Promise<LoginUser> {
    const username = request.username?.trim();
    const user = username ? await this.userStore.findByUsername(username) : null;
    if (!user || !verifyPassword(request.password ?? '', user.passwordHash)) {
      throw new Error('用户名或密码错误');
    }
    if (!user.enabled) throw new Error('用户已停用');

    return {
      username: user.username,
      displayName: user.displayName,
      roleCode: user.roleCode,
      token: createAuthToken({
        username: user.username,
        displayName: user.displayName,
        roleCode: user.roleCode,
      }, this.tokenSecret),
    };
  }

  async logout() {
    return { revoked: true };
  }
}
