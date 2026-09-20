export type PublishStatus = 'published' | 'draft';
export type SubjectGroup = 'Revelation' | 'Practice' | 'Belief' | 'History' | 'Language' | 'Character';
export type Accent = 'rose' | 'olive' | 'plain';
export type LectureFormat = 'Audio' | 'Video';
export type LectureLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export type BookFormat = 'Translation' | 'Commentary' | 'Primer' | 'Classical';

export interface AdminLecture {
  id: string;
  title: string;
  youtubeUrl: string;
  scholarId: string;
  subjectIds: string[];
  description: string;
  series: string;
  format: LectureFormat;
  level: LectureLevel;
  durationMin: number;
  episodes: number;
  status: PublishStatus;
  updatedAt: string;
}

export interface AdminBook {
  id: string;
  title: string;
  archiveUrl: string;
  scholarId: string;
  subjectIds: string[];
  description: string;
  format: BookFormat;
  pages: number;
  year: number;
  status: PublishStatus;
  updatedAt: string;
}

export interface AdminScholar {
  id: string;
  name: string;
  initials: string;
  specialtyId: string;
  bio: string;
  accent: 'rose' | 'olive';
  status: PublishStatus;
  updatedAt: string;
}

export interface AdminSubject {
  id: string;
  name: string;
  group: SubjectGroup;
  description: string;
  accent: Accent;
  status: PublishStatus;
  updatedAt: string;
}

export interface Activity {
  id: string;
  at: string;
  verb: 'Added' | 'Updated' | 'Published' | 'Unpublished' | 'Removed';
  kind: 'lecture' | 'book' | 'scholar' | 'subject';
  title: string;
}

export const subjectGroups: SubjectGroup[] = ['Revelation', 'Belief', 'Practice', 'History', 'Language', 'Character'];
export const lectureFormats: LectureFormat[] = ['Audio', 'Video'];
export const lectureLevels: LectureLevel[] = ['Beginner', 'Intermediate', 'Advanced'];
export const bookFormats: BookFormat[] = ['Translation', 'Commentary', 'Primer', 'Classical'];

export const seedSubjects: AdminSubject[] = [
  { id: 'tafsir', name: "Qur'ān & Tafsīr", group: 'Revelation', description: 'Reading the Book with its classical and contemporary commentaries.', accent: 'rose', status: 'published', updatedAt: '2 Apr 2026' },
  { id: 'hadith', name: 'Ḥadīth', group: 'Revelation', description: 'The recorded words and example of the Prophet ﷺ, studied by chain and meaning.', accent: 'plain', status: 'published', updatedAt: '2 Apr 2026' },
  { id: 'aqidah', name: 'ʿAqīdah', group: 'Belief', description: 'The foundations of belief, from the early creeds to systematic theology.', accent: 'plain', status: 'published', updatedAt: '28 Mar 2026' },
  { id: 'fiqh', name: 'Fiqh', group: 'Practice', description: 'Jurisprudence across the schools — worship, transactions and family.', accent: 'olive', status: 'published', updatedAt: '28 Mar 2026' },
  { id: 'sirah', name: 'Sīrah', group: 'History', description: 'The life of the Prophet ﷺ as the template for a lived Islam.', accent: 'plain', status: 'published', updatedAt: '20 Mar 2026' },
  { id: 'arabic', name: 'Arabic Language', group: 'Language', description: 'Grammar, morphology and vocabulary to meet the sources directly.', accent: 'plain', status: 'published', updatedAt: '20 Mar 2026' },
  { id: 'usul', name: 'Uṣūl al-Fiqh', group: 'Practice', description: 'The methodology by which juristic judgement is derived.', accent: 'plain', status: 'published', updatedAt: '12 Mar 2026' },
  { id: 'tazkiyah', name: 'Tazkiyah', group: 'Character', description: 'Purification of the heart and the cultivation of inward states.', accent: 'olive', status: 'published', updatedAt: '12 Mar 2026' },
  { id: 'history', name: 'Islamic History', group: 'History', description: 'From the caliphates to the modern era, through reliable narration.', accent: 'plain', status: 'published', updatedAt: '4 Mar 2026' },
  { id: 'ethics', name: 'Ethics & Adab', group: 'Character', description: 'Conduct, manners and the character of the believer.', accent: 'plain', status: 'published', updatedAt: '4 Mar 2026' },
  { id: 'society', name: 'Family & Society', group: 'Practice', description: 'Marriage, community and the ethics of public life.', accent: 'plain', status: 'published', updatedAt: '1 Mar 2026' },
];

