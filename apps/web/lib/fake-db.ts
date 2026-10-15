// Тестовая подмена Supabase-клиента: таблицы в памяти, поддержаны только
// те фильтры, что используют чтения платформы. Не импортируется приложением.
type Row = Record<string, unknown>;

export function fakeDb(tables: Record<string, Row[]>) {
  function query(name: string) {
    let rows = [...(tables[name] ?? [])];
    let max = Infinity;
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq(col: string, val: unknown) {
        rows = rows.filter((r) => r[col] === val);
        return chain;
      },
      ilike(col: string, pattern: string) {
        // без wildcard: сравнение без учёта регистра, '\_' и '\%' — буквальные символы
        const want = pattern.replace(/\\([%_])/g, '$1').toLowerCase();
        rows = rows.filter((r) => String(r[col] ?? '').toLowerCase() === want);
        return chain;
      },
      is(col: string, val: unknown) {
        rows = rows.filter((r) => (r[col] ?? null) === val);
        return chain;
      },
      in(col: string, vals: unknown[]) {
        rows = rows.filter((r) => vals.includes(r[col]));
        return chain;
      },
      order: () => chain,
      limit(n: number) {
        max = n;
        return chain;
      },
      maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      single: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: rows.slice(0, max), error: null }).then(resolve),
    };
    return chain;
  }
  return { from: (name: string) => query(name) };
}
