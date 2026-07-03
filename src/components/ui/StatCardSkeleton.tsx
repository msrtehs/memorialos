export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-6 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-1/2 mb-3" />
      <div className="h-8 bg-slate-200 rounded w-1/3" />
    </div>
  );
}
