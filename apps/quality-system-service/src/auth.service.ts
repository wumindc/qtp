import { DEFAULT_ADMIN } from '@ai-quality-platform/shared-database';

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

export class AuthService {
  /**
   * @author codex
   * Provides the first local-account login path before database-backed users land.
   */
  async login(request: LoginRequest): Promise<LoginUser> {
    if (
      request.username !== DEFAULT_ADMIN.username ||
      request.password !== DEFAULT_ADMIN.initialPassword
    ) {
      throw new Error('用户名或密码错误');
    }

    return {
      username: DEFAULT_ADMIN.username,
      displayName: DEFAULT_ADMIN.displayName,
      roleCode: DEFAULT_ADMIN.roleCode,
      token: `local-admin-token-${DEFAULT_ADMIN.username}`,
    };
  }
}
