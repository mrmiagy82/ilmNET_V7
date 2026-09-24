import { prisma } from './lib/prisma';
import { toSlug } from './utils/slug';

// — Subjects —
const subjectSeeds = [
  { name: "Qur'ān & Tafsīr", group: 'Revelation', description: 'Reading the Book with its classical and contemporary commentaries.', accent: 'rose' },
  { name: 'Ḥadīth', group: 'Revelation', description: 'The recorded words and example of the Prophet ﷺ, studied by chain and meaning.', accent: 'plain' },
  { name: 'ʿAqīdah', group: 'Belief', description: 'The foundations of belief, from the early creeds to systematic theology.', accent: 'plain' },
  { name: 'Fiqh', group: 'Practice', description: 'Jurisprudence across the schools — worship, transactions and family.', accent: 'olive' },
  { name: 'Sīrah', group: 'History', description: 'The life of the Prophet ﷺ as the template for a lived Islam.', accent: 'plain' },
  { name: 'Arabic Language', group: 'Language', description: 'Grammar, morphology and vocabulary to meet the sources directly.', accent: 'plain' },
  { name: 'Uṣūl al-Fiqh', group: 'Practice', description: 'The methodology by which juristic judgement is derived.', accent: 'plain' },
  { name: 'Tazkiyah', group: 'Character', description: 'Purification of the heart and the cultivation of inward states.', accent: 'olive' },
  { name: 'Islamic History', group: 'History', description: 'From the caliphates to the modern era, through reliable narration.', accent: 'plain' },
  { name: 'Ethics & Adab', group: 'Character', description: 'Conduct, manners and the character of the believer.', accent: 'plain' },
  { name: 'Family & Society', group: 'Practice', description: 'Marriage, community and the ethics of public life.', accent: 'plain' },
] as const;

// — Scholars —
const scholarSeeds = [
  { name: 'Shaykh Usman Rahman', initials: 'UR', specialty: "Qur'ān & Tafsīr", bio: 'Known for unhurried, verse-by-verse Qurʾān sessions rooted in the early commentators.', accent: 'rose' },
  { name: 'Dr. Aisha Mahmoud', initials: 'AM', specialty: 'Ḥadīth', bio: 'Specialist in the six canonical collections and the science of chains.', accent: 'olive' },
  { name: 'Shaykh Ibrahim Nasser', initials: 'IN', specialty: 'Fiqh', bio: 'Teaches comparative fiqh with a focus on everyday worship and contracts.', accent: 'olive' },
  { name: 'Ustadha Layla Hassan', initials: 'LH', specialty: 'Tazkiyah', bio: 'Guides readers through the classical texts of the inward sciences.', accent: 'rose' },
  { name: 'Dr. Yusuf Karim', initials: 'YK', specialty: 'Islamic History', bio: 'Recovers the narrative of the caliphates from primary sources.', accent: 'olive' },
  { name: 'Shaykh Abdullah Said', initials: 'AS', specialty: 'ʿAqīdah', bio: 'Presents the creedal positions with measured, sourced clarity.', accent: 'olive' },
  { name: 'Ustadh Tariq Bashir', initials: 'TB', specialty: 'Arabic Language', bio: 'Builds reading fluency from the grammar up, one pattern at a time.', accent: 'rose' },
  { name: 'Dr. Mariam Yusuf', initials: 'MY', specialty: 'Sīrah', bio: 'Weaves the biography into a coherent path of character and action.', accent: 'olive' },
];


/** Destructive: wipes the library. Only used by the demo seed (never in production by accident). */
async function resetDatabase() {
  // Clean in order (junction first)
  await prisma.contentSubject.deleteMany();
  await prisma.contentScholar.deleteMany();
  await prisma.content.deleteMany();
  await prisma.scholar.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.importJob.deleteMany();
}

type SeedMode = 'demo' | 'reference';

function seedMode(): SeedMode {
  return process.argv.includes('--reference') ? 'reference' : 'demo';
}

/**
 * Production-safe seed: upserts the reference data (subjects + scholars) and never touches
 * content. Safe to run on every deploy — a second run changes nothing.
 */
