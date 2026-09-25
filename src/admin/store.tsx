import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  todayStamp,
  uid,
  type Activity,
  type AdminBook,
  type AdminLecture,
  type AdminScholar,
  type AdminSubject,
  type PublishStatus,
} from './data';
import * as api from '@/lib/api';

type Kind = Activity['kind'];

/** Why the admin API is not usable right now — an auth problem is not a network problem. */
export type BackendState = 'connecting' | 'online' | 'unauthenticated' | 'offline';

/**
 * Real totals straight from the database (`pagination.total`, one record per query) — never
 * derived from the capped list the admin loads, and never invented.
 */
export interface AdminTotals {
  published: number;
  draft: number;
  archived: number;
  publishedLectures: number;
  publishedBooks: number;
  /** every lecture-type record regardless of status — what the Lectures list holds. */
  allLectures: number;
  /** every book/document record regardless of status — what the Books list holds. */
  allBooks: number;
}

interface AdminStore {
  lectures: AdminLecture[];
  books: AdminBook[];
  scholars: AdminScholar[];
  subjects: AdminSubject[];
  activity: Activity[];
  notice: string | null;
  apiOnline: boolean;
  apiAuthError: boolean;
  backendState: BackendState;
  loading: boolean;
  totals: AdminTotals | null;
  clearNotice: () => void;
  flash: (msg: string) => void;
  refresh: () => Promise<void>;
  upsertLecture: (item: AdminLecture, verb: Activity['verb']) => void;
  deleteLecture: (id: string) => void;
  setLectureStatus: (id: string, status: PublishStatus) => void;
  upsertBook: (item: AdminBook, verb: Activity['verb']) => void;
  deleteBook: (id: string) => void;
  setBookStatus: (id: string, status: PublishStatus) => void;
  upsertScholar: (item: AdminScholar, verb: Activity['verb']) => void;
  deleteScholar: (id: string) => void;
  setScholarStatus: (id: string, status: PublishStatus) => void;
  upsertSubject: (item: AdminSubject, verb: Activity['verb']) => void;
  deleteSubject: (id: string) => void;
  setSubjectStatus: (id: string, status: PublishStatus) => void;
}

const Ctx = createContext<AdminStore | null>(null);

function log(verb: Activity['verb'], kind: Kind, title: string): Activity {
  return { id: uid('act'), at: todayStamp(), verb, kind, title };
}

function toAdminScholar(s: api.BackendScholar): AdminScholar {
  return {
    id: s.id,
    name: s.name,
    initials: s.initials,
    specialtyId: s.specialtyId ?? '',
    bio: s.bio ?? '',
    accent: s.accent as any,
    status: api.backendToPublishStatus(s.status),
    updatedAt: new Date(s.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
  };
}
function toAdminSubject(s: api.BackendSubject): AdminSubject {
  return {
    id: s.id,
    name: s.name,
    group: s.group as any,
    description: s.description ?? '',
    accent: s.accent as any,
    status: api.backendToPublishStatus(s.status),
    updatedAt: new Date(s.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
  };
}

type Settled<T> = { ok: true; value: T } | { ok: false; status?: number };

async function settle<T>(p: Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, value: await p };
  } catch (e: any) {
    return { ok: false, status: typeof e?.status === 'number' ? e.status : undefined };
  }
}

/** `pagination.total` of a settled list response — the database count, or null when the call failed. */
function totalOf(res: Settled<{ pagination: { total: number } }>): number | null {
  return res.ok ? res.value.pagination.total : null;
}

/**
 * Status transitions. Publishing goes through the publish endpoint (it validates scholar + subject
 * and stamps publishedAt). Restoring an archived record returns it to draft — archived content never
 * becomes public again on its own.
 */
function statusChange(noun: string, status: PublishStatus, previous?: PublishStatus): { verb: Activity['verb']; message: string } {
  if (status === 'published') return { verb: 'Published', message: `${noun} published — visible on the public site.` };
  if (status === 'archived') return { verb: 'Archived', message: `${noun} archived — kept in the database, hidden from the public site.` };
  if (previous === 'archived') return { verb: 'Restored', message: `${noun} restored to draft.` };
  return { verb: 'Unpublished', message: `${noun} unpublished — back to draft.` };
}

