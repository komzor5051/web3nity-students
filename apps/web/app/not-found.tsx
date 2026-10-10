import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="state">
      <div className="eyebrow">Страница не найдена</div>
      <h1>
        Здесь <span className="green">ничего нет</span>
      </h1>
      <p className="lead">Анкета или проект удалены, скрыты или ссылка набрана с ошибкой.</p>
      <div className="actions" style={{ justifyContent: 'center' }}>
        <Link className="btn" href="/students">Ученики →</Link>
        <Link className="btn action-blue" href="/projects">Проекты →</Link>
      </div>
    </div>
  );
}