async function seedReference() {
  const subjectIdsByName = new Map<string, string>();
  for (const s of subjectSeeds) {
    const slug = toSlug(s.name);
    const data = {
      name: s.name,
      group: s.group as any,
      description: s.description,
      accent: s.accent,
      status: 'published' as const,
    };
    const subject = await prisma.subject.upsert({ where: { slug }, update: data, create: { slug, ...data } });
    subjectIdsByName.set(s.name, subject.id);
    console.log(`  ✓ Subject: ${subject.name}`);
  }

  for (const s of scholarSeeds) {
    const slug = toSlug(s.name);
    const data = {
      name: s.name,
      initials: s.initials,
      specialtyId: subjectIdsByName.get(s.specialty) ?? null,
      bio: s.bio,
      accent: s.accent,
      status: 'published' as const,
    };
    const scholar = await prisma.scholar.upsert({ where: { slug }, update: data, create: { slug, ...data } });
    console.log(`  ✓ Scholar: ${scholar.name}`);
  }

  const [subjects, scholars, contents] = await Promise.all([
    prisma.subject.count(),
    prisma.scholar.count(),
    prisma.content.count(),
  ]);
  console.log('✅ Reference seed complete — no content was touched');
  console.log(`  Subjects: ${subjects}, Scholars: ${scholars}, Contents: ${contents}`);
}

