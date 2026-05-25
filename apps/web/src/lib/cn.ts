import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 合并 Tailwind CSS 类名，自动处理冲突
 * @author Antigravity/Gemini
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
