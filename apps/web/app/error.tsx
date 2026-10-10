'use client';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="state" role="alert">
      <div className="eyebrow">Ошибка</div>
      <h1>
        Не удалось <span className="green">загрузить</span>
      </h1>
      <p className="lead">Данные временно недоступны. Попробуйте ещё раз через минуту.</p>
      <button className="btn" type="button" onClick={reset}>
        Повторить →
      </button>
    </div>
  );
}
