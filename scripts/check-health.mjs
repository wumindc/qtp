const contextPath = process.env.AI_QUALITY_CONTEXT_PATH ?? 'ai-quality-platform';
const gatewayBaseUrl = process.env.GATEWAY_BASE_URL ?? `http://127.0.0.1:8080/${contextPath}`;
const healthUrl = `${gatewayBaseUrl}/health.do`;

/**
 * @author codex
 * Verifies the single aggregated health endpoint used by node development and production nginx.
 */
async function checkHealth() {
  const failures = [];

  try {
    const response = await fetch(healthUrl);
    const payload = await response.json();
    const data = payload.data ?? payload;
    const services = data.services ?? {};
    if (!response.ok || data.status !== 'UP') {
      failures.push(`gateway: unexpected aggregate payload from ${healthUrl}`);
    }
    for (const name of ['gateway', 'platform', 'execution', 'aiInvocation']) {
      if (services[name]?.status === 'UP') {
        console.log(`${name}: UP`);
      } else {
        failures.push(`${name}: ${services[name]?.message ?? 'DOWN'}`);
      }
    }
  } catch (error) {
    failures.push(`gateway: ${error instanceof Error ? error.message : 'unknown error'}`);
  }

  if (failures.length > 0) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  }
}

await checkHealth();
