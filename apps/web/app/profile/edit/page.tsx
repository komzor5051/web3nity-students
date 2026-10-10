import Link from 'next/link';
import type { Metadata } from 'next';
import { requireStudent } from '@/lib/auth';
import { REGIONS, STATUS_LABEL, STATUS_ORDER, studentStatuses } from '@/lib/catalog';
import { publishedStudents, sphereOptions } from '@/lib/queries';
import { canonicalSphere, cleanBio, tgHandle } from '@/lib/text';
import { Avatar } from '@/lib/ui';
import { saveProfile } from '../actions';
import { ActionForm, SubmitButton } from '../action-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Моя анкета' };

export default async function EditProfilePage() {
  const me = await requireStudent();
  const spheres = sphereOptions(await publishedStudents());
  const sphere = canonicalSphere(me.sphere);
  const statuses = studentStatuses(me);
  const tg = tgHandle(me.telegram_username);
  const isNew = !me.is_published;

  return (
    <div className="form">
      <Link className="back" href="/profile">
        ← Мой профиль
      </Link>
      <div className="eyebrow">Личный кабинет</div>
      <h1>
        Расскажите <span className="green">о себе</span>
      </h1>
      <p className="lead">Помогите другим ученикам познакомиться с вами.</p>
      <ActionForm action={saveProfile} id="profile-form">
        <div className="form-group">
          <label htmlFor="display_name">Как вас зовут?</label>
          <input id="display_name" name="display_name" defaultValue={me.display_name} required maxLength={120} autoComplete="name" />
        </div>
        <div className="form-group">
          <label htmlFor="photo">
            Фотография <span className="optional">— необязательно</span>
          </label>
          <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
          {me.avatar_url ? (
            <div className="current-photo">
              <Avatar name={me.display_name} url={me.avatar_url} /> Сейчас на анкете. Новое фото заменит его.
            </div>
          ) : null}
        </div>
        <div className="form-group">
          <label htmlFor="city">
            Город, где вы сейчас <span className="optional">— необязательно</span>
          </label>
          <input id="city" name="city" defaultValue={me.city ?? ''} maxLength={120} placeholder="Например, Лиссабон" />
        </div>
        <div className="form-group">
          <label htmlFor="country">
            Страна <span className="optional">— необязательно</span>
          </label>
          <input id="country" name="country" defaultValue={me.country ?? ''} maxLength={120} placeholder="Например, Португалия" />
        </div>
        <div className="form-group">
          <label htmlFor="region">Регион, где вы сейчас</label>
          <select id="region" name="region" defaultValue={me.region ?? ''}>
            <option value="">Определить по городу и стране</option>
            {REGIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="sphere">Сфера деятельности</label>
          <select id="sphere" name="sphere" defaultValue={sphere ?? ''}>
            <option value="">Не указана</option>
            {spheres.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="niche">
            Чем занимаетесь? <span className="optional">(профессия / бизнес / проект)</span>
          </label>
          <textarea id="niche" name="niche" defaultValue={me.niche ?? ''} maxLength={300} />
        </div>
        <div className="form-group">
          <label htmlFor="bio">
            О себе <span className="optional">— необязательно</span>
          </label>
          <textarea id="bio" name="bio" defaultValue={cleanBio(me.bio) ?? ''} maxLength={4000} />
        </div>
        <div className="form-group">
          <label htmlFor="expectations">Для чего пришли на практикум и чего ожидаете?</label>
          <textarea id="expectations" name="expectations" defaultValue={me.expectations ?? ''} maxLength={4000} />
        </div>
        <div className="form-group">
          <label htmlFor="goal">Цель после обучения?</label>
          <textarea id="goal" name="goal" defaultValue={me.goal ?? ''} maxLength={4000} />
        </div>
        <fieldset className="form-group" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontSize: 14, marginTop: 12, marginBottom: 7 }}>Статус — можно несколько</legend>
          <div className="checks">
            {STATUS_ORDER.map((s) => (
              <label key={s}>
                <input type="checkbox" name="statuses" value={s} defaultChecked={statuses.includes(s)} />
                {STATUS_LABEL[s]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="form-group">
          <label htmlFor="tg">Телеграм</label>
          <input id="tg" value={tg ? `@${tg}` : 'Ник не указан в Telegram'} readOnly disabled />
          <p className="hint">Берётся из Telegram при входе. Сменить можно в настройках Telegram.</p>
        </div>
        <p className="demo">Анкета и контакты доступны только ученикам платформы.</p>
        <SubmitButton pending="Сохраняем…">{isNew ? 'Создать профиль →' : 'Сохранить изменения →'}</SubmitButton>
      </ActionForm>
      <Link href="/profile/projects/new" className="back" style={{ marginTop: 24 }}>
        Добавить проект →
      </Link>
    </div>
  );
}
