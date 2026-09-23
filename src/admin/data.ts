export type PublishStatus = 'published' | 'draft' | 'archived';
export type SubjectGroup = 'Revelation' | 'Practice' | 'Belief' | 'History' | 'Language' | 'Character';
export type Accent = 'rose' | 'olive' | 'plain';
export type LectureFormat = 'Audio' | 'Video';
export type LectureLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export type BookFormat = 'Translation' | 'Commentary' | 'Primer' | 'Classical';

export type LectureSourceType = 'youtube-video' | 'youtube-playlist';
export type BookSourceType = 'archive' | 'external' | 'google-books' | 'pdf';

// — New generic architecture: providers & content types —
// Source provider: where the file is hosted
export type SourceProvider = 'youtube' | 'archive' | 'external' | 'google-books' | 'pdf';
// Generic content type the admin assigns after detection
export type ArchiveContentType = 'lecture' | 'book' | 'audio' | 'video' | 'document';
// Raw Archive.org kind as detected from metadata
export type ArchiveItemKind = 'audio' | 'video' | 'book' | 'document' | 'collection' | 'unknown';

export interface AdminLecture {
  id: string;
  title: string;
  youtubeUrl: string; // kept for backwards compat — for youtube provider this is the canonical url, for archive provider may be empty and sourceUrl used
  sourceType?: LectureSourceType;
  // new generic provider fields
  provider?: SourceProvider;
  sourceUrl?: string;
  archiveIdentifier?: string;
  mediaTypes?: string[];
  scholarId: string;
  scholarIds?: string[];
  subjectIds: string[];
  description: string;
  series: string;
  format: LectureFormat;
  level: LectureLevel;
  durationMin: number;
  episodes: number;
  status: PublishStatus;
  updatedAt: string;
  thumbnailUrl?: string;
  coverUrl?: string;
  language?: string;
  tags?: string[];
}