async function main() {
  const mode = seedMode();
  console.log(`🌱 Seeding ilmNet (generic Content model) — mode: ${mode}`);

  // The demo seed deletes everything first; that must never happen on a production database.
  if (mode === 'demo' && process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_RESET !== 'true') {
    console.error(
      'Refusing to run the destructive demo seed with NODE_ENV=production.\n' +
        '  • For a new deployment run:  npm run seed:reference   (adds subjects/scholars, keeps your content)\n' +
        '  • Only to wipe a production database on purpose:  SEED_ALLOW_RESET=true npm run seed',
    );
    process.exit(1);
  }

  if (mode === 'reference') {
    await seedReference();
    return;
  }

  await resetDatabase();

  const subjects: any[] = [];
  for (const s of subjectSeeds) {
    const slug = toSlug(s.name);
    const created = await prisma.subject.create({
      data: {
        slug,
        name: s.name,
        group: s.group as any,
        description: s.description,
        accent: s.accent,
        status: 'published',
      },
    });
    subjects.push(created);
    console.log(`  ✓ Subject: ${created.name} (${created.id})`);
  }

  const byName = (name: string) => subjects.find((s) => s.name === name)!.id;
  const byGroup = (group: string) => subjects.filter((s) => s.group === group).map((s) => s.id);

  const scholars: any[] = [];
  for (const s of scholarSeeds) {
    const slug = toSlug(s.name);
    const specialtyId = byName(s.specialty);
    const created = await prisma.scholar.create({
      data: {
        slug,
        name: s.name,
        initials: s.initials,
        specialtyId,
        bio: s.bio,
        accent: s.accent,
        status: 'published',
      },
    });
    scholars.push(created);
    console.log(`  ✓ Scholar: ${created.name}`);
  }

  const scholarByName = (name: string) => scholars.find((s) => s.name === name)!.id;

  // Helper to create content with relations
  async function createContent(input: {
    type: 'lecture' | 'audio' | 'video' | 'book' | 'document';
    title: string;
    description?: string;
    status?: 'draft' | 'published' | 'archived';
    language?: string;
    thumbnailUrl?: string | null;
    coverUrl?: string | null;
    series?: string | null;
    provider: 'youtube' | 'archive' | 'external' | 'google_books' | 'pdf';
    sourceUrl: string;
    externalIdentifier?: string | null;
    embedUrl?: string | null;
    collectionIdentifier?: string | null;
    collectionTitle?: string | null;
    durationMin?: number | null;
    episodes?: number | null;
    pages?: number | null;
    year?: number | null;
    metadata?: any;
    scholarIds: string[];
    subjectIds: string[];
  }) {
    const slug = toSlug(input.title) + '-' + Math.random().toString(36).slice(2, 6);
    const publishedAt = input.status === 'published' ? new Date() : null;
    // Build embedUrl if not provided
    let embedUrl = input.embedUrl;
    if (!embedUrl) {
      if (input.provider === 'youtube') {
        try {
          const u = new URL(input.sourceUrl);
          const v = u.searchParams.get('v');
          const list = u.searchParams.get('list');
          if (v) embedUrl = `https://www.youtube.com/embed/${v}${list ? `?list=${list}` : ''}`;
          else if (list) embedUrl = `https://www.youtube.com/embed/videoseries?list=${list}`;
          else if (u.hostname.includes('youtu.be')) {
            const id = u.pathname.slice(1).split('/')[0];
            embedUrl = `https://www.youtube.com/embed/${id}`;
          }
        } catch {}
      } else if (input.provider === 'archive' && input.externalIdentifier) {
        embedUrl = `https://archive.org/embed/${input.externalIdentifier}`;
      } else if (input.provider === 'google_books') {
        try {
          const u = new URL(input.sourceUrl);
          const id = u.searchParams.get('id');
          if (id) embedUrl = `https://books.google.com/books?id=${id}&printsec=frontcover&hl=en`;
        } catch {}
      } else if (input.provider === 'pdf') {
        embedUrl = input.sourceUrl;
      }
    }

    const content = await prisma.content.create({
      data: {
        type: input.type as any,
        title: input.title,
        slug,
        description: input.description || null,
        status: (input.status as any) || 'draft',
        language: input.language || null,
        thumbnailUrl: input.thumbnailUrl || null,
        coverUrl: input.coverUrl || null,
        series: input.series || null,
        provider: input.provider as any,
        sourceUrl: input.sourceUrl,
        externalIdentifier: input.externalIdentifier || null,
        embedUrl: embedUrl || null,
        collectionIdentifier: input.collectionIdentifier || null,
        collectionTitle: input.collectionTitle || null,
        durationMin: input.durationMin || null,
        episodes: input.episodes || null,
        pages: input.pages || null,
        year: input.year || null,
        publishedAt,
        metadata: input.metadata as any,
      },
    });

    if (input.scholarIds.length) {
      await prisma.contentScholar.createMany({
        data: input.scholarIds.map((sid) => ({ contentId: content.id, scholarId: sid })),
      });
    }
    if (input.subjectIds.length) {
      await prisma.contentSubject.createMany({
        data: input.subjectIds.map((sid) => ({ contentId: content.id, subjectId: sid })),
      });
    }

    return content;
  }

  // — Contents: mix of types & providers —

  // Lecture / video via YouTube (video)
  await createContent({
    type: 'lecture',
    title: 'Opening the Qurʾān: Sūrat al-Fātiḥah',
    description: 'A slow reading of the Opening, with vocabulary, context and the classical commentaries.',
    status: 'published',
    language: 'Arabic / English',
    thumbnailUrl: 'https://images.unsplash.com/photo-1585036156171-71be93a86cee?w=640&q=80',
    series: 'Tafsīr Foundations',
    provider: 'youtube',
    sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    externalIdentifier: 'dQw4w9WgXcQ',
    durationMin: 42,
    episodes: 6,
    scholarIds: [scholarByName('Shaykh Usman Rahman')],
    subjectIds: [byName("Qur'ān & Tafsīr")],
    metadata: { format: 'Video', level: 'Beginner' },
  });

  // Lecture via YouTube playlist
  await createContent({
    type: 'lecture',
    title: 'The Forty Hadith of al-Nawawī — Explained',
    description: 'Each narration read, sourced and applied — a complete pass through the forty.',
    status: 'published',
    language: 'English',
    thumbnailUrl: 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=640&q=80',
    series: 'Hadith Circles',
    provider: 'youtube',
    sourceUrl: 'https://www.youtube.com/playlist?list=PLQ5aNFhB5PJ6p9F0Y8jX8x8x8x8x8x8x8x8x',
    externalIdentifier: 'PLQ5aNFhB5PJ6p9F0Y8jX8x8x8x8x8x8x8x8x',
    collectionIdentifier: 'PLQ5aNFhB5PJ6p9F0Y8jX8x8x8x8x8x8x8x8x',
    collectionTitle: 'Hadith Circles',
    durationMin: 28,
    episodes: 40,
    scholarIds: [scholarByName('Dr. Aisha Mahmoud')],
    subjectIds: [byName('Ḥadīth'), byName('Ethics & Adab')],
    metadata: { format: 'Video', level: 'Beginner' },
  });

  // Audio via Archive.org (single)
  await createContent({
    type: 'audio',
    title: 'Qurʾān Recitation — Jumuʿah Reflection (Archive Audio)',
    description: 'Friday reflection recorded at the community centre — sourced from Archive.org audio collection.',
    status: 'published',
    language: 'English',
    thumbnailUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=640&q=80',
    series: 'Friday Reminders',
    provider: 'archive',
    sourceUrl: 'https://archive.org/details/ilmnet-jumuah-reflection-042',
    externalIdentifier: 'ilmnet-jumuah-reflection-042',
    collectionIdentifier: 'ilmnet-collection-demo',
    durationMin: 28,
    scholarIds: [scholarByName('Shaykh Usman Rahman')],
    subjectIds: [byName("Qur'ān & Tafsīr"), byName('Ethics & Adab')],
    metadata: {
      archive: {
        identifier: 'ilmnet-jumuah-reflection-042',
        collection: 'ilmnet-collection-demo',
        mediatype: 'audio',
        available_media: ['MP3', 'Ogg Vorbis'],
        creator: 'Shaykh Usman Rahman',
        duration: '28:15',
        year: 2024,
      },
    },
  });

  // Video via Archive.org
  await createContent({
    type: 'video',
    title: 'Uṣūl al-Fiqh — Class 07 (Archive Video)',
    description: 'Classroom video from the Archive.org movies collection — whiteboard and discussion.',
    status: 'draft',
    language: 'English / Arabic',
    thumbnailUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=640&q=80',
    series: 'Uṣūl Classes',
    provider: 'archive',
    sourceUrl: 'https://archive.org/details/ilmnet-usul-class07',
    externalIdentifier: 'ilmnet-usul-class07',
    durationMin: 64,
    scholarIds: [scholarByName('Shaykh Ibrahim Nasser')],
    subjectIds: [byName('Uṣūl al-Fiqh'), byName('Fiqh')],
    metadata: {
      archive: { mediatype: 'movies', available_media: ['512Kb MPEG4', 'h264'], creator: 'Shaykh Ibrahim Nasser', duration: '64:00' },
    },
  });

  // Book via Archive.org
  await createContent({
    type: 'book',
    title: 'The Removal of Doubts',
    description: 'A line-by-line commentary on a classical creedal poem for the modern reader.',
    status: 'published',
    language: 'English',
    coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80',
    provider: 'archive',
    sourceUrl: 'https://archive.org/details/ilmnet-removal-of-doubts',
    externalIdentifier: 'ilmnet-removal-of-doubts',
    pages: 214,
    year: 2021,
    scholarIds: [scholarByName('Shaykh Usman Rahman')],
    subjectIds: [byName('ʿAqīdah')],
    metadata: {
      archive: { mediatype: 'texts', available_media: ['PDF', 'DjVu', 'Text'], publisher: 'ilmNet Editions', year: 2021 },
      format: 'Commentary',
    },
  });

  await createContent({
    type: 'book',
    title: 'Gardens of the Righteous',
    description: 'A fresh, annotated translation of Riyaḍ al-Ṣāliḥīn with context for each hadith.',
    status: 'published',
    language: 'Arabic / English',
    coverUrl: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&q=80',
    provider: 'archive',
    sourceUrl: 'https://archive.org/details/ilmnet-riyad-salihin',
    externalIdentifier: 'ilmnet-riyad-salihin',
    pages: 388,
    year: 2019,
    scholarIds: [scholarByName('Dr. Aisha Mahmoud')],
    subjectIds: [byName('Ḥadīth'), byName('Ethics & Adab')],
    metadata: { format: 'Translation' },
  });

  // Document via external
  await createContent({
    type: 'document',
    title: 'The Ethics of Company — Article Collection',
    description: 'On friendship, speech and the manners of daily life. External publisher PDF.',
    status: 'draft',
    language: 'English',
    coverUrl: null,
    provider: 'external',
    sourceUrl: 'https://example.com/docs/ethics-company.pdf',
    externalIdentifier: null,
    pages: 42,
    year: 2023,
    scholarIds: [scholarByName('Shaykh Abdullah Said')],
    subjectIds: [byName('Ethics & Adab')],
    metadata: { publisher: 'External' },
  });

  // Book via google_books (underscore consistent)
  await createContent({
    type: 'book',
    title: 'Mukhtaṣar al-Qudūrī (Arabic Edition)',
    description: 'The Ḥanafī primer as published on Google Books — preview embedded.',
    status: 'published',
    language: 'Arabic',
    provider: 'google_books',
    sourceUrl: 'https://books.google.com/books?id=quduri_mukhtasar_example',
    externalIdentifier: 'quduri_mukhtasar_example',
    pages: 320,
    year: 2018,
    scholarIds: [scholarByName('Shaykh Ibrahim Nasser')],
    subjectIds: [byName('Fiqh')],
    metadata: { format: 'Classical' },
  });

  // Document via pdf
  await createContent({
    type: 'document',
    title: 'Al-Adhkār — PDF Edition',
    description: 'Direct PDF hosted by the publisher, embedded for preview.',
    status: 'published',
    language: 'Arabic / English',
    coverUrl: 'https://images.unsplash.com/photo-1476275466078-40035611d34e?w=400&q=80',
    provider: 'pdf',
    sourceUrl: 'https://example.com/books/al-adhkar.pdf',
    pages: 412,
    year: 2020,
    scholarIds: [scholarByName('Dr. Aisha Mahmoud')],
    subjectIds: [byName('Ethics & Adab'), byName('Ḥadīth')],
    metadata: {},
  });

  // Additional lecture audio via YouTube (to test filtering)
  await createContent({
    type: 'audio',
    title: 'The Sealed Nectar: A Sīrah Walkthrough — Audio',
    description: 'A chronological reading of the biography, pausing on character and decision.',
    status: 'published',
    language: 'English',
    thumbnailUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=640&q=80',
    series: 'The Life',
    provider: 'youtube',
    sourceUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    externalIdentifier: 'jNQXAC9IVRw',
    durationMin: 44,
    episodes: 15,
    scholarIds: [scholarByName('Dr. Mariam Yusuf')],
    subjectIds: [byName('Sīrah')],
    metadata: { format: 'Audio', level: 'Beginner' },
  });

  await createContent({
    type: 'lecture',
    title: 'Commercial Contracts & the Modern Market',
    description: 'Sale, partnership and debt as they meet contemporary financial instruments.',
    status: 'published',
    language: 'English',
    provider: 'youtube',
    sourceUrl: 'https://www.youtube.com/watch?v=60ItHLz5WEA',
    externalIdentifier: '60ItHLz5WEA',
    durationMin: 55,
    episodes: 7,
    scholarIds: [scholarByName('Shaykh Ibrahim Nasser')],
    subjectIds: [byName('Family & Society'), byName('Fiqh')],
    metadata: { format: 'Audio', level: 'Advanced' },
  });

  await createContent({
    type: 'book',
    title: 'Caliphs & Cities',
    description: 'A translation of early chroniclers, with maps and a reader guide.',
    status: 'published',
    language: 'English',
    coverUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
    provider: 'archive',
    sourceUrl: 'https://archive.org/details/ilmnet-caliphs-cities',
    externalIdentifier: 'ilmnet-caliphs-cities',
    collectionIdentifier: 'ilmnet-history-collection',
    collectionTitle: 'History Collection',
    pages: 432,
    year: 2020,
    scholarIds: [scholarByName('Dr. Yusuf Karim')],
    subjectIds: [byName('Islamic History')],
    metadata: {},
  });

  // Bulk-like collection items (simulate archive collection → 3 items)
  for (let i = 1; i <= 3; i++) {
    await createContent({
      type: i % 2 === 0 ? 'audio' : 'video',
      title: `Archive Collection Demo — Part ${String(i).padStart(2, '0')}`,
      description: `Part ${i} of a mixed Archive.org collection — auto-imported demo.`,
      status: 'draft',
      language: 'English',
      provider: 'archive',
      sourceUrl: `https://archive.org/details/ilmnet-collection-demo-${String(i).padStart(3, '0')}`,
      externalIdentifier: `ilmnet-collection-demo-${String(i).padStart(3, '0')}`,
      collectionIdentifier: 'ilmnet-collection-demo',
      collectionTitle: 'Demo Collection — 100 items example',
      durationMin: 30 + i,
      scholarIds: [scholars[i % scholars.length]!.id],
      subjectIds: [subjects[i % subjects.length]!.id],
      metadata: {
        archive: {
          collection: 'ilmnet-collection-demo',
          available_media: i % 2 === 0 ? ['MP3', 'Ogg'] : ['MPEG4', 'h.264'],
          creator: scholars[i % scholars.length]!.name,
        },
      },
    });
  }

  // Create one ImportJob example (prepared for collections/playlists)
  await prisma.importJob.create({
    data: {
      provider: 'archive',
      sourceUrl: 'https://archive.org/details/ilmnet-collection-demo',
      externalIdentifier: 'ilmnet-collection-demo',
      kind: 'archive_collection',
      status: 'completed',
      totalItems: 100,
      importedCount: 3,
      preview: {
        title: 'Demo Collection',
        identifier: 'ilmnet-collection-demo',
        totalItems: 100,
        kindsSummary: { audio: 40, video: 30, book: 30 },
      } as any,
    },
  });

  console.log('✅ Seed complete');
  const counts = await Promise.all([
    prisma.subject.count(),
    prisma.scholar.count(),
    prisma.content.count(),
    prisma.importJob.count(),
  ]);
  console.log(`  Subjects: ${counts[0]}, Scholars: ${counts[1]}, Contents: ${counts[2]}, ImportJobs: ${counts[3]}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
