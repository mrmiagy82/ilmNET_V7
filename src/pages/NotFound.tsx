import { Link, useLocation } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { usePageMeta } from '../lib/usePageMeta';

/**
 * 404 for routes that do not exist (Fase 5.5).
 *
 * Before this, `path="*"` rendered the landing page, so a mistyped URL (or a broken external link)
 * showed a normal-looking home page with the wrong address in the bar and a 200-equivalent signal
 * to anyone reading it. The layout, colours and neumorphic surfaces are the ones already used by
 * the "content not found" state on the detail pages — no new visual language.
 */
export default function NotFound() {
  const { pathname } = useLocation();
  usePageMeta({
    title: 'Page not found',
    description: 'This address does not exist on ilmNet. Browse lectures, books, scholars or subjects instead.',
    path: pathname,
    noindex: true,
  });

  const links: { to: string; label: string }[] = [
    { to: '/lectures', label: 'Lectures' },
    { to: '/books', label: 'Books' },
    { to: '/scholars', label: 'Scholars' },
    { to: '/subjects', label: 'Subjects' },
  ];

  return (
    <>
      <PageHeader
        eyebrow="404"
        title="This page is not here"
        intro="The address you opened does not exist — it may have been mistyped, or the item may have been unpublished. The library itself is one tap away."
      />

      <section className="px-5 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-[860px]">
          <div className="bg-cream neu-raised rounded-[24px] p-8 text-center">
            <p className="text-ink-muted break-all font-mono text-[0.8rem]">{pathname}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/" className="bg-rose text-cream rounded-full px-6 py-3 text-[0.9rem] font-semibold">
                Home
              </Link>
              {links.map((l) => (
                <Link key={l.to} to={l.to} className="bg-sand text-ink hover:text-rose rounded-full px-6 py-3 text-[0.9rem] font-semibold">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