export interface AdminBook {
  id: string;
  title: string;
  archiveUrl: string;
  sourceUrl?: string;
  sourceType?: BookSourceType;
  provider?: SourceProvider;
  archiveIdentifier?: string;
  mediaTypes?: string[];
  scholarId: string;
  scholarIds?: string[];
  subjectIds: string[];
  description: string;
  format: BookFormat;
  pages: number;
  year: number;
  status: PublishStatus;
  updatedAt: string;
  coverUrl?: string;
  publisher?: string;
  language?: string;
  isbn?: string;
  tags?: string[];
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

export const lectureSourceOptions: { value: LectureSourceType; label: string; hint: string }[] = [
  { value: 'youtube-video', label: 'YouTube · Single video', hint: 'One talk, one khutbah, one lesson' },
  { value: 'youtube-playlist', label: 'YouTube · Full playlist', hint: 'A course or series collected as a playlist' },
];

export const bookSourceOptions: { value: BookSourceType; label: string; hint: string }[] = [
  { value: 'archive', label: 'Archive.org', hint: 'Scanned manuscript or published edition on archive.org' },
  { value: 'external', label: 'External document', hint: 'Publisher site, PDF, or other hosted document' },
  { value: 'google-books', label: 'Google Books', hint: 'Preview or full view on books.google.com' },
  { value: 'pdf', label: 'Direct PDF', hint: 'A direct .pdf link hosted elsewhere' },
];

// New generic provider options (for lectures now that archive is generic)
export const lectureProviderOptions: { value: SourceProvider; label: string; hint: string }[] = [
  { value: 'youtube', label: 'YouTube', hint: 'Single video or playlist — remains fully supported' },
  { value: 'archive', label: 'Archive.org', hint: 'Audio, video, document or collection — bulk-capable' },
  { value: 'external', label: 'External URL', hint: 'Other hosted audio/video' },
];

export const archiveContentTypeOptions: { value: ArchiveContentType; label: string; hint: string }[] = [
  { value: 'lecture', label: 'Lecture', hint: 'A taught session — audio or video' },
  { value: 'audio', label: 'Audio', hint: 'Audio recording / recitation' },
  { value: 'video', label: 'Video', hint: 'Video recording' },
  { value: 'book', label: 'Book', hint: 'Text edition / manuscript' },
  { value: 'document', label: 'Document', hint: 'PDF / article / document' },
];

// — Archive.org generic bulk-import types —

export interface ArchiveDetectedItem {
  identifier: string;
  archiveUrl: string;
  embedUrl: string;
  title: string;
  kind: ArchiveItemKind;
  mediaTypes: string[]; // e.g. ['MP3', 'Ogg Vorbis', 'MPEG4']
  thumbnail?: string;
  creator?: string;
  date?: string;
  year?: number;
  language?: string;
  description?: string;
  collection?: string;
  subjectHint?: string;
  duration?: string;
  size?: string;
  publisher?: string;
}

export interface ArchiveCollectionResult {
  sourceUrl: string;
  identifier: string;
  title: string;
  description?: string;
  totalItems: number;
  items: ArchiveDetectedItem[];
  fetchedAt: string;
  isCollection: boolean;
  isSingleItem: boolean;
  provider: 'archive';
  kindsSummary: Record<string, number>;
}

export interface ArchiveImportDraft {
  detected: ArchiveDetectedItem;
  selected: boolean;
  customTitle: string;
  customDescription: string;
  contentType: ArchiveContentType;
  scholarIds: string[];
  subjectIds: string[];
  language: string;
  series: string;
  category: string;
  status: PublishStatus | 'skip';
}

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
  { id: 'l1', title: 'Opening the Qurʾān: Sūrat al-Fātiḥah', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', sourceType: 'youtube-video', provider: 'youtube', sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', scholarId: 's1', scholarIds: ['s1'], subjectIds: ['tafsir'], description: 'A slow reading of the Opening, with vocabulary, context and the classical commentaries.', series: 'Tafsīr Foundations', format: 'Video', level: 'Beginner', durationMin: 42, episodes: 6, status: 'published', updatedAt: '12 Apr 2026', thumbnailUrl: 'https://images.unsplash.com/photo-1585036156171-71be93a86cee?w=640&q=80', language: 'Arabic / English', tags: ['tafsir', 'fatiha'] },
  { id: 'l2', title: 'The Forty Hadith of al-Nawawī — Explained', youtubeUrl: 'https://www.youtube.com/playlist?list=PLQ5aNFhB5PJ6p9F0Y8jX8x8x8x8x8x8x8x', sourceType: 'youtube-playlist', provider: 'youtube', sourceUrl: 'https://www.youtube.com/playlist?list=PLQ5aNFhB5PJ6p9F0Y8jX8x8x8x8x8x8x8x8x', scholarId: 's2', scholarIds: ['s2'], subjectIds: ['hadith', 'ethics'], description: 'Each narration read, sourced and applied — a complete pass through the forty.', series: 'Hadith Circles', format: 'Video', level: 'Beginner', durationMin: 28, episodes: 40, status: 'published', updatedAt: '11 Apr 2026', thumbnailUrl: 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=640&q=80', language: 'English', tags: ['hadith', 'nawawi'] },
  { id: 'l3', title: 'Purification & Prayer in the Four Schools', youtubeUrl: 'https://youtu.be/9bZkp7q19f0', sourceType: 'youtube-video', provider: 'youtube', sourceUrl: 'https://youtu.be/9bZkp7q19f0', scholarId: 's3', scholarIds: ['s3'], subjectIds: ['fiqh'], description: 'A comparative walk through ṭahārah and ṣalāh, noting where the schools differ and why.', series: 'Fiqh of Worship', format: 'Audio', level: 'Intermediate', durationMin: 51, episodes: 12, status: 'published', updatedAt: '9 Apr 2026', thumbnailUrl: '', language: 'English', tags: ['fiqh'] },
  { id: 'l4', title: 'The Stations of the Heart', youtubeUrl: 'https://www.youtube.com/watch?v=ilmTazk04', sourceType: 'youtube-video', provider: 'youtube', sourceUrl: 'https://www.youtube.com/watch?v=ilmTazk04', scholarId: 's4', scholarIds: ['s4'], subjectIds: ['tazkiyah'], description: 'On repentance, patience and sincerity, drawn from the classical inward sciences.', series: 'Inward Sciences', format: 'Video', level: 'Intermediate', durationMin: 36, episodes: 8, status: 'published', updatedAt: '7 Apr 2026', language: 'English', tags: ['tazkiyah'] },
  { id: 'l5', title: 'The Rightly Guided Caliphs', youtubeUrl: 'https://www.youtube.com/playlist?list=PLs8yP1Q6d9v9v9v9v9v9v9v9v9v9v9v9', sourceType: 'youtube-playlist', provider: 'youtube', sourceUrl: 'https://www.youtube.com/playlist?list=PLs8yP1Q6d9v9v9v9v9v9v9v9v9v9v9v9', scholarId: 's5', scholarIds: ['s5'], subjectIds: ['history', 'sirah'], description: 'The first four caliphs through early chroniclers, without later polemic.', series: 'Caliphate Narratives', format: 'Audio', level: 'Beginner', durationMin: 47, episodes: 10, status: 'published', updatedAt: '5 Apr 2026', language: 'English', tags: ['history', 'khulafa'] },
  { id: 'l6', title: 'Creed of al-Ṭaḥāwī — Verse by Verse', youtubeUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', sourceType: 'youtube-video', provider: 'youtube', sourceUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', scholarId: 's6', scholarIds: ['s6'], subjectIds: ['aqidah'], description: 'A complete reading of the Ṭaḥāwī creed with notes on disputed phrases.', series: 'The Creeds', format: 'Video', level: 'Advanced', durationMin: 39, episodes: 9, status: 'published', updatedAt: '2 Apr 2026', language: 'English / Arabic', tags: ['aqidah'] },
  // Archive.org generic examples — lecture/audio from archive
  { id: 'l14', title: 'Qurʾān Recitation — Jumuʿah Reflection (Archive Audio)', youtubeUrl: '', provider: 'archive', sourceUrl: 'https://archive.org/details/ilmnet-jumuah-reflection-042', archiveIdentifier: 'ilmnet-jumuah-reflection-042', mediaTypes: ['MP3', 'Ogg Vorbis'], scholarId: 's1', scholarIds: ['s1'], subjectIds: ['tafsir', 'ethics'], description: 'Friday reflection recorded at the community centre — sourced from Archive.org audio collection.', series: 'Friday Reminders', format: 'Audio', level: 'Beginner', durationMin: 28, episodes: 1, status: 'published', updatedAt: '16 Apr 2026', thumbnailUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=640&q=80', language: 'English', tags: ['archive', 'audio'] },
  { id: 'l15', title: 'Uṣūl al-Fiqh — Class 07 (Archive Video)', youtubeUrl: '', provider: 'archive', sourceUrl: 'https://archive.org/details/ilmnet-usul-class07', archiveIdentifier: 'ilmnet-usul-class07', mediaTypes: ['512Kb MPEG4', 'h.264'], scholarId: 's3', scholarIds: ['s3'], subjectIds: ['usul', 'fiqh'], description: 'Classroom video from the Archive.org movies collection — whiteboard and discussion.', series: 'Uṣūl Classes', format: 'Video', level: 'Advanced', durationMin: 64, episodes: 1, status: 'draft', updatedAt: '16 Apr 2026', thumbnailUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=640&q=80', language: 'English / Arabic', tags: ['archive', 'video'] },
  { id: 'l7', title: 'Arabic Grammar Through the Qurʾān', youtubeUrl: 'https://www.youtube.com/playlist?list=PLQot0F3oR7xO8x8x8x8x8x8x8x8x8x8', sourceType: 'youtube-playlist', provider: 'youtube', sourceUrl: 'https://www.youtube.com/playlist?list=PLQot0F3oR7xO8x8x8x8x8x8x8x8x8', scholarId: 's7', scholarIds: ['s7'], subjectIds: ['arabic', 'tafsir'], description: 'Iʿrāb taught from living verses rather than isolated drills.', series: 'Grammar Path', format: 'Video', level: 'Beginner', durationMin: 22, episodes: 24, status: 'published', updatedAt: '30 Mar 2026', language: 'Arabic', tags: ['nahw', 'grammar'] },
  { id: 'l8', title: 'The Sealed Nectar: A Sīrah Walkthrough', youtubeUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', sourceType: 'youtube-video', provider: 'youtube', sourceUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', scholarId: 's8', scholarIds: ['s8'], subjectIds: ['sirah'], description: 'A chronological reading of the biography, pausing on character and decision.', series: 'The Life', format: 'Audio', level: 'Beginner', durationMin: 44, episodes: 15, status: 'published', updatedAt: '28 Mar 2026', language: 'English', tags: ['sirah'] },
  { id: 'l9', title: 'Commercial Contracts & the Modern Market', youtubeUrl: 'https://www.youtube.com/watch?v=60ItHLz5WEA', sourceType: 'youtube-video', provider: 'youtube', sourceUrl: 'https://www.youtube.com/watch?v=60ItHLz5WEA', scholarId: 's3', scholarIds: ['s3', 's6'], subjectIds: ['society', 'fiqh'], description: 'Sale, partnership and debt as they meet contemporary financial instruments.', series: 'Fiqh of Transactions', format: 'Audio', level: 'Advanced', durationMin: 55, episodes: 7, status: 'published', updatedAt: '21 Mar 2026', language: 'English', tags: ['muamalat'] },
  { id: 'l10', title: 'Adab of Disagreement', youtubeUrl: 'https://www.youtube.com/watch?v=KYniUCGPGLs', sourceType: 'youtube-video', provider: 'youtube', sourceUrl: 'https://www.youtube.com/watch?v=KYniUCGPGLs', scholarId: 's6', scholarIds: ['s6'], subjectIds: ['ethics'], description: 'How the early scholars differed — and how they stayed together.', series: 'Ethics', format: 'Video', level: 'Intermediate', durationMin: 31, episodes: 5, status: 'published', updatedAt: '18 Mar 2026', language: 'English', tags: ['adab'] },
  { id: 'l11', title: 'The Principles of Jurisprudence', youtubeUrl: 'https://www.youtube.com/watch?v=ilmUsul11', sourceType: 'youtube-video', provider: 'youtube', sourceUrl: 'https://www.youtube.com/watch?v=ilmUsul11', scholarId: 's3', scholarIds: ['s3'], subjectIds: ['usul'], description: 'Sources, indications and the method of derivation, taught as a working craft.', series: 'Uṣūl', format: 'Audio', level: 'Advanced', durationMin: 49, episodes: 11, status: 'draft', updatedAt: '14 Apr 2026', language: 'Arabic / English', tags: ['usul'] },
  { id: 'l12', title: 'Tafsīr of Sūrat Yā-Sīn', youtubeUrl: 'https://www.youtube.com/watch?v=ilmYasin12', sourceType: 'youtube-video', provider: 'youtube', sourceUrl: 'https://www.youtube.com/watch?v=ilmYasin12', scholarId: 's1', scholarIds: ['s1'], subjectIds: ['tafsir'], description: 'A complete tafsīr of Yā-Sīn, verse by verse, with linguistic notes.', series: 'Tafsīr Foundations', format: 'Audio', level: 'Intermediate', durationMin: 58, episodes: 4, status: 'published', updatedAt: '12 Apr 2026', language: 'Arabic', tags: ['yasin'] },
  { id: 'l13', title: 'The Ethics of Speech', youtubeUrl: 'https://www.youtube.com/playlist?list=PL5Q5X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8', sourceType: 'youtube-playlist', provider: 'youtube', sourceUrl: 'https://www.youtube.com/playlist?list=PL5Q5X8X8X8X8X8X8X8X8X8X8X8X8', scholarId: 's4', scholarIds: ['s4'], subjectIds: ['ethics', 'tazkiyah'], description: 'On backbiting, counsel and silence — a short series still being assembled.', series: 'Inward Sciences', format: 'Video', level: 'Beginner', durationMin: 24, episodes: 3, status: 'draft', updatedAt: '13 Apr 2026', language: 'English', tags: ['ethics'] },
];

export const seedBooks: AdminBook[] = [
  { id: 'b1', title: 'The Removal of Doubts', archiveUrl: 'https://archive.org/details/ilmnet-removal-of-doubts', sourceUrl: 'https://archive.org/details/ilmnet-removal-of-doubts', sourceType: 'archive', provider: 'archive', archiveIdentifier: 'ilmnet-removal-of-doubts', scholarId: 's1', scholarIds: ['s1'], subjectIds: ['aqidah'], description: 'A line-by-line commentary on a classical creedal poem for the modern reader.', format: 'Commentary', pages: 214, year: 2021, status: 'published', updatedAt: '10 Apr 2026', coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80', publisher: 'ilmNet Editions', language: 'English', isbn: '978-0-00-000001-1' },
  { id: 'b2', title: 'Gardens of the Righteous', archiveUrl: 'https://archive.org/details/ilmnet-riyad-salihin', sourceUrl: 'https://archive.org/details/ilmnet-riyad-salihin', sourceType: 'archive', provider: 'archive', archiveIdentifier: 'ilmnet-riyad-salihin', scholarId: 's2', scholarIds: ['s2'], subjectIds: ['hadith', 'ethics'], description: 'A fresh, annotated translation of Riyaḍ al-Ṣāliḥīn with context for each hadith.', format: 'Translation', pages: 388, year: 2019, status: 'published', updatedAt: '6 Apr 2026', coverUrl: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&q=80', publisher: 'Dar al-Kutub', language: 'Arabic / English', isbn: '978-0-00-000002-2' },
  { id: 'b3', title: 'A Primer on Prayer', archiveUrl: 'https://archive.org/details/ilmnet-primer-prayer', sourceUrl: 'https://archive.org/details/ilmnet-primer-prayer', sourceType: 'archive', provider: 'archive', archiveIdentifier: 'ilmnet-primer-prayer', scholarId: 's3', scholarIds: ['s3'], subjectIds: ['fiqh'], description: 'The essentials of worship, plainly set out for the newcomer.', format: 'Primer', pages: 96, year: 2023, status: 'published', updatedAt: '4 Apr 2026', coverUrl: '', publisher: 'ilmNet Press', language: 'English', isbn: '978-0-00-000003-3' },
  { id: 'b4', title: 'The Polished Mirror', archiveUrl: 'https://archive.org/details/ilmnet-polished-mirror', sourceUrl: 'https://archive.org/details/ilmnet-polished-mirror', sourceType: 'archive', provider: 'archive', archiveIdentifier: 'ilmnet-polished-mirror', scholarId: 's4', scholarIds: ['s4'], subjectIds: ['tazkiyah'], description: 'A restored edition of a beloved treatise on the heart’s purification.', format: 'Classical', pages: 172, year: 2018, status: 'published', updatedAt: '1 Apr 2026', coverUrl: '', publisher: 'Heritage Library', language: 'English', isbn: '' },
  { id: 'b5', title: 'Caliphs & Cities', archiveUrl: 'https://archive.org/details/ilmnet-caliphs-cities', sourceUrl: 'https://archive.org/details/ilmnet-caliphs-cities', sourceType: 'archive', provider: 'archive', archiveIdentifier: 'ilmnet-caliphs-cities', scholarId: 's5', scholarIds: ['s5'], subjectIds: ['history'], description: 'A translation of early chroniclers, with maps and a reader guide.', format: 'Translation', pages: 432, year: 2020, status: 'published', updatedAt: '22 Mar 2026', coverUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80', publisher: 'Cambridge', language: 'English', isbn: '978-0-00-000005-5' },
  { id: 'b6', title: 'Grammar of the Revelation', archiveUrl: 'https://archive.org/details/ilmnet-grammar-revelation', sourceUrl: 'https://archive.org/details/ilmnet-grammar-revelation', sourceType: 'archive', provider: 'archive', archiveIdentifier: 'ilmnet-grammar-revelation', scholarId: 's7', scholarIds: ['s7'], subjectIds: ['arabic'], description: 'A workbook that teaches Arabic through Qurʾānic sentences.', format: 'Primer', pages: 264, year: 2022, status: 'published', updatedAt: '18 Mar 2026', coverUrl: '', publisher: 'Bayyinah', language: 'English / Arabic', isbn: '' },
  { id: 'b7', title: 'The Noble Biography', archiveUrl: 'https://archive.org/details/ilmnet-noble-biography', sourceUrl: 'https://archive.org/details/ilmnet-noble-biography', sourceType: 'archive', provider: 'archive', archiveIdentifier: 'ilmnet-noble-biography', scholarId: 's8', scholarIds: ['s8'], subjectIds: ['sirah'], description: 'A thematic commentary that turns biography into a practical manual.', format: 'Commentary', pages: 356, year: 2021, status: 'published', updatedAt: '11 Mar 2026', coverUrl: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&q=80', publisher: 'Darussalam', language: 'English', isbn: '' },
  { id: 'b8', title: 'Foundations of Fiqh', archiveUrl: 'https://archive.org/details/ilmnet-foundations-fiqh', sourceUrl: 'https://archive.org/details/ilmnet-foundations-fiqh', sourceType: 'archive', provider: 'archive', archiveIdentifier: 'ilmnet-foundations-fiqh', scholarId: 's3', scholarIds: ['s3'], subjectIds: ['usul'], description: 'A restored matn on juristic method, with a contemporary gloss.', format: 'Classical', pages: 298, year: 2017, status: 'published', updatedAt: '2 Mar 2026', coverUrl: '', publisher: 'ilmNet', language: 'Arabic', isbn: '' },
  { id: 'b9', title: 'The Ethics of Company', archiveUrl: 'https://archive.org/details/ilmnet-ethics-company', sourceUrl: 'https://archive.org/details/ilmnet-ethics-company', sourceType: 'archive', provider: 'archive', archiveIdentifier: 'ilmnet-ethics-company', scholarId: 's6', scholarIds: ['s6'], subjectIds: ['ethics'], description: 'On friendship, speech and the manners of daily life.', format: 'Primer', pages: 128, year: 2024, status: 'published', updatedAt: '24 Feb 2026', coverUrl: '', publisher: 'ilmNet', language: 'English', isbn: '' },
  { id: 'b10', title: 'Marriage & the Household', archiveUrl: 'https://archive.org/details/ilmnet-marriage-household', sourceUrl: 'https://archive.org/details/ilmnet-marriage-household', sourceType: 'external', provider: 'external', scholarId: 's3', scholarIds: ['s3'], subjectIds: ['society', 'fiqh'], description: 'A sourced guide to family life drawn from the four schools.', format: 'Commentary', pages: 241, year: 2022, status: 'draft', updatedAt: '14 Apr 2026', coverUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&q=80', publisher: 'External — publisher site', language: 'English', isbn: '' },
  { id: 'b11', title: 'Mukhtaṣar al-Qudūrī (Arabic Edition)', archiveUrl: 'https://books.google.com/books?id=quduri_mukhtasar_example', sourceUrl: 'https://books.google.com/books?id=quduri_mukhtasar_example', sourceType: 'google-books', provider: 'google-books', scholarId: 's3', scholarIds: ['s3'], subjectIds: ['fiqh'], description: 'The Ḥanafī primer as published on Google Books — preview embedded.', format: 'Classical', pages: 320, year: 2018, status: 'published', updatedAt: '9 Apr 2026', coverUrl: '', publisher: 'Google Books', language: 'Arabic', isbn: '978-0-00-000011-1' },
  { id: 'b12', title: 'Al-Adhkār — PDF Edition', archiveUrl: 'https://example.com/books/al-adhkar.pdf', sourceUrl: 'https://example.com/books/al-adhkar.pdf', sourceType: 'pdf', provider: 'pdf', scholarId: 's2', scholarIds: ['s2', 's4'], subjectIds: ['ethics', 'hadith'], description: 'Direct PDF hosted by the publisher, embedded for preview.', format: 'Classical', pages: 412, year: 2020, status: 'draft', updatedAt: '15 Apr 2026', coverUrl: 'https://images.unsplash.com/photo-1476275466078-40035611d34e?w=400&q=80', publisher: 'External PDF', language: 'Arabic / English', isbn: '' },
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

// — URL helpers —

export function isYoutubeUrl(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host === 'youtube.com' || host === 'youtu.be' || host.endsWith('.youtube.com');
  } catch {
    return false;
  }
}

export function isYoutubePlaylistUrl(url: string) {
  try {
    const u = new URL(url);
    return u.searchParams.has('list');
  } catch {
    return false;
  }
}

export function isYoutubeVideoUrl(url: string) {
  try {
    if (!isYoutubeUrl(url)) return false;
    const u = new URL(url);
    if (u.hostname.replace(/^www\./, '') === 'youtu.be') return true;
    if (u.searchParams.has('v')) return true;
    if (u.pathname.startsWith('/embed/')) return true;
    if (u.pathname.startsWith('/shorts/')) return true;
    if (u.pathname.includes('/playlist') && u.searchParams.has('list') && !u.searchParams.has('v')) return false;
    return !isYoutubePlaylistUrl(url) || u.searchParams.has('v');
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

export function isGoogleBooksUrl(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host === 'books.google.com' || host.endsWith('.google.com');
  } catch {
    return false;
  }
}

export function isPdfUrl(url: string) {
  try {
    const u = new URL(url);
    return u.pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return url.trim().toLowerCase().endsWith('.pdf');
  }
}

export function isExternalBookUrl(url: string) {
  if (!url.trim()) return false;
  try {
    const u = new URL(url);
    return ['http:', 'https:'].includes(u.protocol);
  } catch {
    return false;
  }
}

export function detectLectureSource(url: string): LectureSourceType | null {
  if (!isYoutubeUrl(url)) return null;
  return isYoutubePlaylistUrl(url) && !new URL(url).searchParams.has('v') ? 'youtube-playlist' : 'youtube-video';
}

export function detectBookSource(url: string): BookSourceType | null {
  if (!url.trim()) return null;
  if (isArchiveUrl(url)) return 'archive';
  if (isGoogleBooksUrl(url)) return 'google-books';
  if (isPdfUrl(url)) return 'pdf';
  if (isExternalBookUrl(url)) return 'external';
  return null;
}

export function detectProvider(url: string): SourceProvider | null {
  if (isYoutubeUrl(url)) return 'youtube';
  if (isArchiveUrl(url)) return 'archive';
  if (!url.trim()) return null;
  try {
    const u = new URL(url);
    if (['http:', 'https:'].includes(u.protocol)) return 'external';
  } catch {}
  return null;
}

// Embed URL builders
export function getYoutubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      if (!id) return null;
      const list = u.searchParams.get('list');
      if (list) return `https://www.youtube.com/embed/${id}?list=${list}`;
      return `https://www.youtube.com/embed/${id}`;
    }
    const v = u.searchParams.get('v');
    const list = u.searchParams.get('list');
    if (u.pathname.startsWith('/embed/')) {
      return url;
    }
    if (u.pathname.startsWith('/shorts/')) {
      const id = u.pathname.split('/')[2];
      return `https://www.youtube.com/embed/${id}`;
    }
    if (u.pathname.includes('/playlist') && list && !v) {
      return `https://www.youtube.com/embed/videoseries?list=${list}`;
    }
    if (v) {
      if (list) return `https://www.youtube.com/embed/${v}?list=${list}`;
      return `https://www.youtube.com/embed/${v}`;
    }
    if (list) {
      return `https://www.youtube.com/embed/videoseries?list=${list}`;
    }
    return null;
  } catch {
    return null;
  }
}

export function getArchiveEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!isArchiveUrl(url)) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('details');
    if (idx !== -1 && parts[idx + 1]) {
      return `https://archive.org/embed/${parts[idx + 1]}`;
    }
    if (parts.length === 1) {
      return `https://archive.org/embed/${parts[0]}`;
    }
    if (parts[0] === 'embed') return url;
    return null;
  } catch {
    return null;
  }
}

export function getGoogleBooksEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const id = u.searchParams.get('id');
    if (!id) return null;
    return `https://books.google.com/books?id=${id}&printsec=frontcover&hl=en`;
  } catch {
    return null;
  }
}

export function getBookEmbedUrl(url: string, type: BookSourceType | null): string | null {
  if (!url.trim()) return null;
  const t = type ?? detectBookSource(url);
  if (t === 'archive') return getArchiveEmbedUrl(url);
  if (t === 'google-books') return getGoogleBooksEmbedUrl(url);
  if (t === 'pdf') return url;
  return null;
}

export function youtubeThumbnail(url: string): string | null {
  try {
    const embed = getYoutubeEmbedUrl(url);
    if (!embed) return null;
    const idMatch = embed.match(/\/embed\/([^?]+)/);
    if (idMatch?.[1] && idMatch[1] !== 'videoseries') {
      return `https://img.youtube.com/vi/${idMatch[1]}/hqdefault.jpg`;
    }
    return null;
  } catch {
    return null;
  }
}

// — Generic Archive.org helpers —

export function parseArchiveIdentifier(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (!isArchiveUrl(url)) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    // /details/<id>
    const idx = parts.indexOf('details');
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
    // /embed/<id>
    if (parts[0] === 'embed' && parts[1]) return parts[1];
    // /search.php?query=...
    if (u.pathname.includes('search')) return u.searchParams.get('query')?.split(' ')[0] ?? null;
    // single segment like /details/
    if (parts.length === 1) return parts[0];
    // collection like /details/<collection>/...
    return parts[0] ?? null;
  } catch {
    return null;
  }
}

