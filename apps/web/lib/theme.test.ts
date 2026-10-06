import { describe, expect, it } from 'vitest';
import { applyBrandColor, brandShades } from './theme';

describe('brand color', () => {
  it('makes the whole scale from one color', () => {
    const shades = brandShades('#0ea5e9');

    expect(shades['--color-indigo-600']).toBe('#0ea5e9');
    expect(shades['--color-indigo-50']).toBe('color-mix(in oklab, #0ea5e9 8%, white)');
    expect(shades['--color-indigo-800']).toBe('color-mix(in oklab, #0ea5e9 70%, black)');
  });

  it('puts the shades on the page and takes them off again', () => {
    const root = document.createElement('div');

    applyBrandColor('#16a34a', root);
    expect(root.style.getPropertyValue('--color-indigo-600')).toBe('#16a34a');

    applyBrandColor(null, root);
    expect(root.style.getPropertyValue('--color-indigo-600')).toBe('');
  });
});
