import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const expectedApps = new Set([
  'quality-ai-invocation-service',
  'quality-execution-service',
  'quality-gateway',
  'quality-platform-service',
]);
const removedApps = [
  'quality-ai-service',
  'quality-business-service',
  'quality-case-service',
  'quality-plan-service',
  'quality-review-service',
  'quality-statistics-service',
  'quality-system-service',
];
const oldEnvNames = [
  'BUSINESS_SERVICE_PORT',
  'CASE_SERVICE_PORT',
  'PLAN_SERVICE_PORT',
  'AI_SERVICE_PORT',
  'REVIEW_SERVICE_PORT',
  'STATISTICS_SERVICE_PORT',
  'SYSTEM_SERVICE_PORT',
];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function readServiceBlock(compose, serviceName) {
  const pattern = new RegExp(`\\n  ${serviceName}:\\n([\\s\\S]*?)(?=\\n  [a-zA-Z0-9_-]+:|\\n*$)`, 'u');
  return pattern.exec(`\n${compose}`)?.[1] ?? '';
}

const appDirs = readdirSync(join(root, 'apps'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('quality-'))
  .map((entry) => entry.name)
  .sort();

for (const app of expectedApps) {
  if (!appDirs.includes(app)) fail(`missing deployable service: ${app}`);
}
for (const app of removedApps) {
  if (appDirs.includes(app)) fail(`old service still exists as app: ${app}`);
}

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const devServices = packageJson.scripts?.['dev:services'] ?? '';
if (
  !devServices.includes('quality-platform-service') ||
  !devServices.includes('quality-execution-service') ||
  !devServices.includes('quality-ai-invocation-service')
) {
  fail('dev:services must start platform, execution, and AI invocation services');
}
for (const app of removedApps) {
  if (devServices.includes(app)) fail(`dev:services still references ${app}`);
}

for (const app of ['quality-platform-service', 'quality-execution-service']) {
  const servicePackage = JSON.parse(readFileSync(join(root, 'apps', app, 'package.json'), 'utf8'));
  if (servicePackage.dependencies?.['@ai-quality-platform/ai-model-adapter']) {
    fail(`${app} must call models through ai-invocation-client instead of depending on ai-model-adapter`);
  }
  if (!servicePackage.dependencies?.['@ai-quality-platform/ai-invocation-client']) {
    fail(`${app} must depend on ai-invocation-client for internal model calls`);
  }
}

const invocationClientPackage = JSON.parse(readFileSync(join(root, 'packages', 'ai-invocation-client', 'package.json'), 'utf8'));
if (invocationClientPackage.dependencies?.['@ai-quality-platform/ai-model-adapter']) {
  fail('ai-invocation-client must not depend on ai-model-adapter; share only pure invocation contracts');
}
if (!invocationClientPackage.dependencies?.['@ai-quality-platform/ai-invocation-contract']) {
  fail('ai-invocation-client must depend on ai-invocation-contract for pure internal model call types');
}
const invocationClientSource = readFileSync(join(root, 'packages', 'ai-invocation-client', 'src', 'index.ts'), 'utf8');
if (invocationClientSource.includes('@ai-quality-platform/ai-model-adapter')) {
  fail('ai-invocation-client must not import ai-model-adapter');
}
// @author codex: Keep the AI invocation boundary free of raw provider wire escape hatches.
const invocationContractSource = readFileSync(join(root, 'packages', 'ai-invocation-contract', 'src', 'index.ts'), 'utf8');
const modelAdapterSource = readFileSync(join(root, 'packages', 'ai-model-adapter', 'src', 'index.ts'), 'utf8');
if (invocationContractSource.includes('providerOptions')) {
  fail('AI invocation contract must not expose providerOptions as a generic provider wire escape hatch');
}
if (invocationContractSource.includes('reasoningEffort?: unknown')) {
  fail('AI invocation contract must model reasoningEffort explicitly instead of unknown');
}
if (modelAdapterSource.includes('request.providerOptions')) {
  fail('AI model adapter must not spread arbitrary providerOptions into provider payloads');
}

const compose = readFileSync(join(root, 'docker-compose.yml'), 'utf8');
if (!compose.includes('nginx:')) fail('docker-compose.yml must expose nginx as the only public entry');
if (!compose.includes('${PUBLIC_WEB_PORT:-5670}:80')) {
  fail('docker-compose.yml must expose only nginx on ${PUBLIC_WEB_PORT:-5670}:80');
}
for (const app of removedApps) {
  if (compose.includes(`${app}:`) || compose.includes(`SERVICE_NAME: ${app}`)) {
    fail(`docker-compose.yml still defines old service ${app}`);
  }
}
for (const app of expectedApps) {
  if (!compose.includes(`${app}:`)) {
    fail(`docker-compose.yml missing ${app}`);
  }
}
if (!compose.includes('PLATFORM_SERVICE_HOST: quality-platform-service')) {
  fail('docker-compose.yml must route gateway to quality-platform-service by service name');
}
if (!compose.includes('EXECUTION_SERVICE_HOST: quality-execution-service')) {
  fail('docker-compose.yml must route gateway to quality-execution-service by service name');
}
if (!compose.includes('AI_INVOCATION_SERVICE_HOST: quality-ai-invocation-service')) {
  fail('docker-compose.yml must route internal model calls to quality-ai-invocation-service by service name');
}
for (const serviceName of ['web', 'quality-gateway', 'quality-platform-service', 'quality-execution-service', 'quality-ai-invocation-service', 'mysql']) {
  const block = readServiceBlock(compose, serviceName);
  if (block.includes('\n    ports:')) fail(`${serviceName} must not expose host ports in production compose`);
}
if (compose.includes('\n  redis:') || compose.includes('REDIS_')) {
  fail('docker-compose.yml must not define unused Redis runtime dependencies');
}
if (compose.includes('MYSQL_ROOT_PASSWORD: root') || compose.includes('mysql://root:root@')) {
  fail('docker-compose.yml must not hard-code root/root database credentials');
}
if (!compose.includes('NODE_ENV: production') || !compose.includes('QTP_RUNTIME_ENV: production')) {
  fail('docker-compose.yml must run production containers with explicit production runtime flags');
}
if (!compose.includes('QTP_ALLOWED_APP_INVOKE_ORIGINS: ${QTP_ALLOWED_APP_INVOKE_ORIGINS:-}')) {
  fail('docker-compose.yml must expose an explicit allowlist for private tested application origins');
}
for (const envName of ['MYSQL_ROOT_PASSWORD', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE']) {
  if (!compose.includes(`${envName}: $`)) fail(`docker-compose.yml must read ${envName} from environment`);
}
const nginxConf = readFileSync(join(root, 'nginx/default.conf'), 'utf8');
if (!nginxConf.includes('proxy_pass http://web:3000')) fail('nginx must route web traffic to web:3000');
if (!nginxConf.includes('proxy_pass http://quality-gateway:8080')) fail('nginx must route API traffic to quality-gateway:8080');
const devDepsCompose = readFileSync(join(root, 'docker-compose.dev-deps.yml'), 'utf8');
if (!devDepsCompose.includes('"3306:3306"')) {
  fail('docker-compose.dev-deps.yml must expose mysql for node development');
}
if (devDepsCompose.includes('redis') || devDepsCompose.includes('6379')) {
  fail('docker-compose.dev-deps.yml must not expose unused Redis');
}

const envExample = readFileSync(join(root, '.env.example'), 'utf8');
for (const envName of oldEnvNames) {
  if (envExample.includes(envName)) fail(`.env.example still exposes old variable ${envName}`);
}
for (const envName of ['REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD']) {
  if (envExample.includes(envName)) fail(`.env.example still exposes unused variable ${envName}`);
}
if (envExample.includes('JWT_SECRET')) fail('.env.example still exposes old JWT_SECRET variable');
for (const envName of ['PLATFORM_SERVICE_PORT', 'EXECUTION_SERVICE_PORT', 'AI_INVOCATION_SERVICE_PORT', 'PLATFORM_SERVICE_HOST', 'EXECUTION_SERVICE_HOST', 'AI_INVOCATION_SERVICE_HOST', 'QTP_AUTH_TOKEN_SECRET', 'QTP_ADMIN_INITIAL_PASSWORD']) {
  if (!envExample.includes(envName)) fail(`.env.example missing ${envName}`);
}
if (!envExample.includes('QTP_ALLOWED_APP_INVOKE_ORIGINS')) {
  fail('.env.example missing QTP_ALLOWED_APP_INVOKE_ORIGINS');
}
if (!compose.includes('QTP_AUTH_TOKEN_SECRET: ${QTP_AUTH_TOKEN_SECRET:?QTP_AUTH_TOKEN_SECRET is required}')) {
  fail('docker-compose.yml must require QTP_AUTH_TOKEN_SECRET for signed platform sessions');
}

const prismaSchema = readFileSync(join(root, 'packages', 'shared-database', 'prisma', 'schema.prisma'), 'utf8');
for (const staleField of [
  'createdBy',
  'runName',
  'costCalculatedAt',
  'reviewedAt',
  'authType',
  'authConfig',
]) {
  if (new RegExp(`\\b${staleField}\\b`, 'u').test(prismaSchema)) {
    fail(`Prisma schema still contains unused field ${staleField}`);
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log('service topology: OK');
