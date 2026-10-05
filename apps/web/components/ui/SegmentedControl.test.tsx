import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './SegmentedControl';

describe('SegmentedControl', () => {
  const segments = [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
  ] as const;

  it('marks the current segment and reports a change', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="View" segments={[...segments]} value="day" onChange={onChange} />);

    expect(screen.getByRole('group', { name: 'View' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Week' }));
    expect(onChange).toHaveBeenCalledWith('week');
  });

  it('does nothing when the current segment is clicked again', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="View" segments={[...segments]} value="day" onChange={onChange} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Day' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
