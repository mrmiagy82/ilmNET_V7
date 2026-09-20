import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { SearchBar, FilterChips, Tag, EmptyState, StatRow } from '../components/ui';
import { books, subjects, subjectById } from '../data';

function BookCover({ id }: { id: string }) {
  const b = books.find((x) => x.id === id)!;
  const subj = subjectById(b.subjectId);
  const cover =
    subj?.accent === 'rose'
      ? 'from-rose/85 to-rose-deep'
      : subj?.accent === 'olive'
        ? 'from-olive to-olive-deep'
        : 'from-ink/80 to-ink';
  return (
    <div className="bg-sand neu-inset grid h-48 place-items-center rounded-[22px]">
      <div className={`relative h-[150px] w-[112px] overflow-hidden rounded-[8px] bg-gradient-to-br ${cover} shadow-[10px_14px_26px_rgba(60,45,30,0.28)]`}>
        <div className="absolute inset-y-0 left-0 w-2.5 bg-black/20" />
        <div className="absolute inset-y-0 left-2.5 w-1 bg-white/25" />
        <div className="flex h-full flex-col justify-between p-3 pl-4">
          <span className="text-cream/80 text-[0.6rem] font-semibold uppercase tracking-[0.14em]">{b.format}</span>
          <div>
            <p className="font-display text-cream text-[0.92rem] leading-tight font-extrabold">{b.title}</p>
            <p className="text-cream/70 mt-1 text-[0.66rem]">{b.author}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BookCard({ id }: { id: string }) {
  const b = books.find((x) => x.id === id)!;
  const subj = subjectById(b.subjectId);
  return (
    <article className="bg-cream neu-raised group flex flex-col rounded-[30px] p-6 transition-transform duration-500 hover:-translate-y-1.5">
      <BookCover id={id} />
      <div className="flex flex-1 flex-col px-1 pt-5">
        <Tag tone={subj?.accent}>{subj?.name}</Tag>
        <h3 className="font-display text-ink mt-3 text-[1.18rem] leading-snug font-extrabold tracking-[-0.02em]">
          {b.title}
        </h3>
        <Link to="/scholars" className="text-rose mt-1.5 text-[0.9rem] font-semibold">
          {b.author}
        </Link>
        <p className="text-ink-soft mt-3 text-[0.88rem] leading-relaxed">{b.description}</p>
        <div className="border-line/70 mt-5 flex items-center justify-between border-t pt-4 text-[0.8rem]">
          <span className="text-ink-soft font-medium">{b.pages} pages</span>
          <span className="text-ink-muted">{b.year}</span>
        </div>
      </div>
    </article>
  );
}

export default function Books() {
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState<string | 'all'>('all');
  const [format, setFormat] = useState<string | 'all'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter((b) => {
      const matchesQ =
        !q ||
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q);
      const matchesS = subject === 'all' || b.subjectId === subject;
      const matchesF = format === 'all' || b.format === format;
      return matchesQ && matchesS && matchesF;
    });
  }, [query, subject, format]);

  const subjectOptions = subjects.map((s) => ({ value: s.id, label: s.name.replace(/ &.*/, '') }));
  const formatOptions = ['Translation', 'Commentary', 'Primer', 'Classical'].map((f) => ({ value: f, label: f }));

  return (
    <>
      <PageHeader
        eyebrow="Read & Reflect"
        title="Books"
        intro="Classical texts and contemporary works, with clean reading, saved progress and chapter navigation. Browse by subject or the kind of edition you need."
        meta={
          <StatRow
            items={[
              { value: `${books.length}`, label: 'Titles' },
              { value: `${subjects.length}`, label: 'Subjects' },
              { value: 'Free', label: 'To read' },
            ]}
          />
        }
      />

      <section className="px-5 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-[1180px]">
          <div className="bg-sand/70 neu-inset sticky top-[88px] z-30 rounded-[34px] p-4 sm:p-6">
            <SearchBar value={query} onChange={setQuery} placeholder="Search titles, authors, descriptions…" />
            <div className="mt-4 flex flex-col gap-4">
              <FilterChips options={subjectOptions} active={subject} onChange={setSubject} allLabel="All subjects" />
              <FilterChips options={formatOptions} active={format} onChange={setFormat} allLabel="All formats" />
            </div>
          </div>

          <p className="text-ink-muted mt-8 text-[0.86rem] font-medium">
            {filtered.length} {filtered.length === 1 ? 'book' : 'books'} shown
          </p>

          {filtered.length ? (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((b) => (
                <BookCard key={b.id} id={b.id} />
              ))}
            </div>
          ) : (
            <div className="mt-10">
              <EmptyState title="No books match" body="Try a different subject, edition or search term." />
            </div>
          )}
        </div>
      </section>
    </>
  );
}
