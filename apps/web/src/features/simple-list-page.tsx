export interface SimpleListPageProps {
  title: string;
  description: string;
  columns: string[];
  rows: string[][];
  apiUrl?: string;
  live?: boolean;
}

export function SimpleListPage({ title, description, columns, rows, apiUrl, live }: SimpleListPageProps) {
  return (
    <section>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
          <p className="mt-2 text-sm text-neutral-500">{description}</p>
          {apiUrl ? <p className="mt-2 text-xs text-neutral-400">{apiUrl}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {apiUrl ? (
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
              {live ? '服务端数据' : '暂无服务端数据'}
            </span>
          ) : null}
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
                {row.map((cell) => (
                  <td className="px-4 py-3 text-neutral-700" key={cell}>
                    {cell}
                  </td>
                ))}
              </tr>
            )) : (
              <tr className="border-t border-neutral-100">
                <td className="px-4 py-8 text-center text-neutral-500" colSpan={columns.length}>
                  暂无数据。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
