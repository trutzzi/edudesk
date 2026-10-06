import type { MetadataRoute } from 'next';

// Lets phones add Blue to the home screen and open it full screen, like an app
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Blue',
    short_name: 'Blue',
    description: 'Management for therapy institutions: administrators, therapists and patients/clients.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8fafc',
    theme_color: '#4f46e5',
    icons: [
      { src: '/icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
