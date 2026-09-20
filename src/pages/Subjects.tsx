import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { FilterChips, EmptyState, StatRow } from '../components/ui';
import { subjects, subjectGroups, formatCount } from '../data';

function SubjectTile({ id }: { id: string }) {
  const s = subjects.find((x) => x.id === id)!;
  const badge =
    s.accent === 'rose'
      ? 'bg-rose text-cream'
      : s.accent === 'olive'
        ? 'bg-olive text-[#22251a]'
        : 'bg-sand text-ink-soft';
  return (
    <article className="bg-cream neu-raised group flex flex-col rounded-[32px] p-7 transition-transform duration-500 hover:-translate-y-1.5">
      <div className="flex items-start justify-between gap-4">
        <div
          className={`font-display grid h-14 w-14 shrink-0 place-items-center rounded-[18px] text-[1.25rem] font-extrabold neu-raised-sm ${badge}`}
        >
          {s.name.charAt(0)}
        </div>
        <span className="text-ink-muted text-[0.7rem] font-semibold uppercase tracking-[0.16em]">{s.group}</span>
      </div>

      <h3 className="font-display text-ink mt-5 text-[1.4rem] leading-tight font-extrabold tracking-[-0.03em]">
        {s.name}
      </h3>
      <p className="text-ink-soft mt-3 flex-1 text-[0.92rem] leading-relaxed">{s.description}</p>

      <div className="border-line/70 mt-6 flex items-center justify-between border-t pt-5">
        <div className="flex gap-6">
          <div>
            <p className="font-display text-ink text-[1.2rem] font-extrabold leading-none">{s.lectureCount}</p>
            <p className="text-ink-muted mt-1.5 text-[0.72rem] font-medium uppercase tracking-[0.08em]">Lectures</p>
          </div>
          <div>
            <p className="font-display text-ink text-[1.2rem] font-extrabold leading-none">{s.bookCount}</p>
            <p className="text-ink-muted mt-1.5 text-[0.72rem] font-medium uppercase tracking-[0.08em]">Books</p>
          </div>
        </div>
        <Link
          to="/lectures"
          className="text-rose inline-flex items-center gap-1.5 text-[0.86rem] font-semibold transition-all group-hover:gap-2.5"
        >
          Explore <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}

export default function Subjects() {
  const [group, setGroup] = useState<string | 'all'>('all');

  const filtered = useMemo(
    () => (group === 'all' ? subjects : subjects.filter((s) => s.group === group)),
    [group]
  );

  const totalLectures = subjects.reduce((a, s) => a + s.lectureCount, 0);
  const totalBooks = subjects.reduce((a, s) => a + s.bookCount, 0);

  return (
    <>
      <PageHeader
        eyebrow="Browse by subject"
        title="Subjects"
        intro="Start from what you want to understand. Choose a discipline and ilmNet gathers every lecture, book and series that belongs to it — grouped the way the tradition already is."
        meta={
          <StatRow
            items={[
              { value: `${subjects.length}`, label: 'Subjects' },
              { value: formatCount(totalLectures), label: 'Lectures' },
              { value: `${totalBooks}`, label: 'Books' },
            ]}
          />
        }
      />

      <section className="px-5 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-[1180px]">
          <div className="bg-sand/70 neu-inset sticky top-[88px] z-30 rounded-[34px] p-4 sm:p-6">
            <FilterChips
              options={subjectGroups.map((g) => ({ value: g, label: g }))}
              active={group}
              onChange={setGroup}
              allLabel="All groups"
            />
          </div>

          <p className="text-ink-muted mt-8 text-[0.86rem] font-medium">
            {filtered.length} subjects shown
          </p>

          {filtered.length ? (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((s) => (
                <SubjectTile key={s.id} id={s.id} />
              ))}
            </div>
          ) : (
            <div className="mt-10">
              <EmptyState title="Nothing here yet" body="Select a group to see its subjects." />
            </div>
          )}
        </div>
      </section>
    </>
  );
}
