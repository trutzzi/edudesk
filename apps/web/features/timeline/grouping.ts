import { fullName, type Person } from '@/lib/people';
import { containsText } from '@/lib/text';

export type GroupBy = 'class' | 'teacher';

export interface TimelineItem {
  id: string;
  courseId: string;
  courseName: string;
  class: { id: string; name: string };
  teacher: Person;
  startDay: string;
  endDay: string;
  startTime?: string;
  endTime?: string;
  room?: string | null;
}

export interface TimelineRow {
  key: string;
  label: string;
  sublabel: string;
  items: TimelineItem[];
}

export interface TimelineGroup {
  key: string;
  label: string;
  colorKey: string;
  rows: TimelineRow[];
  items: TimelineItem[];
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

// Groups items into class (or teacher) groups, each with one row per course
export function groupItems(items: TimelineItem[], groupBy: GroupBy): TimelineGroup[] {
  const groups = new Map<string, TimelineGroup>();

  for (const item of items) {
    const byClass = groupBy === 'class';
    const groupKey = byClass ? item.class.id : item.teacher.id;
    let group = groups.get(groupKey);
    if (!group) {
      group = {
        key: groupKey,
        label: byClass ? item.class.name : fullName(item.teacher),
        colorKey: byClass ? item.class.id : item.teacher.id,
        rows: [],
        items: [],
      };
      groups.set(groupKey, group);
    }
    group.items.push(item);

    let row = group.rows.find((r) => r.key === item.courseId);
    if (!row) {
      row = {
        key: item.courseId,
        label: item.courseName,
        sublabel: byClass ? fullName(item.teacher) : item.class.name,
        items: [],
      };
      group.rows.push(row);
    }
    row.items.push(item);
  }

  const sorted = [...groups.values()].sort((a, b) => collator.compare(a.label, b.label));
  for (const group of sorted) {
    group.rows.sort((a, b) => collator.compare(a.label, b.label) || collator.compare(a.sublabel, b.sublabel));
  }
  return sorted;
}

export const matchesSearch = (item: TimelineItem, search: string) =>
  containsText(`${item.courseName} ${item.class.name} ${fullName(item.teacher)}`, search);
