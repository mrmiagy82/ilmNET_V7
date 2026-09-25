import { Link } from 'react-router-dom';
import { useAdmin } from './store';
import { ErrorRow, LoadingRows, PageIntro, PrimaryButton, GhostButton } from './ui';

export default function Overview() {
  const { lectures, books, scholars, subjects, activity, totals, loading, backendState } = useAdmin();

  const draftLectures = lectures.filter((x) => x.status === 'draft').length;
  const draftBooks = books.filter((x) => x.status === 'draft').length;
  const drafts = [
    ...lectures.filter((x) => x.status === 'draft').map((x) => ({ id: x.id, title: x.title, kind: 'Lecture', to: `/admin/lectures/${x.id}` })),
    ...books.filter((x) => x.status === 'draft').map((x) => ({ id: x.id, title: x.title, kind: 'Book', to: `/admin/books/${x.id}` })),
  ];

  // Numbers come from the database (`pagination.total`, one row per query). While the admin is
  // loading — or when the backend/token is not usable — the dashboard shows a state, not a 0.
  const degraded = backendState === 'offline' || backendState === 'unauthenticated';
  const countsLoading = loading || backendState === 'connecting';
  const n = (value: number | undefined) => (countsLoading ? '—' : value === undefined ? '—' : String(value));

  const statusStats = [
    { value: n(totals?.published), label: 'Published', to: '/admin/lectures', hint: 'Visible on the public site' },
    { value: n(totals?.draft), label: 'Drafts', to: '/admin/lectures', hint: 'Waiting to be published' },
    { value: n(totals?.archived), label: 'Archived', to: '/admin/books', hint: 'Hidden, kept in the database' },
  ];

  const libraryStats = [
    { value: n(totals?.publishedLectures), label: 'Published lectures', to: '/admin/lectures', hint: 'Video, audio and Archive.org items' },
    { value: n(totals?.publishedBooks), label: 'Published books', to: '/admin/books', hint: 'Books & documents' },
    { value: n(scholars.length), label: 'Scholars', to: '/admin/scholars', hint: 'Authors & teachers' },
    { value: n(subjects.length), label: 'Subjects', to: '/admin/subjects', hint: 'Shelves' },
  ];

  return (
    <div className="mx-auto max-w-[1080px] space-y-10">
      <PageIntro
        eyebrow="Library desk"
        title="Admin overview"
        intro="The public ilmNet library stays free and needs no login. Everything you curate here — YouTube (videos/playlists) and Archive.org — is saved to the PostgreSQL library as lectures, audio, video, books, documents and mixed collections, and appears on the public site as soon as it is published. Bulk import can turn one Archive.org link into up to 100 separate records."
        action={
          <div className="flex flex-col gap-2.5">
            <PrimaryButton to="/admin/archive-import">Archive.org Bulk Import</PrimaryButton>
            <PrimaryButton to="/admin/new" tone="sand">Add single item — guided flow</PrimaryButton>
            <span className="text-ink-muted text-center text-[0.72rem] font-medium">Providers: YouTube · Archive.org · External</span>
          </div>
        }
      />

      {degraded ? (
        <ErrorRow
          title={backendState === 'unauthenticated' ? 'Admin token missing or rejected (401)' : 'Backend unreachable'}
          body={
            backendState === 'unauthenticated'
              ? 'The library totals cannot be shown: the API refused the request. Set a valid admin token and the real numbers appear again.'
              : 'The library totals cannot be shown while the API does not respond. Nothing is hidden — the numbers simply are not known right now.'
          }
        />
      ) : countsLoading ? (
        <LoadingRows rows={2} label="Loading library totals from PostgreSQL…" />
      ) : (
      <>
        <div className="grid grid-cols-3 gap-4">
          {statusStats.map((s) => (
            <Link
              key={s.label}
              to={s.to}
              className="bg-cream neu-raised rounded-[24px] px-5 py-6 transition-transform hover:-translate-y-1"
            >
              <p className="font-display text-ink text-[1.7rem] font-extrabold tracking-tight">{s.value}</p>
              <p className="text-ink-muted mt-2 text-[0.72rem] font-semibold tracking-[0.08em] uppercase">{s.label}</p>
              <p className="text-ink-muted/70 mt-1 text-[0.72rem]">{s.hint}</p>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {libraryStats.map((s) => (
            <Link
              key={s.label}
              to={s.to}
              className="bg-cream neu-raised rounded-[24px] px-5 py-6 transition-transform hover:-translate-y-1"
            >
              <p className="font-display text-ink text-[1.5rem] font-extrabold tracking-tight">{s.value}</p>
              <p className="text-ink-muted mt-2 text-[0.72rem] font-semibold tracking-[0.08em] uppercase">{s.label}</p>
              <p className="text-ink-muted/70 mt-1 text-[0.72rem]">{s.hint}</p>
            </Link>
          ))}
        </div>
      </>
      )}

      {/* Bulk import highlight — new requirement */}
      <section className="bg-olive/10 neu-raised overflow-hidden rounded-[32px] border border-olive/10">
        <div className="bg-olive px-6 py-5 sm:px-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-cream/80 text-[0.72rem] font-semibold tracking-[0.18em] uppercase">New · Archive.org is now generic</p>
            <h2 className="font-display text-cream mt-1 text-[1.4rem] font-extrabold">One Archive.org link → up to 100 separate records</h2>
            <p className="text-cream/85 mt-1 max-w-[560px] text-[0.88rem] leading-relaxed">Paste a collection page, ilmNet detects every item — title, type (audio/video/book/etc.), media, thumbnail, identifier/link, speaker, date, language, description — then you select which to import and configure each individually.</p>
          </div>
          <PrimaryButton to="/admin/archive-import" tone="sand">Open Bulk Import</PrimaryButton>
        </div>
        <div className="px-6 py-4 sm:px-8 bg-cream/70 flex flex-wrap gap-2 text-[0.78rem]">
          <span className="bg-cream neu-raised-sm rounded-full px-3 py-1 font-medium">Example: 100 audio lectures</span>
          <span className="bg-cream neu-raised-sm rounded-full px-3 py-1 font-medium">“Archive.org collection detected — 100 items found”</span>
          <span className="bg-cream neu-raised-sm rounded-full px-3 py-1 font-medium">Per-item: select · title · type · scholar · subject · language · draft/publish/skip</span>
        </div>
      </section>

      {/* Guided workflow hero */}
      <section className="bg-sand neu-raised overflow-hidden rounded-[32px] p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-[560px]">
            <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.22em] uppercase">Content creation flow</p>
            <h2 className="font-display text-ink mt-3 text-[1.55rem] font-extrabold tracking-[-0.03em] leading-tight">One workflow for every source & type.</h2>
            <p className="text-ink-soft mt-3 text-[0.92rem] leading-relaxed">Add content → choose Lecture/Book/Audio/Video/Document → pick provider (YouTube, Archive.org, External) → paste URL → preview embed → metadata → scholar(s) → subject(s) → draft/publish. For Archive.org collections, the bulk step surfaces every detected item before you save.</p>
          </div>
          <div className="flex flex-col gap-2">
            <PrimaryButton to="/admin/new">Add single item</PrimaryButton>
            <GhostButton to="/admin/archive-import">Bulk Archive import</GhostButton>
          </div>
        </div>

        <div className="bg-cream neu-inset mt-8 rounded-[24px] p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            {[
              'Add content',
              'Content type',
              'Provider',
              'Paste URL',
              'Preview embed',
              'Metadata',
              'Scholar(s)',
              'Subject(s)',
              'Save',
            ].map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <span className={`grid h-7 w-7 place-items-center rounded-full text-[0.72rem] font-bold ${i === 8 ? 'bg-rose text-cream' : i < 8 ? 'bg-olive text-cream' : 'bg-sand text-ink-muted'}`}>{i + 1}</span>
                <span className={`hidden text-[0.78rem] font-semibold sm:inline ${i === 8 ? 'text-rose' : 'text-ink-soft'}`}>{label}</span>
                {i < 8 && <span className="text-line mx-1 hidden sm:inline">—</span>}
              </div>
            ))}
          </div>
          <div className="mt-3 hidden gap-1 sm:flex">
            <div className="bg-rose h-1.5 flex-1 rounded-full" />
            <div className="bg-olive h-1.5 flex-1 rounded-full" />
            <div className="bg-cream neu-inset h-1.5 flex-1 rounded-full" />
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="bg-cream neu-raised-sm rounded-[24px] p-6">
            <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.18em] uppercase">YouTube · unchanged</p>
            <h3 className="font-display text-ink mt-3 text-[1.15rem] font-extrabold tracking-tight leading-tight">YouTube videos & playlists</h3>
            <p className="text-ink-soft mt-3 text-[0.9rem] leading-relaxed">Single talk or 40-part course — choose Video or Playlist, paste, embed. Fully preserved.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="bg-sand text-ink-muted rounded-full px-3 py-1.5 text-[0.72rem] font-semibold">youtube.com / youtu.be</span>
              <span className="bg-sand text-ink-muted rounded-full px-3 py-1.5 text-[0.72rem] font-semibold">playlist?list=…</span>
            </div>
            <div className="mt-6 flex gap-3">
              <PrimaryButton to="/admin/lectures/new">Add lecture</PrimaryButton>
              <GhostButton to="/admin/lectures">Manage</GhostButton>
            </div>
          </article>
          <article className="bg-cream neu-raised-sm rounded-[24px] p-6 ring-1 ring-olive/10">
            <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.18em] uppercase">Archive.org · generic</p>
            <h3 className="font-display text-ink mt-3 text-[1.15rem] font-extrabold tracking-tight leading-tight">Audio · Video · Books · Documents · Collections</h3>
            <p className="text-ink-soft mt-3 text-[0.9rem] leading-relaxed">Not only books. A collection with 100 recordings is detected as 100 items — you curate each one: type, scholar, subject, language, series, draft/publish/skip.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="bg-olive/15 text-olive-deep rounded-full px-3 py-1.5 text-[0.72rem] font-semibold">audio</span>
              <span className="bg-rose/10 text-rose rounded-full px-3 py-1.5 text-[0.72rem] font-semibold">video</span>
              <span className="bg-sand text-ink-muted rounded-full px-3 py-1.5 text-[0.72rem] font-semibold">book / document</span>
            </div>
            <div className="mt-6 flex gap-3">
              <PrimaryButton to="/admin/archive-import" tone="olive">Bulk import</PrimaryButton>
              <GhostButton to="/admin/lectures/new">Single Archive lecture</GhostButton>
            </div>
          </article>
          <article className="bg-cream neu-raised-sm rounded-[24px] p-6">
            <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.18em] uppercase">Taxonomy</p>
            <h3 className="font-display text-ink mt-3 text-[1.15rem] font-extrabold tracking-tight leading-tight">Scholars & Subjects</h3>
            <p className="text-ink-soft mt-3 text-[0.9rem] leading-relaxed">Shared across all providers and content types. Bulk import lets you assign per-item or in bulk.</p>
            <div className="mt-6 flex gap-3">
              <GhostButton to="/admin/scholars">Scholars</GhostButton>
              <GhostButton to="/admin/subjects">Subjects</GhostButton>
            </div>
            <p className="text-ink-muted mt-4 text-[0.78rem] leading-relaxed">Providers: <span className="font-semibold text-ink-soft">YouTube</span>, <span className="font-semibold text-ink-soft">Archive.org</span>, <span className="font-semibold text-ink-soft">External</span> · Content types: Lecture, Book, Audio, Video, Document.</p>
          </article>
        </div>
      </section>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="min-w-0">
          <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.22em] uppercase">Recent activity · session only</p>
          <div className="bg-cream neu-raised mt-4 overflow-hidden rounded-[28px]">
            {activity.length === 0 && (
              <p className="text-ink-muted px-5 py-8 text-center text-[0.92rem]">
                No changes in this session yet — saved edits appear here.
              </p>
            )}
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

        <section className="min-w-0">
          <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.22em] uppercase">Waiting to publish</p>
          <div className="bg-sand neu-inset mt-4 rounded-[28px] p-4">
            {drafts.length === 0 ? (
              <p className="text-ink-muted px-3 py-8 text-center text-[0.92rem]">Nothing in draft — everything is live.</p>
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
              {draftBooks} book {draftBooks === 1 ? 'draft' : 'drafts'} · {draftLectures} lecture {draftLectures === 1 ? 'draft' : 'drafts'} in this
              view
              {totals
                ? ` · ${totals.draft} draft${totals.draft === 1 ? '' : 's'} and ${totals.published} published in the database`
                : ''}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
