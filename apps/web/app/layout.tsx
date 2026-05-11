import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Студенты — AI-Ассистенты 3.0',
  description: 'Витрина студентов курса AI-Ассистенты 3.0 от Web3nity. Профили, ниши, кейсы.',
  openGraph: {
    title: 'Студенты — AI-Ассистенты 3.0',
    description: 'Витрина студентов курса AI-Ассистенты 3.0 от Web3nity.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen">
        <header className="border-b border-line">
          <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
            <a href="/" className="text-cream font-bold tracking-tight uppercase text-lg">
              Web3nity / Students
            </a>
            <a
              href="https://ai-education.io"
              className="text-muted hover:text-cream text-sm uppercase tracking-wider"
            >
              ai-education.io
            </a>
          </div>
        </header>
        <main>{children}</main>
        <footer className="border-t border-line mt-24">
          <div className="max-w-6xl mx-auto px-6 py-8 text-muted text-sm flex items-center justify-between">
            <span>Курс «AI-Ассистенты 3.0»</span>
            <span>© Web3nity</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
