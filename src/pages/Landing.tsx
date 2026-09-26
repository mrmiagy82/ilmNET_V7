import Hero from '../components/Hero';
import { usePageMeta } from '../lib/usePageMeta';
import Library from '../components/Library';
import Subjects from '../components/Subjects';
import { HowItWorks, FinalCTA } from '../components/Closing';
import { ListenRail, NewInLibrary, ReadRail, ScholarRail } from '../components/LandingRails';

export default function Landing() {
  // Fase 5.5: keeps the tab/OG title right after navigating back from a detail page (index.html
  // only supplies it on the very first load).
  usePageMeta({
    title: 'ilmNet — A quiet library for Islamic knowledge',
    description:
      'Lectures, books and scholarship in one calm, carefully organised library — arranged by scholar, subject and series. Free, no login, always linked to the original source.',
    path: '/',
  });

  // Discovery step D1: the landing page answers four real questions with real content before it
  // explains itself — what is new, what can I listen to, what can I read, and who teaches it. Every
  // rail hides itself when its own request fails or returns nothing, so a broken section never leaves
  // an empty band (and never a 0 that looks like an empty library).
  // Order: content first, then the "three ways to seek" explainer, then the two shelf rails, the
  // subject pills and the scholars. Each rail is its own API question; none of them invents a number.
  return (
    <>
      <Hero />
      <NewInLibrary />
      <Library />
      <ListenRail />
      <ReadRail />
      <Subjects />
      <ScholarRail />
      <HowItWorks />
      <FinalCTA />
    </>
  );
}
