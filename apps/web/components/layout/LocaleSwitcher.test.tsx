import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { setLocale } from '@/i18n/actions';
import { renderWithIntl } from '@/test/renderWithIntl';
import { LocaleSwitcher } from './LocaleSwitcher';

vi.mock('@/i18n/actions', () => ({ setLocale: vi.fn() }));

describe('LocaleSwitcher', () => {
  it('marks the current language', () => {
    renderWithIntl(<LocaleSwitcher />, 'ro');

    expect(screen.getByRole('button', { name: 'Română' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches to the other language', async () => {
    renderWithIntl(<LocaleSwitcher />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Română' }));

    expect(setLocale).toHaveBeenCalledWith('ro');
  });
});
