// Realistic placeholder content for demonstrating ilmNet layouts.
// No backend, no auth — purely presentational.

export type SubjectGroup = 'Revelation' | 'Practice' | 'Belief' | 'History' | 'Language' | 'Character';

export interface Subject {
  id: string;
  name: string;
  group: SubjectGroup;
  description: string;
  lectureCount: number;
  bookCount: number;
  accent: 'rose' | 'olive' | 'plain';
}

export interface Lecture {
  id: string;
  title: string;
  scholar: string;
  scholarId: string;
  subjectId: string;
  format: 'Audio' | 'Video';
  series: string;
  episodes: number;
  durationMin: number;
  plays: number;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
}

export interface Book {
  id: string;
  title: string;
  author: string;
  subjectId: string;
  format: 'Translation' | 'Commentary' | 'Primer' | 'Classical';
  pages: number;
  year: number;
  description: string;
}

export interface Scholar {
  id: string;
  name: string;
  initials: string;
  specialtyId: string;
  lectureCount: number;
  bookCount: number;
  bio: string;
  accent: 'rose' | 'olive';
}

export const subjects: Subject[] = [
  { id: 'tafsir', name: "Qur'ān & Tafsīr", group: 'Revelation', description: 'Reading the Book with its classical and contemporary commentaries.', lectureCount: 122, bookCount: 41, accent: 'rose' },
  { id: 'hadith', name: 'Ḥadīth', group: 'Revelation', description: 'The recorded words and example of the Prophet ﷺ, studied by chain and meaning.', lectureCount: 160, bookCount: 53, accent: 'plain' },
  { id: 'aqidah', name: 'ʿAqīdah', group: 'Belief', description: 'The foundations of belief, from the early creeds to systematic theology.', lectureCount: 78, bookCount: 29, accent: 'plain' },
  { id: 'fiqh', name: 'Fiqh', group: 'Practice', description: 'Jurisprudence across the schools — worship, transactions and family.', lectureCount: 214, bookCount: 67, accent: 'olive' },
  { id: 'sirah', name: 'Sīrah', group: 'History', description: 'The life of the Prophet ﷺ as the template for a lived Islam.', lectureCount: 54, bookCount: 22, accent: 'plain' },
  { id: 'arabic', name: 'Arabic Language', group: 'Language', description: 'Grammar, morphology and vocabulary to meet the sources directly.', lectureCount: 96, bookCount: 34, accent: 'plain' },
  { id: 'usul', name: 'Uṣūl al-Fiqh', group: 'Practice', description: 'The methodology by which juristic judgement is derived.', lectureCount: 38, bookCount: 15, accent: 'plain' },
  { id: 'tazkiyah', name: 'Tazkiyah', group: 'Character', description: 'Purification of the heart and the cultivation of inward states.', lectureCount: 71, bookCount: 28, accent: 'olive' },
  { id: 'history', name: 'Islamic History', group: 'History', description: 'From the caliphates to the modern era, through reliable narration.', lectureCount: 88, bookCount: 40, accent: 'plain' },
  { id: 'ethics', name: 'Ethics & Adab', group: 'Character', description: 'Conduct, manners and the character of the believer.', lectureCount: 45, bookCount: 19, accent: 'plain' },
  { id: 'society', name: 'Family & Society', group: 'Practice', description: 'Marriage, community and the ethics of public life.', lectureCount: 52, bookCount: 21, accent: 'plain' },
];

export const subjectGroups: SubjectGroup[] = ['Revelation', 'Belief', 'Practice', 'History', 'Language', 'Character'];

