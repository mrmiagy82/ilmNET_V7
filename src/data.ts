// Shared public helpers. The site renders live library data from the API — nothing here invents
// content or statistics (Fase 3.9 removed the placeholder arrays that used to live in this file).

export type SubjectGroup = 'Revelation' | 'Practice' | 'Belief' | 'History' | 'Language' | 'Character';

export const subjectGroups: SubjectGroup[] = ['Revelation', 'Belief', 'Practice', 'History', 'Language', 'Character'];

export function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${n}`;
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
