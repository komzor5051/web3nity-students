// Внутренние типы парсера. Не путать с DB-типами в @web3nity/db/types.

export interface ParsedMedia {
  /**
   * Тип медиа. 'sticker' и 'voice' помечаем отдельно — для импорта обычно
   * не нужны (это эфемерные сообщения), но raw_messages их сохраняет.
   */
  type: 'image' | 'video' | 'file' | 'sticker' | 'voice';
  /** Путь относительно корня экспорта (ChatExport_X/path). */
  path: string;
  /** MIME-имя файла, если важно для отображения. */
  filename?: string;
}

export interface ParsedMessage {
  /** Telegram message id (число из id="messageN"). */
  messageId: number;
  /** Topic / thread id — в HTML-выгрузке обычно не доступен; null. */
  threadId: number | null;
  /** Display name автора. HTML не даёт telegram_user_id. */
  authorName: string | null;
  /** ISO timestamp из title="DD.MM.YYYY HH:MM:SS UTC±NN:NN". */
  postedAt: string | null;
  /** Текст с сохранёнными переводами строк (br → \n). */
  text: string;
  media: ParsedMedia[];
  /** id сообщения, на которое отвечают (если есть). */
  replyToId: number | null;
  /** true если "service" сообщение (создание чата, добавление и т.п.). */
  isService: boolean;
  /** Был ли это joined-блок (продолжение того же автора). */
  joined: boolean;
}