export function archiveItemLink(identifier: string): string {
  return `https://archive.org/details/${identifier}`;
}

export function archiveEmbedLink(identifier: string): string {
  return `https://archive.org/embed/${identifier}`;
}

export function inferArchiveItemKind(mediaTypes: string[]): ArchiveItemKind {
  const s = mediaTypes.join(' ').toLowerCase();
  if (s.includes('mp3') || s.includes('ogg') || s.includes('flac') || s.includes('audio')) return 'audio';
  if (s.includes('mpeg4') || s.includes('h.264') || s.includes('video') || s.includes('mp4')) return 'video';
  if (s.includes('pdf') || s.includes('djvu') || s.includes('text')) return 'book';
  if (s.includes('collection')) return 'collection';
  return 'unknown';
}

export function inferContentTypeFromKind(kind: ArchiveItemKind): ArchiveContentType {
  if (kind === 'audio') return 'audio';
  if (kind === 'video') return 'video';
  if (kind === 'book') return 'book';
  if (kind === 'collection') return 'lecture';
  return 'document';
}

// — Mock Archive.org collection generator (frontend-only, no backend) —
const MOCK_TITLES = [
  'Opening the Path — Introduction to Sincerity',
  'Kitāb al-Ṭahārah — Purification Explained',
  'The Forty Ḥadīth — Narration 12 & 13',
  'Sīrat al-Nabī — Early Years in Makkah',
  'Uṣūl al-Fiqh — Causes & Indications',
  'Tazkiyah Sessions — Stations of the Heart',
  'Arabic Morphology — The Ten Forms',
  'Fiqh of Fasting — Contemporary Issues',
  'History of Andalus — Fall & Lessons',
  'Adab al-ʿIlm — Manners of Seeking Knowledge',
  'Tafsīr Sūrah Yā-Sīn — Verse 1–12',
  'The Prophetic Household — Roles & Mercy',
  'Caliph ʿUmar — Governance & Justice',
  'Qurʾānic Grammar — Iʿrāb Workshop',
  'Ethics of Disagreement — Classical Models',
  'Inner Dimensions of Prayer',
  'Principles of Inheritance — Intro',
  'Voices of the Reciters — Melodic Study',
  'On Patience & Gratitude',
  'Life of Imam al-Shāfiʿī',
  'Foundations of Belief — Creed Primer',
  'Marriage & Compassion — Family Series',
  'The Seven Recitations — Overview',
  'Spiritual Stations — Tawbah & Zuhd',
];

