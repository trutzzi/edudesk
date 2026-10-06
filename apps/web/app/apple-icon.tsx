import { ImageResponse } from 'next/og';
import { LogoMark } from './LogoMark';

// iOS draws its own rounded corners, so this one is a plain square
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(<LogoMark size={180} rounded={false} />, size);
}
