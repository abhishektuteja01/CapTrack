import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CapTrack',
    short_name: 'CapTrack',
    start_url: '/',
    display: 'standalone',
    background_color: '#F4F5F5',
    theme_color: '#F4F5F5',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}