const MOCK_CREATORS = [
  'Shaykh Usman Rahman',
  'Dr. Aisha Mahmoud',
  'Shaykh Ibrahim Nasser',
  'Ustadha Layla Hassan',
  'Dr. Yusuf Karim',
  'Shaykh Abdullah Said',
  'Ustadh Tariq Bashir',
  'Dr. Mariam Yusuf',
];

const MOCK_THUMBS = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
  'https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=400&q=80',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&q=80',
  'https://images.unsplash.com/photo-1476275466078-40035611d34e?w=400&q=80',
  'https://images.unsplash.com/photo-1585036156171-71be93a86cee?w=400&q=80',
  'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&q=80',
  'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80',
  'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&q=80',
];

function pseudoHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}


// ── YouTube bulk-import types (mirrors Archive but provider youtube) ──

export type YouTubeItemKind = 'video' | 'playlist' | 'unknown';

export interface YouTubeDetectedItem {
  identifier: string; // videoId
  youtubeUrl: string;
  embedUrl: string;
  title: string;
  kind: YouTubeItemKind;
  mediaTypes: string[];
  mediatype?: string;
  thumbnail?: string;
  creator?: string;
  channelId?: string;
  date?: string;
  year?: number;
  language?: string;
  description?: string;
  collection?: string; // playlistId if part of playlist
  subjectHint?: string;
  duration?: string; // e.g. "3:55" or "1:02:15"
  size?: string;
  publisher?: string;
  publishedAt?: string;
  channelTitle?: string;
}

