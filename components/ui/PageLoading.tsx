export function PageLoading() {
  return <div role="status" aria-label="Мэдээлэл ачаалж байна" className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-8"><span className="sr-only">Мэдээлэл ачаалж байна…</span><div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" /><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0,1,2,3].map((id) => <div key={id} className="surface h-28 animate-pulse bg-slate-100" />)}</div><div className="surface h-72 animate-pulse bg-slate-100" /></div>;
}
