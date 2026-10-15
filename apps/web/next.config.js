/** @type {import('next').NextConfig} */
const nextConfig = {
  // Загрузка файлов работ идёт через server action — поднимаем лимит тела
  // запроса (по умолчанию 1 МБ) до нескольких скриншотов за один сабмит.
  experimental: {
    serverActions: { bodySizeLimit: '40mb' },
  },
  // Платформа разделена на курсы: /[course]/... Старые ссылки без курса жили
  // до разделения и относились к вайбкодингу — уводим на /vibecoding/...
  // Старые /students/[slug] остались от первой версии каталога и сверстаны
  // иначе — уводим сразу на основные /s и /w.
  async redirects() {
    return [
      { source: '/students/:slug/works/:id', destination: '/vibecoding/w/:id', permanent: true },
      { source: '/students/:slug', destination: '/vibecoding/s/:slug', permanent: true },
      { source: '/students', destination: '/vibecoding/students', permanent: true },
      { source: '/projects', destination: '/vibecoding/projects', permanent: true },
      { source: '/s/:slug', destination: '/vibecoding/s/:slug', permanent: true },
      { source: '/w/:id', destination: '/vibecoding/w/:id', permanent: true },
      { source: '/profile', destination: '/vibecoding/profile', permanent: true },
      { source: '/profile/:path*', destination: '/vibecoding/profile/:path*', permanent: true },
    ];
  },
  // Реестр курсов лежит в TS-пакете монорепо: Next должен его скомпилировать.
  transpilePackages: ['@vibe/db'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
    ],
  },
};

module.exports = nextConfig;
