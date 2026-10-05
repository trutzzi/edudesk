import { describe, expect, it } from 'vitest';
import { hourWindow } from './time';

describe('hourWindow', () => {
  it('defaults to the school day and grows to fit lessons', () => {
    expect(hourWindow([])).toEqual({ startHour: 8, endHour: 15 });
    expect(hourWindow([{ startTime: '07:30', endTime: '17:10' }])).toEqual({ startHour: 7, endHour: 18 });
  });
});
