'use client';

import { useState, type FormEvent } from 'react';
import { getGatewayApiUrl } from '@ai-quality-platform/shared-config';
import { Button, TextInput } from '@/components/ui';

export function LoginForm() {
  const [message, setMessage] = useState('本地管理员：admin / admin123456');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const response = await fetch(getGatewayApiUrl('system', '/auth/login.do'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: formData.get('username'),
        password: formData.get('password'),
      }),
    });
    const payload = await response.json();
    setMessage(payload.success === false ? payload.message : '登录成功，已获取本地会话令牌');
  }

  return (
    <form className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
      {/* @author codex: Local login is intentionally simple for phase one. */}
      <div>
        <h1 className="text-xl font-semibold tracking-normal">登录 AI 质量平台</h1>
        <p className="mt-2 text-sm text-neutral-500">使用本地管理员账号进入系统。</p>
      </div>
      <TextInput
        className="mt-6"
        defaultValue="admin"
        id="username"
        label="账号"
        name="username"
        placeholder="admin"
      />
      <TextInput
        className="mt-4"
        defaultValue="admin123456"
        id="password"
        label="密码"
        name="password"
        placeholder="admin123456"
        type="password"
      />
      <Button className="mt-6 w-full" type="submit" variant="default">
        登录
      </Button>
      <p className="mt-4 text-xs text-neutral-500">{message}</p>
    </form>
  );
}
