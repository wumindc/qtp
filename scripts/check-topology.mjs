import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const expectedApps = new Set([
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
if (!devServices.includes('quality-platform-service') || !devServices.includes('quality-execution-service')) {
  fail('dev:services must start platform and execution services');
}
for (const app of removedApps) {
  if (devServices.includes(app)) fail(`dev:services still references ${app}`);
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
for (const serviceName of ['web', 'quality-gateway', 'quality-platform-service', 'quality-execution-service', 'mysql', 'redis']) {
  const block = readServiceBlock(compose, serviceName);
  if (block.includes('\n    ports:')) fail(`${serviceName} must not expose host ports in production compose`);
}
const nginxConf = readFileSync(join(root, 'nginx/default.conf'), 'utf8');
if (!nginxConf.includes('proxy_pass http://web:3000')) fail('nginx must route web traffic to web:3000');
if (!nginxConf.includes('proxy_pass http://quality-gateway:8080')) fail('nginx must route API traffic to quality-gateway:8080');
const devDepsCompose = readFileSync(join(root, 'docker-compose.dev-deps.yml'), 'utf8');
if (!devDepsCompose.includes('"3306:3306"') || !devDepsCompose.includes('"6379:6379"')) {
  fail('docker-compose.dev-deps.yml must expose mysql and redis for node development');
}

const envExample = readFileSync(join(root, '.env.example'), 'utf8');
for (const envName of oldEnvNames) {
  if (envExample.includes(envName)) fail(`.env.example still exposes old variable ${envName}`);
}
for (const envName of ['PLATFORM_SERVICE_PORT', 'EXECUTION_SERVICE_PORT', 'PLATFORM_SERVICE_HOST', 'EXECUTION_SERVICE_HOST']) {
  if (!envExample.includes(envName)) fail(`.env.example missing ${envName}`);
}

if (process.exitCode) process.exit(process.exitCode);
console.log('service topology: OK');
