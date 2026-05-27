const contextPath = process.env.AI_QUALITY_CONTEXT_PATH ?? 'ai-quality-platform';
const gatewayBaseUrl = process.env.GATEWAY_BASE_URL ?? `http://127.0.0.1:8080/${contextPath}`;

const services = [
  ['gateway', `${gatewayBaseUrl}/health.do`],
  ['platform', `${gatewayBaseUrl}/api/system/health.do`],
  ['execution', `${gatewayBaseUrl}/api/execution/health.do`],
];

/**
 * @author codex
 * Verifies the public gateway and every routed backend health endpoint.
 */
async function checkHealth() {
  const failures = [];

  for (const [name, url] of services) {
    try {
      const response = await fetch(url);
      const payload = await response.json();
      const data = payload.data ?? payload;
      if (!response.ok || data.status !== 'UP') {
        failures.push(`${name}: unexpected payload from ${url}`);
      } else {
        console.log(`${name}: UP`);
      }
    } catch (error) {
      failures.push(`${name}: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  if (failures.length > 0) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  }
}

await checkHealth();
