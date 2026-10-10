'use client';

/** Строка «Найдено: N», активные фильтры и сброс — общая для каталогов. */
export function Results({ count, active, onReset }: { count: number; active: string[]; onReset: () => void }) {
  return (
    <div className="results">
      <span role="status">Найдено: {count}</span>
      <div id="active-filters">
        {active.map((v) => (
          <span key={v} className="tag">
            {v}
          </span>
        ))}
      </div>
      <button className="reset" type="button" onClick={onReset}>
        Сбросить фильтры
      </button>
    </div>
  );
}
