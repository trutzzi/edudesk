import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logo } from '@/components/layout/Logo';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api/client';
import { renderWithIntl } from '@/test/renderWithIntl';
import { signIn } from '@/test/signIn';
import { BrandingProvider } from './BrandingProvider';
import { InstitutionSettings } from './InstitutionSettings';

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  api: vi.fn(),
}));

const branded = { appName: 'Centrul Soare', color: '#ea580c', logoUrl: '/api/schools/s1/logo?v=1' };

const render = (ui: React.ReactNode) =>
  renderWithIntl(
    <AuthProvider>
      <BrandingProvider>{ui}</BrandingProvider>
    </AuthProvider>,
  );

const brandColor = () => document.documentElement.style.getPropertyValue('--color-indigo-600');

afterEach(() => {
  vi.mocked(api).mockReset();
  document.documentElement.removeAttribute('style');
});

describe('branding', () => {
  it("shows the institution's name, logo and color once signed in", async () => {
    signIn();
    vi.mocked(api).mockResolvedValue(branded);
    render(<Logo />);

    expect(await screen.findByText('Centrul Soare')).toBeInTheDocument();
    expect(document.querySelector('img')?.getAttribute('src')).toBe('http://localhost:4000/api/schools/s1/logo?v=1');
    await waitFor(() => expect(brandColor()).toBe('#ea580c'));
  });

  it('keeps the default look without one', async () => {
    signIn();
    vi.mocked(api).mockResolvedValue({ appName: null, color: null, logoUrl: null });
    render(<Logo />);

    expect(await screen.findByText('Blue')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(brandColor()).toBe('');
  });

  it('lets the admin pick a color, previewing it, and save it with the name', async () => {
    signIn();
    vi.mocked(api).mockImplementation(async (_path, options) => (options?.method ? {} : branded));
    render(<InstitutionSettings />);
    const user = userEvent.setup();

    const name = await screen.findByLabelText('App name');
    await user.clear(name);
    await user.type(name, 'Centrul Luna');
    await user.click(screen.getByRole('button', { name: '#16a34a' }));
    await waitFor(() => expect(brandColor()).toBe('#16a34a'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/api/schools/branding', {
        method: 'PATCH',
        body: { appName: 'Centrul Luna', color: '#16a34a' },
        token: 'token',
      }),
    );
  });

  it('uploads a logo as the image itself, and refuses an SVG', async () => {
    signIn();
    vi.mocked(api).mockImplementation(async (_path, options) => (options?.method ? {} : branded));
    render(<InstitutionSettings />);
    const user = userEvent.setup({ applyAccept: false });
    const input = await screen.findByLabelText('Upload logo');

    await user.upload(input, new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }));
    expect(await screen.findByText('The logo must be a PNG, JPEG or WebP image.')).toBeInTheDocument();

    const png = new File(['png'], 'logo.png', { type: 'image/png' });
    await user.upload(input, png);
    await waitFor(() => expect(api).toHaveBeenCalledWith('/api/schools/branding/logo', { method: 'PUT', body: png, token: 'token' }));
  });
});
