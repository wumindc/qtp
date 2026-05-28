/**
 * @author codex
 * Shared password hashing and stateless session token primitives.
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export interface PasswordHashOptions {
  salt?: string;
}

export interface AuthTokenUser {
  username: string;
  displayName: string;
  roleCode: string;
}

export interface AuthTokenPayload extends AuthTokenUser {
  exp: number;
  iat: number;
}

export interface AuthTokenTimingOptions {
  nowMs?: number;
  ttlSeconds?: number;
}

const LOCAL_DEVELOPMENT_SECRET = 'qtp-local-development-auth-secret';
const TOKEN_VERSION = { alg: 'HS256', typ: 'QTP_AUTH_TOKEN' };
const PASSWORD_KEY_LENGTH = 64;

export function hashPassword(password: string, options: PasswordHashOptions = {}) {
  const salt = options.salt ?? randomBytes(16).toString('base64url');
  const digest = scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString('base64url');
  return `scrypt:${salt}:${digest}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, salt, digest] = passwordHash.split(':');
  if (algorithm !== 'scrypt' || !salt || !digest) return false;
  const expected = Buffer.from(digest, 'base64url');
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createAuthToken(user: AuthTokenUser, secret: string, options: AuthTokenTimingOptions = {}) {
  const nowSeconds = Math.floor((options.nowMs ?? Date.now()) / 1000);
  const ttlSeconds = options.ttlSeconds ?? 12 * 60 * 60;
  const payload: AuthTokenPayload = {
    username: user.username,
    displayName: user.displayName,
    roleCode: user.roleCode,
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
  };
  const headerSegment = encodeJson(TOKEN_VERSION);
  const payloadSegment = encodeJson(payload);
  const signature = signSegments(headerSegment, payloadSegment, secret);
  return `${headerSegment}.${payloadSegment}.${signature}`;
}

export function verifyAuthToken(token: string | undefined, secret: string, options: Pick<AuthTokenTimingOptions, 'nowMs'> = {}) {
  if (!token) return null;
  const [headerSegment, payloadSegment, signature] = token.split('.');
  if (!headerSegment || !payloadSegment || !signature) return null;
  const expectedSignature = signSegments(headerSegment, payloadSegment, secret);
  if (!safeEqual(signature, expectedSignature)) return null;
  const header = decodeJson(headerSegment);
  if (!header) return null;
  if (header.alg !== TOKEN_VERSION.alg || header.typ !== TOKEN_VERSION.typ) return null;
  const payload = decodeJson(payloadSegment) as Partial<AuthTokenPayload> | null;
  if (
    !payload ||
    typeof payload.username !== 'string' ||
    typeof payload.displayName !== 'string' ||
    typeof payload.roleCode !== 'string' ||
    typeof payload.exp !== 'number'
  ) {
    return null;
  }
  const nowSeconds = Math.floor((options.nowMs ?? Date.now()) / 1000);
  if (payload.exp <= nowSeconds) return null;
  return payload as AuthTokenPayload;
}

export function readAuthTokenSecret(env: Record<string, string | undefined> = process.env) {
  const configured = env.QTP_AUTH_TOKEN_SECRET?.trim();
  if (configured) return configured;
  if (env.NODE_ENV === 'production') {
    throw new Error('QTP_AUTH_TOKEN_SECRET must be configured in production');
  }
  return LOCAL_DEVELOPMENT_SECRET;
}

export function readBearerToken(headerValue: string | string[] | undefined) {
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const match = /^Bearer\s+(.+)$/iu.exec(value ?? '');
  return match?.[1];
}

function encodeJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeJson(segment: string): Record<string, unknown> | null {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function signSegments(headerSegment: string, payloadSegment: string, secret: string) {
  return createHmac('sha256', secret).update(`${headerSegment}.${payloadSegment}`).digest('base64url');
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
