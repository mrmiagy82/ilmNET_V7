import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { SearchBar, FilterChips, Tag, EmptyState, StatRow } from '../components/ui';
import { lectures, subjects, subjectById, formatCount, formatDuration } from '../data';

function PlayGlyph({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 5.6c0-.9 1-1.5 1.8-1l8.1 5.1a1.2 1.2 0 0 1 0 2L9.8 17c-.8.5-1.8-.1-1.8-1V5.6Z" />
    </svg>
  );
}

function LectureCard({ id }: { id: string }) {
  const l = lectures.find((x) => x.id === id)!;
  const subj = subjectById(l.subjectId);
  return (
    <article className="bg-cream neu-raised group flex flex-col rounded-[30px] p-6 transition-transform duration-500 hover:-translate-y-1.5">
      <div className="bg-sand neu-inset relative flex h-40 items-center justify-center overflow-hidden rounded-[22px]">
        <div className="absolute inset-x-0 bottom-0 flex h-12 items-end gap-[3px] px-5 pb-3 opacity-40">
          {Array.from({ length: 28 }).map((_, i) => (
            <span
              key={i}
              style={{ height: `${12 + ((i * 13) % 60)}%` }}
              className={i % 3 === 0 ? 'bg-rose/50 flex-1 rounded-full' : 'bg-olive/40 flex-1 rounded-full'}
            />
          ))}
        </div>
        <button className="bg-cream neu-raised-sm text-rose group-hover:scale-[1.06] relative grid h-16 w-16 place-items-center rounded-full transition-transform">
          <PlayGlyph className="h-7 w-7" />
        </button>
        <span className="bg-cream/90 text-ink neu-raised-sm absolute right-3 top-3 rounded-full px-3 py-1.5 text-[0.72rem] font-semibold">
          {l.format}
        </span>
      </div>

      <div className="flex flex-1 flex-col px-1 pt-5">
        <div className="flex items-center gap-2">
          <Tag tone={subj?.accent}>{subj?.name}</Tag>
          <Tag tone="plain">{l.level}</Tag>
        </div>
        <h3 className="font-display text-ink mt-3 text-[1.18rem] leading-snug font-extrabold tracking-[-0.02em]">
          {l.title}
        </h3>
        <Link to="/scholars" className="text-rose mt-2 text-[0.9rem] font-semibold">
          {l.scholar}
        </Link>
        <p className="text-ink-muted mt-3 text-[0.84rem]">
          {l.series} · {l.episodes} episodes
        </p>

        <div className="border-line/70 mt-5 flex items-center justify-between border-t pt-4 text-[0.8rem]">
          <span className="text-ink-soft font-medium">{formatDuration(l.durationMin)} / ep</span>
          <span className="text-ink-muted">{formatCount(l.plays)} listens</span>
        </div>
      </div>
    </article>
  );
}

export default function Lectures() {
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState<string | 'all'>('all');
  const [format, setFormat] = useState<'all' | 'Audio' | 'Video'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lectures.filter((l) => {
      const matchesQ =
        !q ||
        l.title.toLowerCase().includes(q) ||
        l.scholar.toLowerCase().includes(q) ||
        l.series.toLowerCase().includes(q) ||
        (subjectById(l.subjectId)?.name.toLowerCase().includes(q) ?? false);
      const matchesS = subject === 'all' || l.subjectId === subject;
      const matchesF = format === 'all' || l.format === format;
      return matchesQ && matchesS && matchesF;
    });
  }, [query, subject, format]);

  const totalListens = lectures.reduce((a, l) => a + l.plays, 0);
  const subjectOptions = subjects.map((s) => ({ value: s.id, label: s.name.replace(/ &.*/, '') }));

  return (
    <>
      <PageHeader
        eyebrow="Listen & Learn"
        title="Lectures"
        intro="Full courses, single talks and ongoing series — ordered into sequences you can actually finish. Filter by subject, format or search by scholar."
        meta={
          <StatRow
            items={[
              { value: `${lectures.length}`, label: 'Series' },
              { value: formatCount(totalListens), label: 'Listens' },
              { value: 'Free', label: 'Always' },
            ]}
          />
        }
      />

      <section className="px-5 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-[1180px]">
          <div className="bg-sand/70 neu-inset sticky top-[88px] z-30 rounded-[34px] p-4 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="lg:flex-1">
                <SearchBar value={query} onChange={setQuery} placeholder="Search lectures, scholars, series…" />
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-4">
              <FilterChips options={subjectOptions} active={subject} onChange={setSubject} allLabel="All subjects" />
              <FilterChips
                options={[
                  { value: 'Audio', label: 'Audio' },
                  { value: 'Video', label: 'Video' },
                ]}
                active={format}
                onChange={setFormat}
                allLabel="All formats"
              />
            </div>
          </div>

          <p className="text-ink-muted mt-8 text-[0.86rem] font-medium">
            {filtered.length} {filtered.length === 1 ? 'lecture' : 'lectures'} shown
          </p>

          {filtered.length ? (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((l) => (
                <LectureCard key={l.id} id={l.id} />
              ))}
            </div>
          ) : (
            <div className="mt-10">
              <EmptyState title="No lectures match" body="Try a different subject, format or search term." />
            </div>
          )}
        </div>
      </section>
    </>
  );
}
