import { assetUrl } from '@/lib/api';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SearchBar, FilterChips } from '../components/ui';
import { useAdmin } from './store';
import {
  ConfirmDialog,
  CountLine,
  EmptyRow,
  ErrorRow,
  IconBtn,
  LoadingRows,
  PageIntro,
  PencilIcon,
  PrimaryButton,
  StatusPill,
  TableShell,
  TrashIcon,
  statusActions,
  tdCls,
  thCls,
  trCls,
} from './ui';
import { isArchiveUrl, isYoutubePlaylistUrl } from './data';

export default function LecturesPage() {
  const { lectures, scholars, subjects, deleteLecture, setLectureStatus, loading, backendState, totals } = useAdmin();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [subject, setSubject] = useState<string | 'all'>('all');
  const [source, setSource] = useState<'all' | 'youtube-video' | 'youtube-playlist' | 'archive'>('all');
  const [pending, setPending] = useState<string | null>(null);

  const scholarNames = (l: (typeof lectures)[number]) => {
    const ids = l.scholarIds && l.scholarIds.length ? l.scholarIds : [l.scholarId];
    return ids.map((id) => scholars.find((s) => s.id === id)?.name ?? '—').join(', ');
  };
  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? id;

  const lectureProvider = (l: (typeof lectures)[number]) => (l as any).provider ?? (isArchiveUrl((l as any).sourceUrl ?? l.youtubeUrl) ? 'archive' : 'youtube');
  // series is free text; collectionTitle/collectionIdentifier come from a bulk import
  const groupLabel = (l: (typeof lectures)[number]) => [l.series, l.collectionTitle].filter(Boolean).join(' · ');
  const lectureUrl = (l: (typeof lectures)[number]) => (l as any).sourceUrl ?? l.youtubeUrl ?? '';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lectures.filter((l) => {
      const names = l.subjectIds.map(subjectName).join(' ');
      const scholarStr = scholarNames(l);
      const url = lectureUrl(l).toLowerCase();
      const matchesQ =
        !q ||
        l.title.toLowerCase().includes(q) ||
        scholarStr.toLowerCase().includes(q) ||
        l.series.toLowerCase().includes(q) ||
        (l.collectionTitle ?? '').toLowerCase().includes(q) ||
        names.toLowerCase().includes(q) ||
        url.includes(q);
      const matchesS = status === 'all' || l.status === status;
      const matchesSub = subject === 'all' || l.subjectIds.includes(subject);
      const prov = lectureProvider(l);
      const sType = l.sourceType ?? (isYoutubePlaylistUrl(l.youtubeUrl) ? 'youtube-playlist' : 'youtube-video');
      let matchesSrc = false;
      if (source === 'all') matchesSrc = true;
      else if (source === 'archive') matchesSrc = prov === 'archive';
      else matchesSrc = sType === source && prov !== 'archive';
      return matchesQ && matchesS && matchesSub && matchesSrc;
    });
  }, [lectures, query, status, subject, source, scholars, subjects]);

  const remove = lectures.find((l) => l.id === pending);

  return (
    <div className="mx-auto max-w-[1080px]">
      <PageIntro
        eyebrow="External — YouTube + Archive.org (generic)"
        title="Lectures"
        intro="Lectures can be YouTube (video/playlist) or Archive.org (audio/video). Archive.org is not only for books — use Bulk import for collections of 100. Attach scholar(s) and subject(s), then publish."
        action={
          <div className="flex flex-col gap-2">
            <PrimaryButton to="/admin/archive-import">Bulk Archive import</PrimaryButton>
            <PrimaryButton to="/admin/lectures/new" tone="sand">Quick add lecture</PrimaryButton>
          </div>
        }
      />

      <div className="bg-sand/70 neu-inset mt-10 rounded-[28px] p-4 sm:p-5">
        <SearchBar value={query} onChange={setQuery} placeholder="Search title, scholar, series… (also scans URL / Archive identifier)" />
        <div className="mt-4 flex flex-col gap-3">
          <FilterChips
            options={[
              { value: 'published', label: 'Published' },
              { value: 'draft', label: 'Draft' },
              { value: 'archived', label: 'Archived' },
            ]}
            active={status}
            onChange={setStatus}
            allLabel="All states"
          />
          <FilterChips
            options={[
              { value: 'youtube-video', label: 'YouTube video' },
              { value: 'youtube-playlist', label: 'YouTube playlist' },
              { value: 'archive', label: 'Archive.org' },
            ]}
            active={source}
            onChange={setSource}
            allLabel="All providers"
          />
          <FilterChips
            options={subjects.map((s) => ({ value: s.id, label: s.name.replace(/ &.*/, '') }))}
            active={subject}
            onChange={setSubject}
            allLabel="All subjects"
          />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <CountLine
          n={filtered.length}
          noun="lecture"
          total={status === 'all' && !query.trim() && subject === 'all' && source === 'all' ? totals?.allLectures : undefined}
        />
        <span className="text-ink-muted hidden text-[0.76rem] sm:inline">Archive lectures show as “Archive” badge — same management.</span>
      </div>

      {backendState === 'unauthenticated' ? (
        <div className="mt-6">
          <ErrorRow
            title="Not signed in (401)"
            body="The lectures could not be loaded. Sign in again — nothing was changed."
          />
        </div>
      ) : backendState === 'offline' ? (
        <div className="mt-6">
          <ErrorRow
            title="Backend unreachable"
            body="The lecture list could not be loaded from the database. Retry once the API responds — this is not an empty library."
          />
        </div>
      ) : loading ? (
        <div className="mt-6">
          <LoadingRows rows={4} label="Loading lectures from PostgreSQL…" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyRow title="No lectures match" body="Try another search, subject, source or publish state." />
        </div>
      ) : (
        <>
          <div className="mt-5 space-y-3 lg:hidden">
            {filtered.map((l) => {
              const prov = lectureProvider(l);
              const sType = prov === 'archive' ? 'archive' : (l.sourceType ?? (isYoutubePlaylistUrl(l.youtubeUrl) ? 'youtube-playlist' : 'youtube-video'));
              const url = lectureUrl(l);
              return (
                <article key={l.id} className="bg-cream neu-raised rounded-[24px] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <StatusPill status={l.status} />
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[0.68rem] font-semibold tracking-[0.04em] uppercase ${prov === 'archive' ? 'bg-olive/20 text-olive-deep' : sType === 'youtube-playlist' ? 'bg-olive/20 text-olive-deep' : 'bg-rose/10 text-rose'}`}>
                          {prov === 'archive' ? 'Archive.org' : sType === 'youtube-playlist' ? 'Playlist' : 'Video'}
                        </span>
                        {prov === 'archive' && (l as any).mediaTypes && (
                          <span className="bg-sand text-ink-muted rounded-full px-2 py-1 text-[0.62rem] font-medium">{(l as any).mediaTypes.slice(0,2).join(' · ')}</span>
                        )}
                      </div>
                      <h3 className="font-display text-ink mt-2 text-[1.05rem] leading-snug font-extrabold">{l.title}</h3>
                      <p className="text-ink-muted mt-1 text-[0.82rem]">{scholarNames(l)}</p>
                      {l.thumbnailUrl && (
                        <div className="mt-3 h-[88px] w-full overflow-hidden rounded-[12px] bg-sand">
                          <img src={assetUrl(l.thumbnailUrl)!} alt="" className="h-full w-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-ink-muted mt-3 truncate text-[0.78rem] font-mono">{url}</p>
                  <p className="text-ink-muted mt-1 text-[0.72rem]">{[groupLabel(l), l.subjectIds.map(subjectName).join(', ')].filter(Boolean).join(' · ')}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link to={`/admin/lectures/${l.id}`} className="bg-sand neu-raised-sm rounded-full px-4 py-2 text-[0.8rem] font-semibold">
                      Edit
                    </Link>
                    {statusActions(l.status, {
                      publish: () => setLectureStatus(l.id, 'published'),
                      unpublish: () => setLectureStatus(l.id, 'draft'),
                      archive: () => setLectureStatus(l.id, 'archived'),
                      restore: () => setLectureStatus(l.id, 'draft'),
                    }).map((a) => (
                      <button key={a.key} onClick={a.onClick} className="bg-sand neu-raised-sm rounded-full px-4 py-2 text-[0.8rem] font-semibold">
                        {a.label}
                      </button>
                    ))}
                    <button onClick={() => setPending(l.id)} className="text-rose rounded-full px-4 py-2 text-[0.8rem] font-semibold">
                      Remove
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-5 hidden lg:block">
            <TableShell>
              <table className="w-full min-w-[920px]">
                <thead>
                  <tr className="bg-sand/50">
                    <th className={thCls}>Title</th>
                    <th className={thCls}>Provider</th>
                    <th className={thCls}>Scholar(s)</th>
                    <th className={thCls}>Subjects</th>
                    <th className={thCls}>State</th>
                    <th className={thCls}>Updated</th>
                    <th className={thCls}> </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => {
                    const prov = lectureProvider(l);
                    const sType = prov === 'archive' ? 'archive' : (l.sourceType ?? (isYoutubePlaylistUrl(l.youtubeUrl) ? 'youtube-playlist' : 'youtube-video'));
                    const url = lectureUrl(l);
                    return (
                      <tr key={l.id} className={trCls}>
                        <td className={tdCls}>
                          <div className="flex gap-3">
                            {l.thumbnailUrl ? (
                              <img src={assetUrl(l.thumbnailUrl)!} alt="" className="h-10 w-16 shrink-0 rounded-[8px] object-cover bg-sand" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
                            ) : (
                              <span className="bg-sand grid h-10 w-16 shrink-0 place-items-center rounded-[8px] text-ink-muted text-[0.62rem] font-semibold">{prov === 'archive' ? 'ARCHIVE' : sType === 'youtube-playlist' ? 'PLAYLIST' : 'VIDEO'}</span>
                            )}
                            <div>
                              <p className="font-semibold leading-tight">{l.title}</p>
                              <p className="text-ink-muted mt-0.5 max-w-[260px] truncate text-[0.75rem] font-mono">{url}</p>
                              <p className="text-ink-muted text-[0.72rem] mt-1">{[groupLabel(l), (l as any).archiveIdentifier].filter(Boolean).join(' · ')}</p>
                            </div>
                          </div>
                        </td>
                        <td className={tdCls}>
                          <span className={`rounded-full px-2.5 py-1 text-[0.72rem] font-semibold ${prov === 'archive' ? 'bg-olive/15 text-olive-deep' : sType === 'youtube-playlist' ? 'bg-olive/15 text-olive-deep' : 'bg-rose/10 text-rose'}`}>
                            {prov === 'archive' ? 'Archive.org' : sType === 'youtube-playlist' ? 'Playlist' : 'Video'}
                          </span>
                        </td>
                        <td className={`${tdCls} text-ink-soft max-w-[160px] truncate`}>{scholarNames(l)}</td>
                        <td className={`${tdCls} text-ink-soft max-w-[160px] truncate`}>{l.subjectIds.map(subjectName).join(', ')}</td>
                        <td className={tdCls}>
                          <StatusPill status={l.status} />
                        </td>
                        <td className={`${tdCls} text-ink-muted whitespace-nowrap`}>{l.updatedAt}</td>
                        <td className={tdCls}>
                          <div className="flex items-center justify-end gap-1">
                            {statusActions(l.status, {
                              publish: () => setLectureStatus(l.id, 'published'),
                              unpublish: () => setLectureStatus(l.id, 'draft'),
                              archive: () => setLectureStatus(l.id, 'archived'),
                              restore: () => setLectureStatus(l.id, 'draft'),
                            }).map((a) => (
                              <button
                                key={a.key}
                                onClick={a.onClick}
                                className="text-ink-muted hover:text-rose px-2 text-[0.78rem] font-semibold"
                              >
                                {a.label}
                              </button>
                            ))}
                            <Link
                              to={`/admin/lectures/${l.id}`}
                              aria-label="Edit"
                              className="text-ink-muted hover:bg-sand hover:text-ink grid h-9 w-9 place-items-center rounded-full"
                            >
                              <PencilIcon />
                            </Link>
                            <IconBtn label="Remove" onClick={() => setPending(l.id)}>
                              <TrashIcon />
                            </IconBtn>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableShell>
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(remove)}
        title="Remove this lecture?"
        body={
          remove
            ? `“${remove.title}” will leave the desk. The ${lectureProvider(remove) === 'archive' ? 'Archive.org item' : `YouTube ${remove.sourceType === 'youtube-playlist' ? 'playlist' : 'video'}`} itself is not deleted. The record is removed from the database for good — use Archive instead if you only want to hide it.`
            : ''
        }
        confirmLabel="Delete for good"
        requirePhrase={remove?.title}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) deleteLecture(pending);
          setPending(null);
        }}
      />
    </div>
  );
}
