/**
 * 侧边栏用户菜单组件
 * 参照 design-deploy/frontend/src/components/layout/sidebar.tsx 用户区域，1:1 还原
 * @author Antigravity/Gemini
 */
'use client';

import { useRouter } from 'next/navigation';
import { LogOut, User } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getGatewayApiUrl } from '@ai-quality-platform/shared-config';

interface UserMenuProps {
  collapsed?: boolean;
  name?: string;
  role?: string;
}

async function callLogout() {
  try {
    await fetch(getGatewayApiUrl('system', '/auth/logout.do'), {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // 接口失败也继续跳转，避免用户卡死
  }
}

export function UserMenu({ collapsed = false, name = '管理员', role = '系统管理员' }: UserMenuProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await callLogout();
    router.push('/ai-quality-platform/login');
  };

  const initials = name.slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={collapsed ? name : undefined}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent',
            collapsed && 'justify-center px-2',
          )}
        >
          {/* 头像 */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-bold text-white">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex flex-col items-start overflow-hidden text-left">
              <span className="w-full truncate text-sm font-medium text-foreground">{name}</span>
              <span className="text-xs text-muted-foreground">{role}</span>
            </div>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={collapsed ? 'center' : 'start'}
        side="top"
        className="w-56"
      >
        {/* 用户信息头 */}
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">{role}</p>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem className="gap-2 cursor-not-allowed opacity-60" disabled>
          <User className="h-4 w-4" />
          个人资料
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="gap-2 cursor-pointer text-destructive focus:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