export interface YouTubeCollectionResult {
  sourceUrl: string;
  identifier: string; // videoId or playlistId
  title: string;
  description?: string;
  totalItems: number;
  items: YouTubeDetectedItem[];
  fetchedAt: string;
  isCollection: boolean;
  isSingleItem: boolean;
  provider: 'youtube';
  kindsSummary: Record<string, number>;
  collectionTitle?: string;
  channelTitle?: string;
}

export interface YouTubeImportDraft {
  detected: YouTubeDetectedItem;
  selected: boolean;
  customTitle: string;
  customDescription: string;
  contentType: ArchiveContentType; // reuse generic types: video/audio/lecture etc
  scholarIds: string[];
  subjectIds: string[];
  language: string;
  series: string;
  category: string;
  status: PublishStatus | 'skip';
}

// Helper for youtube URL helpers already defined above — also expose parse helpers
export function parseYouTubeIdentifier(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    const playlistId = u.searchParams.get('list');
    if (playlistId) return playlistId;
    if (host === 'youtu.be') {
      const parts = u.pathname.split('/').filter(Boolean);
      return parts[0] || null;
    }
    const v = u.searchParams.get('v');
    if (v) return v;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] === 'shorts' && parts[1]) return parts[1];
    if (parts[0] === 'embed' && parts[1]) return parts[1].split('?')[0];
    return null;
  } catch { return null; }
}