export const seedScholars: AdminScholar[] = [
  { id: 's1', name: 'Shaykh Usman Rahman', initials: 'UR', specialtyId: 'tafsir', bio: 'Known for unhurried, verse-by-verse Qurʾān sessions rooted in the early commentators.', accent: 'rose', status: 'published', updatedAt: '8 Apr 2026' },
  { id: 's2', name: 'Dr. Aisha Mahmoud', initials: 'AM', specialtyId: 'hadith', bio: 'Specialist in the six canonical collections and the science of chains.', accent: 'olive', status: 'published', updatedAt: '8 Apr 2026' },
  { id: 's3', name: 'Shaykh Ibrahim Nasser', initials: 'IN', specialtyId: 'fiqh', bio: 'Teaches comparative fiqh with a focus on everyday worship and contracts.', accent: 'olive', status: 'published', updatedAt: '1 Apr 2026' },
  { id: 's4', name: 'Ustadha Layla Hassan', initials: 'LH', specialtyId: 'tazkiyah', bio: 'Guides readers through the classical texts of the inward sciences.', accent: 'rose', status: 'published', updatedAt: '1 Apr 2026' },
  { id: 's5', name: 'Dr. Yusuf Karim', initials: 'YK', specialtyId: 'history', bio: 'Recovers the narrative of the caliphates from primary sources.', accent: 'olive', status: 'published', updatedAt: '22 Mar 2026' },
  { id: 's6', name: 'Shaykh Abdullah Said', initials: 'AS', specialtyId: 'aqidah', bio: 'Presents the creedal positions with measured, sourced clarity.', accent: 'olive', status: 'published', updatedAt: '22 Mar 2026' },
  { id: 's7', name: 'Ustadh Tariq Bashir', initials: 'TB', specialtyId: 'arabic', bio: 'Builds reading fluency from the grammar up, one pattern at a time.', accent: 'rose', status: 'published', updatedAt: '14 Mar 2026' },
  { id: 's8', name: 'Dr. Mariam Yusuf', initials: 'MY', specialtyId: 'sirah', bio: 'Weaves the biography into a coherent path of character and action.', accent: 'olive', status: 'published', updatedAt: '14 Mar 2026' },
];

