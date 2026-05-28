/**
 * 前端源码卫生红线
 * @author codex
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir)
    .flatMap((name) => {
      const fullPath = join(dir, name);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) return listSourceFiles(fullPath);
      if (/\.spec\.(ts|tsx)$/u.test(name)) return [];
      return /\.(ts|tsx)$/u.test(name) && !/\.d\.ts$/u.test(name) ? [fullPath] : [];
    });
}

describe('frontend source hygiene', () => {
  it('does not use explicit any in catch bindings', () => {
    const sourceRoot = join(process.cwd(), 'src');
    const offenders = listSourceFiles(sourceRoot)
      .flatMap((filePath) => {
        const source = readFileSync(filePath, 'utf8');
        return source.match(/catch\s*\([^)]*:\s*any\b[^)]*\)/gu)
          ? [relative(process.cwd(), filePath)]
          : [];
      });

    expect(offenders).toEqual([]);
  });

  it('does not hide broken API payloads behind empty data fallbacks', () => {
    const sourceRoot = join(process.cwd(), 'src');
    const fallbackPatterns = [
      /response\.json\(\)\.catch\(\(\) => \(\{\}\)\)/u,
      /res\.json\(\)\.catch\(\(\) => \(\{\}\)\)/u,
      /\.catch\(\(\) => \[\]\)/u,
      /\.catch\(\(\) => \{\}\)/u,
      /\?\.list\s*\?\?\s*\[\]/u,
      /Array\.isArray\([^)]*\)\s*\?\s*[^:;\n]+:\s*\[\]/u,
    ];
    const offenders = listSourceFiles(sourceRoot)
      .flatMap((filePath) => {
        const source = readFileSync(filePath, 'utf8');
        return fallbackPatterns.some((pattern) => pattern.test(source))
          ? [relative(process.cwd(), filePath)]
          : [];
      });

    expect(offenders).toEqual([]);
  });

  it('does not render malformed model center records with local editing defaults', () => {
    const source = readFileSync(join(process.cwd(), 'src/features/models/models-panel.tsx'), 'utf8');

    expect(source).not.toContain("m.limits.maxOutputTokens ?? m.parameters.maxOutputTokens ?? '4096'");
    expect(source).not.toContain('m.capabilities.stream ?? m.parameters.stream ?? true');
    expect(source).not.toContain('m.capabilities.jsonMode ?? m.parameters.jsonMode ?? false');
    expect(source).not.toContain('m.capabilities.toolCalling ?? m.parameters.toolCalling ?? false');
    expect(source).not.toContain('m.capabilities.reasoning ?? m.parameters.thinkingEnabled ?? false');
  });
});