export function getYouTubeEmbedUrl(url: string): string | null {
  const id = parseYouTubeIdentifier(url);
  if (!id) return null;
  try {
    const u = new URL(url);
    if (u.searchParams.has('list') && !u.searchParams.has('v')) {
      const list = u.searchParams.get('list');
      return `https://www.youtube.com/embed/videoseries?list=${list}`;
    }
  } catch {}
  // individual video embed
  // Detect playlist vs video by param
  if (url.includes('playlist?list=') || url.includes('&list=')) {
    // for preview display, we still use playlist embed for collection?
    try {
      const u2 = new URL(url);
      const list = u2.searchParams.get('list');
      const v = u2.searchParams.get('v');
      if (list && !v) return `https://www.youtube.com/embed/videoseries?list=${list}`;
      if (v) return `https://www.youtube.com/embed/${v}`;
    } catch {}
  }
  // fallback single
  return `https://www.youtube.com/embed/${id}`;
}

export function mockFetchArchiveCollection(sourceUrl: string, desiredCount?: number): ArchiveCollectionResult {
  const cleaned = sourceUrl.trim();
  const identifier = parseArchiveIdentifier(cleaned) || `ilmnet-mock-${Math.abs(pseudoHash(cleaned)).toString(36).slice(0, 6)}`;
  const hash = pseudoHash(cleaned + identifier);
  // Decide count: if url explicitly asks for 100 via ?count=100 or contains 100, respect; else hash to 12/24/48/100
  let count = desiredCount ?? 24;
  if (cleaned.includes('100')) count = 100;
  else if (cleaned.includes('48')) count = 48;
  else if (cleaned.includes('12')) count = 12;
  else {
    const opts = [12, 24, 18, 36, 48, 100];
    count = opts[hash % opts.length]!;
  }
  // Allow override via hash param like #count=100 or ?n=100
  try {
    const u = new URL(cleaned);
    const qp = u.searchParams.get('count') || u.searchParams.get('n');
    if (qp) {
      const n = parseInt(qp, 10);
      if (!isNaN(n) && n > 0 && n <= 300) count = n;
    }
  } catch {}

  const isSingle = count === 1 || cleaned.match(/\/details\/[^/]+\/?$/) && !cleaned.includes('search') && !cleaned.includes('collection') && hash % 7 === 0;
  const finalCount = isSingle ? 1 : count;

  const kinds: ArchiveItemKind[] = ['audio', 'video', 'book', 'document'];
  const mediaPools: Record<ArchiveItemKind, string[][]> = {
    audio: [['MP3', 'Ogg Vorbis'], ['MP3', 'Flac'], ['MP3'], ['Ogg Vorbis', 'MP3', 'Shorten']],
    video: [['512Kb MPEG4', 'h.264'], ['MPEG4', 'Ogg Video'], ['h.264', '512Kb MPEG4', 'Ogg Video']],
    book: [['PDF', 'DjVu', 'Text'], ['PDF', 'EPUB'], ['DjVu', 'PDF']],
    document: [['PDF'], ['Text', 'PDF'], ['DjVu']],
    collection: [['collection']],
    unknown: [['MP3']],
  };

  const items: ArchiveDetectedItem[] = Array.from({ length: finalCount }).map((_, i) => {
    const itemHash = pseudoHash(identifier + String(i));
    const kind = kinds[itemHash % kinds.length]!;
    const mediaTypes = mediaPools[kind]![itemHash % mediaPools[kind]!.length]!;
    const titleBase = MOCK_TITLES[itemHash % MOCK_TITLES.length]!;
    const creator = MOCK_CREATORS[itemHash % MOCK_CREATORS.length]!;
    const thumb = MOCK_THUMBS[itemHash % MOCK_THUMBS.length]!;
    const itemId = `${identifier}-${String(i + 1).padStart(3, '0')}`;
    const langPool = ['English', 'Arabic', 'English / Arabic', 'Urdu'];
    const language = langPool[itemHash % langPool.length]!;
    const year = 2015 + (itemHash % 10);
    const duration = kind === 'audio' || kind === 'video' ? `${28 + (itemHash % 52)}:${String(itemHash % 60).padStart(2, '0')}` : undefined;
    const size = `${(5 + (itemHash % 180))}.${itemHash % 10} MB`;
    return {
      identifier: itemId,
      archiveUrl: archiveItemLink(itemId),
      embedUrl: archiveEmbedLink(itemId),
      title: finalCount === 1 ? `Collection: ${identifier} — ${titleBase}` : `${titleBase} — Part ${String(i + 1).padStart(2, '0')}`,
      kind,
      mediaTypes,
      thumbnail: kind === 'book' || kind === 'document' ? thumb : thumb,
      creator,
      date: `${String((itemHash % 28) + 1).padStart(2, '0')}-${String((itemHash % 12) + 1).padStart(2, '0')}-${year}`,
      year,
      language,
      description:
        kind === 'audio'
          ? `Audio recording of ${titleBase.toLowerCase()} by ${creator} — sourced from the Archive.org audio collection. Duration ${duration}, available as ${mediaTypes.join(', ')}.`
          : kind === 'video'
            ? `Video session of ${titleBase.toLowerCase()} — whiteboard and discussion, hosted on Archive.org movies.`
            : `Text edition for ${titleBase.toLowerCase()} — scan and OCR available on Archive.org. Pages variable, language ${language}.`,
      collection: identifier,
      subjectHint: ['tafsir', 'hadith', 'fiqh', 'aqidah', 'sirah', 'arabic', 'tazkiyah'][itemHash % 7]!,
      duration,
      size,
      publisher: kind === 'book' || kind === 'document' ? 'Archive.org scan — external publisher' : undefined,
    };
  });

  // If single item, make it a proper single record rather than part 001
  if (finalCount === 1) {
    const single = items[0]!;
    single.identifier = identifier;
    single.archiveUrl = archiveItemLink(identifier);
    single.embedUrl = archiveEmbedLink(identifier);
    single.title = `Archive Item — ${identifier.replace(/[-_]/g, ' ')}`;
    single.collection = identifier;
  }

  const kindsSummary: Record<string, number> = {};
  for (const it of items) kindsSummary[it.kind] = (kindsSummary[it.kind] ?? 0) + 1;

  return {
    sourceUrl: cleaned,
    identifier,
    title: finalCount === 1 ? `Archive.org item — ${identifier}` : `Archive.org collection — ${identifier}`,
    description: finalCount === 1 ? 'Single item detected. You can import it as any content type.' : `Collection containing ${finalCount} items of mixed media — audio, video and texts — detected from Archive.org metadata. Select which to import; each becomes its own ilmNet record.`,
    totalItems: finalCount,
    items,
    fetchedAt: todayStamp(),
    isCollection: finalCount > 1,
    isSingleItem: finalCount === 1,
    provider: 'archive',
    kindsSummary,
  };
}