export const seedLectures: AdminLecture[] = [
  { id: 'l1', title: 'Opening the Qurʾān: Sūrat al-Fātiḥah', youtubeUrl: 'https://www.youtube.com/watch?v=ilmFatihah01', scholarId: 's1', subjectIds: ['tafsir'], description: 'A slow reading of the Opening, with vocabulary, context and the classical commentaries.', series: 'Tafsīr Foundations', format: 'Audio', level: 'Beginner', durationMin: 42, episodes: 6, status: 'published', updatedAt: '12 Apr 2026' },
  { id: 'l2', title: 'The Forty Hadith of al-Nawawī — Explained', youtubeUrl: 'https://www.youtube.com/watch?v=ilmNawawi40', scholarId: 's2', subjectIds: ['hadith', 'ethics'], description: 'Each narration read, sourced and applied — a complete pass through the forty.', series: 'Hadith Circles', format: 'Video', level: 'Beginner', durationMin: 28, episodes: 40, status: 'published', updatedAt: '11 Apr 2026' },
  { id: 'l3', title: 'Purification & Prayer in the Four Schools', youtubeUrl: 'https://www.youtube.com/watch?v=ilmFiqhW01', scholarId: 's3', subjectIds: ['fiqh'], description: 'A comparative walk through ṭahārah and ṣalāh, noting where the schools differ and why.', series: 'Fiqh of Worship', format: 'Audio', level: 'Intermediate', durationMin: 51, episodes: 12, status: 'published', updatedAt: '9 Apr 2026' },
  { id: 'l4', title: 'The Stations of the Heart', youtubeUrl: 'https://www.youtube.com/watch?v=ilmTazk04', scholarId: 's4', subjectIds: ['tazkiyah'], description: 'On repentance, patience and sincerity, drawn from the classical inward sciences.', series: 'Inward Sciences', format: 'Video', level: 'Intermediate', durationMin: 36, episodes: 8, status: 'published', updatedAt: '7 Apr 2026' },
  { id: 'l5', title: 'The Rightly Guided Caliphs', youtubeUrl: 'https://www.youtube.com/watch?v=ilmKhulafa', scholarId: 's5', subjectIds: ['history', 'sirah'], description: 'The first four caliphs through early chroniclers, without later polemic.', series: 'Caliphate Narratives', format: 'Audio', level: 'Beginner', durationMin: 47, episodes: 10, status: 'published', updatedAt: '5 Apr 2026' },
  { id: 'l6', title: 'Creed of al-Ṭaḥāwī — Verse by Verse', youtubeUrl: 'https://www.youtube.com/watch?v=ilmTahawi', scholarId: 's6', subjectIds: ['aqidah'], description: 'A complete reading of the Ṭaḥāwī creed with notes on disputed phrases.', series: 'The Creeds', format: 'Video', level: 'Advanced', durationMin: 39, episodes: 9, status: 'published', updatedAt: '2 Apr 2026' },
  { id: 'l7', title: 'Arabic Grammar Through the Qurʾān', youtubeUrl: 'https://www.youtube.com/watch?v=ilmNahw01', scholarId: 's7', subjectIds: ['arabic', 'tafsir'], description: 'Iʿrāb taught from living verses rather than isolated drills.', series: 'Grammar Path', format: 'Video', level: 'Beginner', durationMin: 22, episodes: 24, status: 'published', updatedAt: '30 Mar 2026' },
  { id: 'l8', title: 'The Sealed Nectar: A Sīrah Walkthrough', youtubeUrl: 'https://www.youtube.com/watch?v=ilmSirah08', scholarId: 's8', subjectIds: ['sirah'], description: 'A chronological reading of the biography, pausing on character and decision.', series: 'The Life', format: 'Audio', level: 'Beginner', durationMin: 44, episodes: 15, status: 'published', updatedAt: '28 Mar 2026' },
  { id: 'l9', title: 'Commercial Contracts & the Modern Market', youtubeUrl: 'https://www.youtube.com/watch?v=ilmMuamalat', scholarId: 's3', subjectIds: ['society', 'fiqh'], description: 'Sale, partnership and debt as they meet contemporary financial instruments.', series: 'Fiqh of Transactions', format: 'Audio', level: 'Advanced', durationMin: 55, episodes: 7, status: 'published', updatedAt: '21 Mar 2026' },
  { id: 'l10', title: 'Adab of Disagreement', youtubeUrl: 'https://www.youtube.com/watch?v=ilmAdab10', scholarId: 's6', subjectIds: ['ethics'], description: 'How the early scholars differed — and how they stayed together.', series: 'Ethics', format: 'Video', level: 'Intermediate', durationMin: 31, episodes: 5, status: 'published', updatedAt: '18 Mar 2026' },
  { id: 'l11', title: 'The Principles of Jurisprudence', youtubeUrl: 'https://www.youtube.com/watch?v=ilmUsul11', scholarId: 's3', subjectIds: ['usul'], description: 'Sources, indications and the method of derivation, taught as a working craft.', series: 'Uṣūl', format: 'Audio', level: 'Advanced', durationMin: 49, episodes: 11, status: 'draft', updatedAt: '14 Apr 2026' },
  { id: 'l12', title: 'Tafsīr of Sūrat Yā-Sīn', youtubeUrl: 'https://www.youtube.com/watch?v=ilmYasin12', scholarId: 's1', subjectIds: ['tafsir'], description: 'A complete tafsīr of Yā-Sīn, verse by verse, with linguistic notes.', series: 'Tafsīr Foundations', format: 'Audio', level: 'Intermediate', durationMin: 58, episodes: 4, status: 'published', updatedAt: '12 Apr 2026' },
  { id: 'l13', title: 'The Ethics of Speech', youtubeUrl: 'https://www.youtube.com/watch?v=ilmSpeech13', scholarId: 's4', subjectIds: ['ethics', 'tazkiyah'], description: 'On backbiting, counsel and silence — a short series still being assembled.', series: 'Inward Sciences', format: 'Video', level: 'Beginner', durationMin: 24, episodes: 3, status: 'draft', updatedAt: '13 Apr 2026' },
];