function statusRequest(id: string, status: PublishStatus, previous?: PublishStatus) {
  if (status === 'published') return api.publishContent(id);
  if (status === 'archived') return api.archiveContent(id);
  if (previous === 'archived') return api.restoreContent(id);
  return api.unpublishContent(id);
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [lectures, setLectures] = useState<AdminLecture[]>([]);
  const [books, setBooks] = useState<AdminBook[]>([]);
  const [scholars, setScholars] = useState<AdminScholar[]>([]);
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  // Activity reflects real actions in this session only — never seeded with demo entries.
  const [activity, setActivity] = useState<Activity[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [backendState, setBackendState] = useState<BackendState>('connecting');
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState<AdminTotals | null>(null);

  const push = (entry: Activity) => setActivity((prev) => [entry, ...prev].slice(0, 14));
  const flash = (msg: string) => setNotice(msg);

  const refresh = async () => {
    const [schRes, subRes, contRes, pubRes, draftRes, archRes, lecRes, bookRes, allLecRes, allBookRes] = await Promise.all([
      settle(api.listAdminScholars()),
      settle(api.listAdminSubjects()),
      settle(api.listAdminContents({ limit: 100 })),
      // one record per query: pagination.total is the real database count, not a page size
      settle(api.listAdminContents({ limit: 1, status: 'published' })),
      settle(api.listAdminContents({ limit: 1, status: 'draft' })),
      settle(api.listAdminContents({ limit: 1, status: 'archived' })),
      settle(api.listAdminContents({ limit: 1, status: 'published', type: 'lecture,audio,video' })),
      settle(api.listAdminContents({ limit: 1, status: 'published', type: 'book,document' })),
      settle(api.listAdminContents({ limit: 1, type: 'lecture,audio,video' })),
      settle(api.listAdminContents({ limit: 1, type: 'book,document' })),
    ]);

    const counts: Record<keyof AdminTotals, number | null> = {
      published: totalOf(pubRes),
      draft: totalOf(draftRes),
      archived: totalOf(archRes),
      publishedLectures: totalOf(lecRes),
      publishedBooks: totalOf(bookRes),
      allLectures: totalOf(allLecRes),
      allBooks: totalOf(allBookRes),
    };
    // Partial counts would be misleading, so they are shown all-or-nothing.
    if (Object.values(counts).every((v) => v !== null)) setTotals(counts as AdminTotals);
    else setTotals(null);

    if (schRes.ok && subRes.ok && contRes.ok) {
      setScholars(schRes.value.data.map(toAdminScholar));
      setSubjects(subRes.value.data.map(toAdminSubject));
      const all = contRes.value.data as api.BackendContent[];
      const lecTypes = new Set(['lecture', 'audio', 'video']);
      const bookTypes = new Set(['book', 'document']);
      const l: AdminLecture[] = [];
      const b: AdminBook[] = [];
      for (const c of all) {
        if (lecTypes.has(c.type)) l.push(api.backendToAdminLecture(c));
        else if (bookTypes.has(c.type)) b.push(api.backendToAdminBook(c));
        else {
          // fallback: if provider youtube => lecture else book
          if (c.provider === 'youtube') l.push(api.backendToAdminLecture(c));
          else b.push(api.backendToAdminBook(c));
        }
      }
      // sort by updatedAt desc (backend already)
      setLectures(l);
      setBooks(b);
      setBackendState('online');
    } else {
      const status = [schRes, subRes, contRes].find((r) => !r.ok && r.status !== undefined) as { status?: number } | undefined;
      const code = status?.status;
      setBackendState(code === 401 || code === 403 ? 'unauthenticated' : 'offline');
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // only once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apiOnline = backendState === 'online';
  const apiAuthError = backendState === 'unauthenticated';

  /** A rejected token is an authentication problem, not a broken backend — say so. */
  const blocked = (what: string) => {
    if (apiAuthError) {
      return flash(`${what} failed — the admin token was rejected (401). Set a valid token; nothing was written to the database.`);
    }
    flash(`${what} failed — the backend is not reachable. Nothing was written to the database.`);
  };
  const failure = (what: string, e: any) => {
    if (e?.status === 401 || e?.status === 403) {
      setBackendState('unauthenticated');
      return flash(`${what} failed — the admin token was rejected (401). Nothing was written to the database.`);
    }
    flash(`${what} failed — ${e?.message ?? 'API error'}. Nothing was written to the database.`);
  };

  const value = useMemo<AdminStore>(
    () => ({
      lectures,
      books,
      scholars,
      subjects,
      activity,
      notice,
      apiOnline,
      apiAuthError,
      backendState,
      loading,
      totals,
      clearNotice: () => setNotice(null),
      flash,
      refresh,
      upsertLecture: (item, verb) => {
        const isNew = !lectures.find((x) => x.id === item.id);
        if (!apiOnline) return blocked('Saving');
        const before = lectures;
        // Optimistic list update only. The activity feed is written after the database confirmed it.
        setLectures((prev) => {
          const i = prev.findIndex((x) => x.id === item.id);
          if (i === -1) return [item, ...prev];
          const next = [...prev];
          next[i] = item;
          return next;
        });
        (async () => {
          try {
            const payload = api.adminLectureToPayload(item);
            if (isNew) {
              await api.createContent(payload);
              flash('Lecture saved to database.');
            } else {
              await api.patchContent(item.id, { ...payload, title: item.title });
              flash('Lecture updated in database.');
            }
            push(log(verb, 'lecture', item.title));
            await refresh();
          } catch (e: any) {
            setLectures(before);
            failure(isNew ? 'Saving' : 'Updating', e);
          }
        })();
      },
      deleteLecture: (id) => {
        if (!apiOnline) return blocked('Deleting');
        const item = lectures.find((x) => x.id === id);
        const before = lectures;
        setLectures((prev) => prev.filter((x) => x.id !== id));
        api
          .deleteContent(id, true)
          .then(async () => {
            if (item) push(log('Removed', 'lecture', item.title));
            flash('Lecture removed.');
            await refresh();
          })
          .catch((e: any) => {
            setLectures(before);
            failure('Deleting', e);
          });
      },
      setLectureStatus: (id, status) => {
        if (!apiOnline) return blocked('Changing the status');
        const item = lectures.find((x) => x.id === id);
        const before = lectures;
        setLectures((prev) => prev.map((x) => (x.id === id ? { ...x, status, updatedAt: todayStamp() } : x)));
        const { verb, message } = statusChange('Lecture', status, item?.status);
        const confirmed = async () => {
          if (item) push(log(verb, 'lecture', item.title));
          flash(message);
          await refresh();
        };
        statusRequest(id, status, item?.status)
          .then(confirmed)
          .catch(async () => {
            try {
              await api.patchContent(id, { status });
              await confirmed();
            } catch (e: any) {
              setLectures(before);
              failure('Changing the status', e);
            }
          });
      },
      upsertBook: (item, verb) => {
        const isNew = !books.find((x) => x.id === item.id);
        if (!apiOnline) return blocked('Saving');
        const before = books;
        setBooks((prev) => {
          const i = prev.findIndex((x) => x.id === item.id);
          if (i === -1) return [item, ...prev];
          const next = [...prev];
          next[i] = item;
          return next;
        });
        (async () => {
          try {
            const payload = api.adminBookToPayload(item);
            if (isNew) {
              await api.createContent(payload);
              flash('Book saved to database.');
            } else {
              await api.patchContent(item.id, { ...payload, title: item.title });
              flash('Book updated in database.');
            }
            push(log(verb, 'book', item.title));
            await refresh();
          } catch (e: any) {
            setBooks(before);
            failure(isNew ? 'Saving' : 'Updating', e);
          }
        })();
      },
      deleteBook: (id) => {
        if (!apiOnline) return blocked('Deleting');
        const item = books.find((x) => x.id === id);
        const before = books;
        setBooks((prev) => prev.filter((x) => x.id !== id));
        api
          .deleteContent(id, true)
          .then(async () => {
            if (item) push(log('Removed', 'book', item.title));
            flash('Book removed.');
            await refresh();
          })
          .catch((e: any) => {
            setBooks(before);
            failure('Deleting', e);
          });
      },
      setBookStatus: (id, status) => {
        if (!apiOnline) return blocked('Changing the status');
        const item = books.find((x) => x.id === id);
        const before = books;
        setBooks((prev) => prev.map((x) => (x.id === id ? { ...x, status, updatedAt: todayStamp() } : x)));
        const { verb, message } = statusChange('Book', status, item?.status);
        const confirmed = async () => {
          if (item) push(log(verb, 'book', item.title));
          flash(message);
          await refresh();
        };
        statusRequest(id, status, item?.status)
          .then(confirmed)
          .catch(async () => {
            try {
              await api.patchContent(id, { status });
              await confirmed();
            } catch (e: any) {
              setBooks(before);
              failure('Changing the status', e);
            }
          });
      },
      upsertScholar: (item, verb) => {
        const isNew = !scholars.find((x) => x.id === item.id);
        if (!apiOnline) return blocked('Saving');
        const before = scholars;
        setScholars((prev) => {
          const i = prev.findIndex((x) => x.id === item.id);
          if (i === -1) return [item, ...prev];
          const next = [...prev];
          next[i] = item;
          return next;
        });
        (async () => {
          try {
            const payload = { name: item.name, bio: item.bio, accent: item.accent, specialtyId: item.specialtyId || null };
            if (isNew) {
              await api.createScholar(payload);
              flash('Scholar saved to database.');
            } else {
              await api.patchScholar(item.id, payload);
              flash('Scholar updated in database.');
            }
            push(log(verb, 'scholar', item.name));
            await refresh();
          } catch (e: any) {
            setScholars(before);
            failure(isNew ? 'Saving' : 'Updating', e);
          }
        })();
      },
      deleteScholar: (id) => {
        if (!apiOnline) return blocked('Deleting');
        const item = scholars.find((x) => x.id === id);
        const before = scholars;
        setScholars((prev) => prev.filter((x) => x.id !== id));
        api
          .deleteScholar(id)
          .then(async () => {
            if (item) push(log('Removed', 'scholar', item.name));
            flash('Scholar removed.');
            await refresh();
          })
          .catch((e: any) => {
            setScholars(before);
            failure('Deleting', e);
          });
      },
      setScholarStatus: (id, status) => {
        if (!apiOnline) return blocked('Changing the status');
        const item = scholars.find((x) => x.id === id);
        const before = scholars;
        setScholars((prev) => prev.map((x) => (x.id === id ? { ...x, status, updatedAt: todayStamp() } : x)));
        const verb: Activity['verb'] = status === 'published' ? 'Published' : 'Unpublished';
        api
          .patchScholar(id, { status })
          .then(async () => {
            if (item) push(log(verb, 'scholar', item.name));
            flash(status === 'published' ? 'Scholar published.' : 'Scholar unpublished.');
            await refresh();
          })
          .catch((e: any) => {
            setScholars(before);
            failure('Changing the status', e);
          });
      },
      upsertSubject: (item, verb) => {
        const isNew = !subjects.find((x) => x.id === item.id);
        if (!apiOnline) return blocked('Saving');
        const before = subjects;
        setSubjects((prev) => {
          const i = prev.findIndex((x) => x.id === item.id);
          if (i === -1) return [item, ...prev];
          const next = [...prev];
          next[i] = item;
          return next;
        });
        (async () => {
          try {
            const payload = { name: item.name, group: item.group, description: item.description, accent: item.accent };
            if (isNew) {
              await api.createSubject(payload);
              flash('Subject saved to database.');
            } else {
              await api.patchSubject(item.id, payload);
              flash('Subject updated in database.');
            }
            push(log(verb, 'subject', item.name));
            await refresh();
          } catch (e: any) {
            setSubjects(before);
            failure(isNew ? 'Saving' : 'Updating', e);
          }
        })();
      },
      deleteSubject: (id) => {
        if (!apiOnline) return blocked('Deleting');
        const item = subjects.find((x) => x.id === id);
        const before = subjects;
        setSubjects((prev) => prev.filter((x) => x.id !== id));
        api
          .deleteSubject(id)
          .then(async () => {
            if (item) push(log('Removed', 'subject', item.name));
            flash('Subject removed.');
            await refresh();
          })
          .catch((e: any) => {
            setSubjects(before);
            failure('Deleting', e);
          });
      },
      setSubjectStatus: (id, status) => {
        if (!apiOnline) return blocked('Changing the status');
        const item = subjects.find((x) => x.id === id);
        const before = subjects;
        setSubjects((prev) => prev.map((x) => (x.id === id ? { ...x, status, updatedAt: todayStamp() } : x)));
        const verb: Activity['verb'] = status === 'published' ? 'Published' : 'Unpublished';
        api
          .patchSubject(id, { status })
          .then(async () => {
            if (item) push(log(verb, 'subject', item.name));
            flash(status === 'published' ? 'Subject published.' : 'Subject unpublished.');
            await refresh();
          })
          .catch((e: any) => {
            setSubjects(before);
            failure('Changing the status', e);
          });
      },
    }),
    [lectures, books, scholars, subjects, activity, notice, apiOnline, apiAuthError, backendState, loading, totals]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdmin() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
