export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="skip-link">Загружаем…</span>
      <div className="pagehead">
        <div className="eyebrow">Практикум «Вайбкодинг»</div>
      </div>
      <div className="grid">
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    </div>
  );
}
