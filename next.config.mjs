/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // IMPORTANTE: Não use `output: 'export'` com Clerk. SSR/Edge é necessário.
  // Se você tiver `output: 'export'` hoje, remova.
};
export default nextConfig;
