import { Link } from 'react-router-dom';
import { useAdmin } from './store';
import { PageIntro, PrimaryButton } from './ui';

export default function Overview() {
  const { lectures, books, scholars, subjects, activity } = useAdmin();

  const pubL = lectures.filter((x) => x.status === 'published').length;
  const draftL = lectures.filter((x) => x.status === 'draft').length;
  const pubB = books.filter((x) => x.status === 'published').length;
  const draftB = books.filter((x) => x.status === 'draft').length;
  const drafts = [
    ...lectures.filter((x) => x.status === 'draft').map((x) => ({ id: x.id, title: x.title, kind: 'Lecture', to: `/admin/lectures/${x.id}` })),
    ...books.filter((x) => x.status === 'draft').map((x) => ({ id: x.id, title: x.title, kind: 'Book', to: `/admin/books/${x.id}` })),
  ];

  const stats = [
    { value: String(pubL), label: 'Published lectures', to: '/admin/lectures' },
    { value: String(draftL), label: 'Lecture drafts', to: '/admin/lectures' },
    { value: String(pubB), label: 'Published books', to: '/admin/books' },
    { value: String(scholars.length), label: 'Scholars', to: '/admin/scholars' },
    { value: String(subjects.length), label: 'Subjects', to: '/admin/subjects' },
  ];

  return (
    <div className="mx-auto max-w-[1080px] space-y-12">
      <PageIntro
        eyebrow="Library desk"
        title="Overview"
        intro="Add a YouTube lecture or an Archive.org book, attach a scholar and subjects, then publish it to the public library. Changes stay in this session until a backend exists."
        action={<PrimaryButton to="/admin/lectures/new">Add lecture</PrimaryButton>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stats.map((s) => (
          <Link
            key={s.label}
            to={s.to}
            className="bg-cream neu-raised rounded-[24px] px-5 py-6 transition-transform hover:-translate-y-1"
          >
            <p className="font-display text-ink text-[1.7rem] font-extrabold tracking-tight">{s.value}</p>
            <p className="text-ink-muted mt-2 text-[0.75rem] font-medium tracking-[0.08em] uppercase">{s.label}</p>
          </Link>
        ))}
      </div>

      <section className="bg-sand neu-raised overflow-hidden rounded-[32px] p-6 sm:p-8">
        <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.22em] uppercase">How content reaches the library</p>
        <h2 className="font-display text-ink mt-3 text-[1.55rem] font-extrabold tracking-[-0.03em]">Two sources. One publish step.</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="bg-cream neu-raised-sm rounded-[24px] p-6">
            <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.18em] uppercase">01 — Lectures</p>
            <h3 className="font-display text-ink mt-3 text-[1.2rem] font-extrabold tracking-tight">Paste a YouTube URL</h3>
            <p className="text-ink-soft mt-3 text-[0.92rem] leading-relaxed">
              Enter the link, give it a title, choose the scholar and subjects, then publish. ilmNet does not host the video — it catalogues it.
            </p>
            <div className="mt-6">
              <PrimaryButton to="/admin/lectures/new">Add lecture</PrimaryButton>
            </div>
          </article>
          <article className="bg-cream neu-raised-sm rounded-[24px] p-6">
            <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.18em] uppercase">02 — Books</p>
            <h3 className="font-display text-ink mt-3 text-[1.2rem] font-extrabold tracking-tight">Paste an Archive.org URL</h3>
            <p className="text-ink-soft mt-3 text-[0.92rem] leading-relaxed">
              Point to the scan or edition on Archive.org, name the author, attach subjects, then publish it to the reading shelf.
            </p>
            <div className="mt-6">
              <PrimaryButton to="/admin/books/new" tone="olive">
                Add book
              </PrimaryButton>
            </div>
          </article>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section>
          <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.22em] uppercase">Recent activity</p>
          <div className="bg-cream neu-raised mt-4 overflow-hidden rounded-[28px]">
            {activity.slice(0, 8).map((a, i) => (
              <div
                key={a.id}
                className={`flex items-baseline justify-between gap-4 px-5 py-4 ${i ? 'border-line/60 border-t' : ''}`}
              >
                <div className="min-w-0">
                  <p className="text-ink truncate text-[0.92rem] font-semibold">{a.title}</p>
                  <p className="text-ink-muted mt-0.5 text-[0.78rem]">
                    {a.verb} · {a.kind}
                  </p>
                </div>
                <p className="text-ink-muted shrink-0 text-[0.78rem]">{a.at}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.22em] uppercase">Waiting to publish</p>
          <div className="bg-sand neu-inset mt-4 rounded-[28px] p-4">
            {drafts.length === 0 ? (
              <p className="text-ink-muted px-3 py-8 text-center text-[0.92rem]">Nothing in draft.</p>
            ) : (
              <ul className="space-y-2">
                {drafts.map((d) => (
                  <li key={d.id}>
                    <Link
                      to={d.to}
                      className="bg-cream neu-raised-sm hover:text-rose flex items-center justify-between rounded-[18px] px-4 py-3.5 transition-colors"
                    >
                      <span>
                        <span className="text-ink-muted block text-[0.7rem] font-semibold tracking-[0.14em] uppercase">
                          {d.kind} · Draft
                        </span>
                        <span className="text-ink mt-1 block text-[0.92rem] font-semibold">{d.title}</span>
                      </span>
                      <span className="text-rose text-[0.84rem] font-semibold">Edit</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-ink-muted mt-3 px-2 text-[0.78rem]">
              {draftB} book {draftB === 1 ? 'draft' : 'drafts'} · {draftL} lecture {draftL === 1 ? 'draft' : 'drafts'}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
