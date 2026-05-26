/**
 * 协议模板渲染工具
 * @author codex
 */
export function buildProtocolTestContext(query: string): Record<string, unknown> {
  return {
    query,
    case: {
      query,
      input: {
        query,
      },
    },
  };
}

export function renderProtocolTemplate(template: string, data: Record<string, unknown>) {
  return template.replace(/\{\{([^}]+)}}/g, (_, rawPath: string) => {
    const value = readObjectPath(data, rawPath.trim());
    return value === undefined || value === null ? '' : String(value);
  });
}

function readObjectPath(data: Record<string, unknown>, path: string) {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, data);
}
