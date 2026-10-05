// Times of day as "HH:MM" strings

export const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

// The hours a week or day view needs: the school day by default, wider when lessons fall outside it
export function hourWindow(times: { startTime: string; endTime: string }[]) {
  const starts = times.map(({ startTime }) => Math.floor(toMinutes(startTime) / 60));
  const ends = times.map(({ endTime }) => Math.ceil(toMinutes(endTime) / 60));
  return { startHour: Math.min(8, ...starts), endHour: Math.max(15, ...ends) };
}
