import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import type { Locale } from '@/i18n/config';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';

const messages = { en, ro };

export const renderWithIntl = (ui: ReactElement, locale: Locale = 'en') =>
  render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone="Europe/Bucharest">
      {ui}
    </NextIntlClientProvider>,
  );
