/**
 * 协议模板渲染测试
 * @author codex
 */
import { describe, expect, it } from 'vitest';
import { buildProtocolTestContext, renderProtocolTemplate } from './protocol-template';

describe('protocol template rendering', () => {
  it('renders case.input.query for protocol test requests', () => {
    const context = buildProtocolTestContext('台湾和中国是什么关系');

    expect(renderProtocolTemplate('{"query":"{{case.input.query}}"}', context)).toBe('{"query":"台湾和中国是什么关系"}');
  });
});
