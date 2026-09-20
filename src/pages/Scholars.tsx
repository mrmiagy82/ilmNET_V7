import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { SearchBar, FilterChips, Tag, EmptyState, StatRow } from '../components/ui';
import { scholars, subjects, subjectById } from '../data';

function ScholarTile({ id }: { id: string }) {
  const s = scholars.find((x) => x.id === id)!;
  const sp = subjectById(s.specialtyId);
  return (
    <article className="bg-cream neu-raised group flex flex-col rounded-[30px] p-7 transition-transform duration-500 hover:-translate-y-1.5">
      <div className="flex items-center gap-4">
        <div
          className={`font-display grid h-16 w-16 shrink-0 place-items-center rounded-full text-[1.3rem] font-extrabold neu-inset-sm ${
            s.accent === 'rose' ? 'bg-rose/10 text-rose' : 'bg-sand text-olive-deep'
          }`}
        >
          {s.initials}
        </div>
        <div>
          <h3 className="font-display text-ink text-[1.2rem] leading-tight font-extrabold tracking-[-0.02em]">
            {s.name}
          </h3>
          <Tag tone={sp?.accent}>{sp?.name}</Tag>
        </div>
      </div>

      <p className="text-ink-soft mt-5 text-[0.9rem] leading-relaxed">{s.bio}</p>

      <Link
        to="/lectures"
        className="border-line/70 text-ink-soft mt-6 flex items-center justify-between border-t pt-4 text-[0.82rem] font-medium transition-colors hover:text-rose"
      >
        <span>{s.lectureCount} lectures</span>
        <span>{s.bookCount} books</span>
        <span className="text-rose inline-flex items-center gap-1">
          View work <span aria-hidden="true">→</span>
        </span>
      </Link>
    </article>
  );
}

export default function Scholars() {
  const [query, setQuery] = useState('');
  const [specialty, setSpecialty] = useState<string | 'all'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scholars.filter((s) => {
      const sp = subjectById(s.specialtyId);
      const matchesQ = !q || s.name.toLowerCase().includes(q) || (sp?.name.toLowerCase().includes(q) ?? false);
      const matchesS = specialty === 'all' || s.specialtyId === specialty;
      return matchesQ && matchesS;
    });
  }, [query, specialty]);

  const subjectOptions = subjects.map((s) => ({ value: s.id, label: s.name.replace(/ &.*/, '') }));

  return (
    <>
      <PageHeader
        eyebrow="Learn From"
        title="Scholars"
        intro="Every item on ilmNet is traced back to its teacher. Follow a scholar's full body of work — lectures and books gathered in one place."
        meta={
          <StatRow
            items={[
              { value: `${scholars.length}`, label: 'Scholars' },
              { value: `${subjects.length}`, label: 'Fields' },
              { value: 'Free', label: 'Access' },
            ]}
          />
        }
      />

      <section className="px-5 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-[1180px]">
          <div className="bg-sand/70 neu-inset sticky top-[88px] z-30 rounded-[34px] p-4 sm:p-6">
            <SearchBar value={query} onChange={setQuery} placeholder="Search by scholar or field…" />
            <div className="mt-4">
              <FilterChips options={subjectOptions} active={specialty} onChange={setSpecialty} allLabel="All fields" />
            </div>
          </div>

          <p className="text-ink-muted mt-8 text-[0.86rem] font-medium">
            {filtered.length} {filtered.length === 1 ? 'scholar' : 'scholars'} shown
          </p>

          {filtered.length ? (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((s) => (
                <ScholarTile key={s.id} id={s.id} />
              ))}
            </div>
          ) : (
            <div className="mt-10">
              <EmptyState title="No scholars match" body="Try another field or search by name." />
            </div>
          )}
        </div>
      </section>
    </>
  );
}
