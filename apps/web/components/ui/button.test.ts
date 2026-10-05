import { describe, expect, it } from 'vitest';
import { buttonClass } from './button';

describe('buttonClass', () => {
  it('defaults to a medium primary button', () => {
    const classes = buttonClass();

    expect(classes).toContain('bg-indigo-600');
    expect(classes).toContain('px-4 py-2 text-sm');
  });

  it('applies the requested variant and size', () => {
    const classes = buttonClass('secondary', 'lg');

    expect(classes).toContain('bg-white');
    expect(classes).toContain('px-8');
    expect(classes).not.toContain('bg-indigo-600');
  });

  it('has a quiet red variant for destructive actions', () => {
    expect(buttonClass('danger', 'sm')).toContain('text-red-600');
  });

  it('makes block buttons full width', () => {
    expect(buttonClass('primary', 'block')).toContain('w-full');
  });
});
