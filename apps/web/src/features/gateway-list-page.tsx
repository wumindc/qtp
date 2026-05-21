'use client';

import { useEffect, useMemo, useState } from 'react';
import { getGatewayApiUrl, type BackendServiceKey } from '@ai-quality-platform/shared-config';

type GatewayRow = Record<string, unknown>;

interface GatewayListPageProps {
  title: string;
  description: string;
  service: BackendServiceKey;
  path: string;
  columns: string[];
  mapRow: (item: GatewayRow) => string[];
  data?: Record<string, unknown>;
}

const EMPTY_DATA: Record<string, unknown> = {};

/**
 * @author codex
 * Loads management-list data through the public gateway and keeps empty/error states honest.
 */
export function GatewayListPage({
  title,
  description,
  service,
  path,
  columns,
  mapRow,
  data = EMPTY_DATA,
}: GatewayListPageProps) {
  const [rows, setRows] = useState<string[][]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const url = useMemo(() => getGatewayApiUrl(service, path), [path, service]);

  useEffect(() => {
    let active = true;
    setStatus('loading');

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page: { currentPage: 1, linesPerPage: 20 },
        data,
      }),
    })
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        const list = Array.isArray(payload.list) ? payload.list : Array.isArray(payload.data?.list) ? payload.data.list : [];
        setRows(list.map((item: GatewayRow) => mapRow(item)));
        setStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setRows([]);
        setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [data, mapRow, url]);

  return (
    <section>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
          <p className="mt-2 text-sm text-neutral-500">{description}</p>
          <p className="mt-2 text-xs text-neutral-400">{url}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
            {status === 'ready' ? '服务端数据' : status === 'loading' ? '加载中' : '加载失败'}
          </span>
          <button className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white">新增</button>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-500">
            <tr>
              {columns.map((column) => (
                <th className="px-4 py-3 font-medium" key={column}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? rows.map((row) => (
              <tr className="border-t border-neutral-100" key={row.join('-')}>
                {row.map((cell, index) => (
                  <td className="px-4 py-3 text-neutral-700" key={`${cell}-${index}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            )) : (
              <tr className="border-t border-neutral-100">
                <td className="px-4 py-8 text-center text-neutral-500" colSpan={columns.length}>
                  {status === 'error' ? '服务暂不可用，暂无数据。' : '暂无数据。'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
