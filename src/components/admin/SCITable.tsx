import React from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  className?: string;
}

interface SCITableProps<T extends { id?: string }> {
  columns: Column<T>[];
  data: T[];
  loading: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function SCITable<T extends { id?: string }>({
  columns, data, loading, emptyMessage = 'Nenhum registro encontrado.', onRowClick
}: SCITableProps<T>) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {columns.map((col, i) => (
              <th key={i} className={`px-6 py-4 font-medium text-slate-600 ${col.className || ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr><td colSpan={columns.length} className="px-6 py-8 text-center text-slate-400">
              <LoadingSpinner />
            </td></tr>
          ) : data.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-6 py-8 text-center text-slate-400">
              {emptyMessage}
            </td></tr>
          ) : (
            data.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row)}
                className={`hover:bg-slate-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {columns.map((col, i) => (
                  <td key={i} className={`px-6 py-4 text-slate-700 ${col.className || ''}`}>
                    {typeof col.accessor === 'function'
                      ? col.accessor(row)
                      : String(row[col.accessor] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