export const scholars: Scholar[] = [
  { id: 's1', name: 'Shaykh Usman Rahman', initials: 'UR', specialtyId: 'tafsir', lectureCount: 64, bookCount: 9, bio: 'Known for unhurried, verse-by-verse Qurʾān sessions rooted in the early commentators.', accent: 'rose' },
  { id: 's2', name: 'Dr. Aisha Mahmoud', initials: 'AM', specialtyId: 'hadith', lectureCount: 51, bookCount: 12, bio: 'Specialist in the six canonical collections and the science of chains.', accent: 'olive' },
  { id: 's3', name: 'Shaykh Ibrahim Nasser', initials: 'IN', specialtyId: 'fiqh', lectureCount: 78, bookCount: 15, bio: 'Teaches comparative fiqh with a focus on everyday worship and contracts.', accent: 'olive' },
  { id: 's4', name: 'Ustadha Layla Hassan', initials: 'LH', specialtyId: 'tazkiyah', lectureCount: 39, bookCount: 7, bio: 'Guides readers through the classical texts of the inward sciences.', accent: 'rose' },
  { id: 's5', name: 'Dr. Yusuf Karim', initials: 'YK', specialtyId: 'history', lectureCount: 44, bookCount: 11, bio: 'Recovers the narrative of the caliphates from primary sources.', accent: 'olive' },
  { id: 's6', name: 'Shaykh Abdullah Said', initials: 'AS', specialtyId: 'aqidah', lectureCount: 36, bookCount: 8, bio: 'Presents the creedal positions with measured, sourced clarity.', accent: 'olive' },
  { id: 's7', name: 'Ustadh Tariq Bashir', initials: 'TB', specialtyId: 'arabic', lectureCount: 58, bookCount: 6, bio: 'Builds reading fluency from the grammar up, one pattern at a time.', accent: 'rose' },
  { id: 's8', name: 'Dr. Mariam Yusuf', initials: 'MY', specialtyId: 'sirah', lectureCount: 33, bookCount: 9, bio: 'Weaves the biography into a coherent path of character and action.', accent: 'olive' },
];

export const lectures: Lecture[] = [
  { id: 'l1', title: 'Opening the Qurʾān: Sūrat al-Fātiḥah', scholar: 'Shaykh Usman Rahman', scholarId: 's1', subjectId: 'tafsir', format: 'Audio', series: 'Tafsīr Foundations', episodes: 6, durationMin: 42, plays: 18420, level: 'Beginner' },
  { id: 'l2', title: 'The Forty Hadith of al-Nawawī — Explained', scholar: 'Dr. Aisha Mahmoud', scholarId: 's2', subjectId: 'hadith', format: 'Video', series: 'Hadith Circles', episodes: 40, durationMin: 28, plays: 24110, level: 'Beginner' },
  { id: 'l3', title: 'Purification & Prayer in the Four Schools', scholar: 'Shaykh Ibrahim Nasser', scholarId: 's3', subjectId: 'fiqh', format: 'Audio', series: 'Fiqh of Worship', episodes: 12, durationMin: 51, plays: 12980, level: 'Intermediate' },
  { id: 'l4', title: 'The Stations of the Heart', scholar: 'Ustadha Layla Hassan', scholarId: 's4', subjectId: 'tazkiyah', format: 'Video', series: 'Inward Sciences', episodes: 8, durationMin: 36, plays: 9630, level: 'Intermediate' },
  { id: 'l5', title: 'The Rightly Guided Caliphs', scholar: 'Dr. Yusuf Karim', scholarId: 's5', subjectId: 'history', format: 'Audio', series: 'Caliphate Narratives', episodes: 10, durationMin: 47, plays: 14150, level: 'Beginner' },
  { id: 'l6', title: 'Creed of al-Ṭaḥāwī — Verse by Verse', scholar: 'Shaykh Abdullah Said', scholarId: 's6', subjectId: 'aqidah', format: 'Video', series: 'The Creeds', episodes: 9, durationMin: 39, plays: 8070, level: 'Advanced' },
  { id: 'l7', title: 'Arabic Grammar Through the Qurʾān', scholar: 'Ustadh Tariq Bashir', scholarId: 's7', subjectId: 'arabic', format: 'Video', series: 'Grammar Path', episodes: 24, durationMin: 22, plays: 17440, level: 'Beginner' },
  { id: 'l8', title: 'The Sealed Nectar: A Sīrah Walkthrough', scholar: 'Dr. Mariam Yusuf', scholarId: 's8', subjectId: 'sirah', format: 'Audio', series: 'The Life', episodes: 15, durationMin: 44, plays: 11260, level: 'Beginner' },
  { id: 'l9', title: 'Commercial Contracts & the Modern Market', scholar: 'Shaykh Ibrahim Nasser', scholarId: 's3', subjectId: 'society', format: 'Audio', series: 'Fiqh of Transactions', episodes: 7, durationMin: 55, plays: 6420, level: 'Advanced' },
  { id: 'l10', title: 'Adab of Disagreement', scholar: 'Shaykh Abdullah Said', scholarId: 's6', subjectId: 'ethics', format: 'Video', series: 'Ethics', episodes: 5, durationMin: 31, plays: 7390, level: 'Intermediate' },
  { id: 'l11', title: 'The Principles of Jurisprudence', scholar: 'Shaykh Ibrahim Nasser', scholarId: 's3', subjectId: 'usul', format: 'Audio', series: 'Uṣūl', episodes: 11, durationMin: 49, plays: 5210, level: 'Advanced' },
  { id: 'l12', title: 'Tafsīr of Sūrat Yā-Sīn', scholar: 'Shaykh Usman Rahman', scholarId: 's1', subjectId: 'tafsir', format: 'Audio', series: 'Tafsīr Foundations', episodes: 4, durationMin: 58, plays: 9980, level: 'Intermediate' },
];

