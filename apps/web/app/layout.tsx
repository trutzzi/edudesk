import './globals.css';
import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { Geist } from 'next/font/google';
import { ErrorReporter } from '@/components/layout/ErrorReporter';
import { AuthProvider } from '@/features/auth/AuthProvider';

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin', 'latin-ext'],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return {
    title: {
      default: 'EduDesk',
      template: '%s · EduDesk',
    },
    description: t('description'),
    // Opened from the home screen, iOS shows it full screen with its own name
    appleWebApp: { capable: true, title: 'EduDesk', statusBarStyle: 'default' },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Colours the phone's status bar and browser toolbar
  themeColor: '#4f46e5',
  // Draw under the notch and home indicator; padding with env(safe-area-inset-*) keeps content clear of them
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={`${geist.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-slate-50 font-sans text-slate-900">
        <NextIntlClientProvider>
          <AuthProvider>
            <ErrorReporter />
            {children}
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
