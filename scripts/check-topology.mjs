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

const envExample = readFileSync(join(root, '.env.example'), 'utf8');
for (const envName of oldEnvNames) {
  if (envExample.includes(envName)) fail(`.env.example still exposes old variable ${envName}`);
}
for (const envName of ['PLATFORM_SERVICE_PORT', 'EXECUTION_SERVICE_PORT', 'PLATFORM_SERVICE_HOST', 'EXECUTION_SERVICE_HOST']) {
  if (!envExample.includes(envName)) fail(`.env.example missing ${envName}`);
}

if (process.exitCode) process.exit(process.exitCode);
console.log('service topology: OK');
