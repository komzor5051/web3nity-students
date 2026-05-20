/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: __dirname + '/../..',
  // Загрузка файлов работ идёт через server action — поднимаем лимит тела
  // запроса (по умолчанию 1 МБ) до нескольких скриншотов за один сабмит.
  experimental: {
    serverActions: { bodySizeLimit: '40mb' },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
    ],
  },
};

module.exports = nextConfig;
