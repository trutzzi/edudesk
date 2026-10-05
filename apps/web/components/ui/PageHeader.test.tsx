import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('shows the title, the subtitle and any actions', () => {
    render(
      <PageHeader title="People" subtitle="Everyone in your school">
        <button type="button">Invite</button>
      </PageHeader>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'People' })).toBeInTheDocument();
    expect(screen.getByText('Everyone in your school')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Invite' })).toBeInTheDocument();
  });

  it('leaves the subtitle out when there is none', () => {
    const { container } = render(<PageHeader title="People" />);

    expect(container.querySelector('p')).toBeNull();
  });
});