export const seedBooks: AdminBook[] = [
  { id: 'b1', title: 'The Removal of Doubts', archiveUrl: 'https://archive.org/details/ilmnet-removal-of-doubts', scholarId: 's1', subjectIds: ['aqidah'], description: 'A line-by-line commentary on a classical creedal poem for the modern reader.', format: 'Commentary', pages: 214, year: 2021, status: 'published', updatedAt: '10 Apr 2026' },
  { id: 'b2', title: 'Gardens of the Righteous', archiveUrl: 'https://archive.org/details/ilmnet-riyad-salihin', scholarId: 's2', subjectIds: ['hadith', 'ethics'], description: 'A fresh, annotated translation of Riyaḍ al-Ṣāliḥīn with context for each hadith.', format: 'Translation', pages: 388, year: 2019, status: 'published', updatedAt: '6 Apr 2026' },
  { id: 'b3', title: 'A Primer on Prayer', archiveUrl: 'https://archive.org/details/ilmnet-primer-prayer', scholarId: 's3', subjectIds: ['fiqh'], description: 'The essentials of worship, plainly set out for the newcomer.', format: 'Primer', pages: 96, year: 2023, status: 'published', updatedAt: '4 Apr 2026' },
  { id: 'b4', title: 'The Polished Mirror', archiveUrl: 'https://archive.org/details/ilmnet-polished-mirror', scholarId: 's4', subjectIds: ['tazkiyah'], description: 'A restored edition of a beloved treatise on the heart’s purification.', format: 'Classical', pages: 172, year: 2018, status: 'published', updatedAt: '1 Apr 2026' },
  { id: 'b5', title: 'Caliphs & Cities', archiveUrl: 'https://archive.org/details/ilmnet-caliphs-cities', scholarId: 's5', subjectIds: ['history'], description: 'A translation of early chroniclers, with maps and a reader guide.', format: 'Translation', pages: 432, year: 2020, status: 'published', updatedAt: '22 Mar 2026' },
  { id: 'b6', title: 'Grammar of the Revelation', archiveUrl: 'https://archive.org/details/ilmnet-grammar-revelation', scholarId: 's7', subjectIds: ['arabic'], description: 'A workbook that teaches Arabic through Qurʾānic sentences.', format: 'Primer', pages: 264, year: 2022, status: 'published', updatedAt: '18 Mar 2026' },
  { id: 'b7', title: 'The Noble Biography', archiveUrl: 'https://archive.org/details/ilmnet-noble-biography', scholarId: 's8', subjectIds: ['sirah'], description: 'A thematic commentary that turns biography into a practical manual.', format: 'Commentary', pages: 356, year: 2021, status: 'published', updatedAt: '11 Mar 2026' },
  { id: 'b8', title: 'Foundations of Fiqh', archiveUrl: 'https://archive.org/details/ilmnet-foundations-fiqh', scholarId: 's3', subjectIds: ['usul'], description: 'A restored matn on juristic method, with a contemporary gloss.', format: 'Classical', pages: 298, year: 2017, status: 'published', updatedAt: '2 Mar 2026' },
  { id: 'b9', title: 'The Ethics of Company', archiveUrl: 'https://archive.org/details/ilmnet-ethics-company', scholarId: 's6', subjectIds: ['ethics'], description: 'On friendship, speech and the manners of daily life.', format: 'Primer', pages: 128, year: 2024, status: 'published', updatedAt: '24 Feb 2026' },
  { id: 'b10', title: 'Marriage & the Household', archiveUrl: 'https://archive.org/details/ilmnet-marriage-household', scholarId: 's3', subjectIds: ['society', 'fiqh'], description: 'A sourced guide to family life drawn from the four schools.', format: 'Commentary', pages: 241, year: 2022, status: 'draft', updatedAt: '14 Apr 2026' },
];

export const seedActivity: Activity[] = [
  { id: 'a1', at: '14 Apr 2026', verb: 'Updated', kind: 'lecture', title: 'The Principles of Jurisprudence' },
  { id: 'a2', at: '14 Apr 2026', verb: 'Added', kind: 'book', title: 'Marriage & the Household' },
  { id: 'a3', at: '13 Apr 2026', verb: 'Added', kind: 'lecture', title: 'The Ethics of Speech' },
  { id: 'a4', at: '12 Apr 2026', verb: 'Published', kind: 'lecture', title: 'Tafsīr of Sūrat Yā-Sīn' },
  { id: 'a5', at: '11 Apr 2026', verb: 'Published', kind: 'lecture', title: 'The Forty Hadith of al-Nawawī — Explained' },
  { id: 'a6', at: '10 Apr 2026', verb: 'Updated', kind: 'book', title: 'The Removal of Doubts' },
  { id: 'a7', at: '8 Apr 2026', verb: 'Updated', kind: 'scholar', title: 'Shaykh Usman Rahman' },
];

export function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export function todayStamp() {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '•';
  const skip = new Set(['shaykh', 'shaykha', 'dr.', 'dr', 'ustadh', 'ustadha', 'imam']);
  const core = parts.filter((p) => !skip.has(p.toLowerCase()));
  const use = (core.length ? core : parts).slice(0, 2);
  return use.map((w) => w[0]!.toUpperCase()).join('');
}

export function isYoutubeUrl(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host === 'youtube.com' || host === 'youtu.be' || host.endsWith('.youtube.com');
  } catch {
    return false;
  }
}

export function isArchiveUrl(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host === 'archive.org' || host.endsWith('.archive.org');
  } catch {
    return false;
  }
}


