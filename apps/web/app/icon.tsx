import { ImageResponse } from 'next/og';
import { LogoMark } from './LogoMark';

// The home-screen and install icons, drawn like the logo: a white B on indigo
export function generateImageMetadata() {
  return [192, 512].map((size) => ({ id: String(size), size: { width: size, height: size }, contentType: 'image/png' }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const size = Number(await id);
  return new ImageResponse(<LogoMark size={size} />, { width: size, height: size });
}