export const books: Book[] = [
  { id: 'b1', title: 'The Removal of Doubts', author: 'Shaykh Usman Rahman', subjectId: 'aqidah', format: 'Commentary', pages: 214, year: 2021, description: 'A line-by-line commentary on a classical creedal poem for the modern reader.' },
  { id: 'b2', title: 'Gardens of the Righteous', author: 'Dr. Aisha Mahmoud', subjectId: 'hadith', format: 'Translation', pages: 388, year: 2019, description: 'A fresh, annotated translation of Riyaḍ al-Ṣāliḥīn with context for each hadith.' },
  { id: 'b3', title: 'A Primer on Prayer', author: 'Shaykh Ibrahim Nasser', subjectId: 'fiqh', format: 'Primer', pages: 96, year: 2023, description: 'The essentials of worship, plainly set out for the newcomer.' },
  { id: 'b4', title: 'The Polished Mirror', author: 'Ustadha Layla Hassan', subjectId: 'tazkiyah', format: 'Classical', pages: 172, year: 2018, description: 'A restored edition of a beloved treatise on the hearts purification.' },
  { id: 'b5', title: 'Caliphs & Cities', author: 'Dr. Yusuf Karim', subjectId: 'history', format: 'Translation', pages: 432, year: 2020, description: 'A translation of early chroniclers, with maps and a reader guide.' },
  { id: 'b6', title: 'Grammar of the Revelation', author: 'Ustadh Tariq Bashir', subjectId: 'arabic', format: 'Primer', pages: 264, year: 2022, description: 'A workbook that teaches Arabic through Qurʾānic sentences.' },
  { id: 'b7', title: 'The Noble Biography', author: 'Dr. Mariam Yusuf', subjectId: 'sirah', format: 'Commentary', pages: 356, year: 2021, description: 'A thematic commentary that turns biography into a practical manual.' },
  { id: 'b8', title: 'Foundations of Fiqh', author: 'Shaykh Ibrahim Nasser', subjectId: 'usul', format: 'Classical', pages: 298, year: 2017, description: 'A restored matn on juristic method, with a contemporary gloss.' },
  { id: 'b9', title: 'The Ethics of Company', author: 'Shaykh Abdullah Said', subjectId: 'ethics', format: 'Primer', pages: 128, year: 2024, description: 'On friendship, speech and the manners of daily life.' },
  { id: 'b10', title: 'Marriage & the Household', author: 'Shaykh Ibrahim Nasser', subjectId: 'society', format: 'Commentary', pages: 241, year: 2022, description: 'A sourced guide to family life drawn from the four schools.' },
];

export const subjectById = (id: string) => subjects.find((s) => s.id === id);
export const scholarById = (id: string) => scholars.find((s) => s.id === id);

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
