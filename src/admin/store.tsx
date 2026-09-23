import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  seedActivity,
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

interface AdminStore {
  lectures: AdminLecture[];
  books: AdminBook[];
  scholars: AdminScholar[];
  subjects: AdminSubject[];
  activity: Activity[];
  notice: string | null;
  apiOnline: boolean;
  loading: boolean;
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
    status: (s.status === 'published' ? 'published' : 'draft') as PublishStatus,
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
    status: (s.status === 'published' ? 'published' : 'draft') as PublishStatus,
    updatedAt: new Date(s.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
  };
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [lectures, setLectures] = useState<AdminLecture[]>([]);
  const [books, setBooks] = useState<AdminBook[]>([]);
  const [scholars, setScholars] = useState<AdminScholar[]>([]);
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [activity, setActivity] = useState<Activity[]>(seedActivity);
  const [notice, setNotice] = useState<string | null>(null);
  const [apiOnline, setApiOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  const push = (entry: Activity) => setActivity((prev) => [entry, ...prev].slice(0, 14));
  const flash = (msg: string) => setNotice(msg);

  const refresh = async () => {
    try {
      const [schRes, subRes, contRes] = await Promise.all([
        api.listAdminScholars().catch(() => null),
        api.listAdminSubjects().catch(() => null),
        api.listAdminContents({ limit: 100 }).catch(() => null),
      ]);
      if (schRes && subRes && contRes) {
        // map scholars/subjects
        setScholars(schRes.data.map(toAdminScholar));
        setSubjects(subRes.data.map(toAdminSubject));
        const all = contRes.data as api.BackendContent[];
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
        setApiOnline(true);
      } else {
        setApiOnline(false);
      }
    } catch {
      setApiOnline(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // only once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // wrappers removed — direct API calls handle fallback per action

  const value = useMemo<AdminStore>(
    () => ({
      lectures,
      books,
      scholars,
      subjects,
      activity,
      notice,
      apiOnline,
      loading,
      clearNotice: () => setNotice(null),
      flash,
      refresh,
      upsertLecture: (item, verb) => {
        // optimistic local first
        const isNew = !lectures.find((x) => x.id === item.id);
        const doLocal = () => {
          setLectures((prev) => {
            const i = prev.findIndex((x) => x.id === item.id);
            if (i === -1) return [item, ...prev];
            const next = [...prev];
            next[i] = item;
            return next;
          });
          push(log(verb, 'lecture', item.title));
          flash(verb === 'Added' ? 'Lecture saved.' : 'Lecture updated.');
        };
        if (apiOnline) {
          (async () => {
            try {
              const payload = api.adminLectureToPayload(item);
              if (isNew) {
                await api.createContent(payload);
                push(log('Added', 'lecture', item.title));
                flash('Lecture saved to database.');
              } else {
                await api.patchContent(item.id, { ...payload, title: item.title });
                push(log('Updated', 'lecture', item.title));
                flash('Lecture updated in database.');
              }
              await refresh();
            } catch (e: any) {
              doLocal();
              flash(e.message ?? 'API error — saved locally.');
            }
          })();
          // optimistic also?
          doLocal();
        } else {
          doLocal();
        }
      },
      deleteLecture: (id) => {
        const item = lectures.find((x) => x.id === id);
        setLectures((prev) => prev.filter((x) => x.id !== id));
        if (item) push(log('Removed', 'lecture', item.title));
        flash('Lecture removed.');
        if (apiOnline) {
          api.deleteContent(id, true).then(() => refresh()).catch(() => {});
        }
      },
      setLectureStatus: (id, status) => {
        const item = lectures.find((x) => x.id === id);
        setLectures((prev) => prev.map((x) => (x.id === id ? { ...x, status, updatedAt: todayStamp() } : x)));
        if (item) {
          push(log(status === 'published' ? 'Published' : 'Unpublished', 'lecture', item.title));
          flash(status === 'published' ? 'Lecture published.' : 'Lecture unpublished.');
        }
        if (apiOnline) {
          const fn = status === 'published' ? api.publishContent : api.unpublishContent;
          fn(id).then(() => refresh()).catch(async () => {
            // fallback via patch
            await api.patchContent(id, { status }).catch(() => {});
            await refresh();
          });
        }
      },
      upsertBook: (item, verb) => {
        const isNew = !books.find((x) => x.id === item.id);
        const doLocal = () => {
          setBooks((prev) => {
            const i = prev.findIndex((x) => x.id === item.id);
            if (i === -1) return [item, ...prev];
            const next = [...prev];
            next[i] = item;
            return next;
          });
          push(log(verb, 'book', item.title));
          flash(verb === 'Added' ? 'Book saved.' : 'Book updated.');
        };
        if (apiOnline) {
          (async () => {
            try {
              const payload = api.adminBookToPayload(item);
              if (isNew) {
                await api.createContent(payload);
                push(log('Added', 'book', item.title));
                flash('Book saved to database.');
              } else {
                await api.patchContent(item.id, { ...payload, title: item.title });
                push(log('Updated', 'book', item.title));
                flash('Book updated in database.');
              }
              await refresh();
            } catch (e: any) {
              doLocal();
              flash(e.message ?? 'API error — saved locally.');
            }
          })();
          doLocal();
        } else {
          doLocal();
        }
      },
      deleteBook: (id) => {
        const item = books.find((x) => x.id === id);
        setBooks((prev) => prev.filter((x) => x.id !== id));
        if (item) push(log('Removed', 'book', item.title));
        flash('Book removed.');
        if (apiOnline) api.deleteContent(id, true).then(() => refresh()).catch(() => {});
      },
      setBookStatus: (id, status) => {
        const item = books.find((x) => x.id === id);
        setBooks((prev) => prev.map((x) => (x.id === id ? { ...x, status, updatedAt: todayStamp() } : x)));
        if (item) {
          push(log(status === 'published' ? 'Published' : 'Unpublished', 'book', item.title));
          flash(status === 'published' ? 'Book published.' : 'Book unpublished.');
        }
        if (apiOnline) {
          const fn = status === 'published' ? api.publishContent : api.unpublishContent;
          fn(id).then(() => refresh()).catch(async () => {
            await api.patchContent(id, { status }).catch(() => {});
            await refresh();
          });
        }
      },
      upsertScholar: (item, verb) => {
        const isNew = !scholars.find((x) => x.id === item.id);
        const doLocal = () => {
          setScholars((prev) => {
            const i = prev.findIndex((x) => x.id === item.id);
            if (i === -1) return [item, ...prev];
            const next = [...prev];
            next[i] = item;
            return next;
          });
          push(log(verb, 'scholar', item.name));
          flash(verb === 'Added' ? 'Scholar saved.' : 'Scholar updated.');
        };
        if (apiOnline) {
          (async () => {
            try {
              if (isNew) {
                await api.createScholar({ name: item.name, bio: item.bio, accent: item.accent, specialtyId: item.specialtyId || null });
                flash('Scholar saved to database.');
              } else {
                await api.patchScholar(item.id, { name: item.name, bio: item.bio, accent: item.accent, specialtyId: item.specialtyId || null });
                flash('Scholar updated in database.');
              }
              push(log(verb, 'scholar', item.name));
              await refresh();
            } catch (e: any) {
              doLocal();
              flash(e.message ?? 'API error');
            }
          })();
          if (!isNew) doLocal(); // optimistic for edit
        } else {
          doLocal();
        }
      },
      deleteScholar: (id) => {
        const item = scholars.find((x) => x.id === id);
        setScholars((prev) => prev.filter((x) => x.id !== id));
        if (item) push(log('Removed', 'scholar', item.name));
        flash('Scholar removed.');
        if (apiOnline) api.deleteScholar(id).then(() => refresh()).catch(() => {});
      },
      setScholarStatus: (id, status) => {
        const item = scholars.find((x) => x.id === id);
        setScholars((prev) => prev.map((x) => (x.id === id ? { ...x, status, updatedAt: todayStamp() } : x)));
        if (item) {
          push(log(status === 'published' ? 'Published' : 'Unpublished', 'scholar', item.name));
          flash(status === 'published' ? 'Scholar published.' : 'Scholar unpublished.');
        }
        if (apiOnline) api.patchScholar(id, { status }).then(() => refresh()).catch(() => {});
      },
      upsertSubject: (item, verb) => {
        const isNew = !subjects.find((x) => x.id === item.id);
        const doLocal = () => {
          setSubjects((prev) => {
            const i = prev.findIndex((x) => x.id === item.id);
            if (i === -1) return [item, ...prev];
            const next = [...prev];
            next[i] = item;
            return next;
          });
          push(log(verb, 'subject', item.name));
          flash(verb === 'Added' ? 'Subject saved.' : 'Subject updated.');
        };
        if (apiOnline) {
          (async () => {
            try {
              if (isNew) {
                await api.createSubject({ name: item.name, group: item.group, description: item.description, accent: item.accent });
                flash('Subject saved to database.');
              } else {
                await api.patchSubject(item.id, { name: item.name, group: item.group, description: item.description, accent: item.accent });
                flash('Subject updated in database.');
              }
              push(log(verb, 'subject', item.name));
              await refresh();
            } catch (e: any) {
              doLocal();
              flash(e.message ?? 'API error');
            }
          })();
          if (!isNew) doLocal();
        } else {
          doLocal();
        }
      },
      deleteSubject: (id) => {
        const item = subjects.find((x) => x.id === id);
        setSubjects((prev) => prev.filter((x) => x.id !== id));
        if (item) push(log('Removed', 'subject', item.name));
        flash('Subject removed.');
        if (apiOnline) api.deleteSubject(id).then(() => refresh()).catch(() => {});
      },
      setSubjectStatus: (id, status) => {
        const item = subjects.find((x) => x.id === id);
        setSubjects((prev) => prev.map((x) => (x.id === id ? { ...x, status, updatedAt: todayStamp() } : x)));
        if (item) {
          push(log(status === 'published' ? 'Published' : 'Unpublished', 'subject', item.name));
          flash(status === 'published' ? 'Subject published.' : 'Subject unpublished.');
        }
        if (apiOnline) api.patchSubject(id, { status }).then(() => refresh()).catch(() => {});
      },
    }),
    [lectures, books, scholars, subjects, activity, notice, apiOnline, loading]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdmin() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
