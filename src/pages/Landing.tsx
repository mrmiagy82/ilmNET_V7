import Hero from '../components/Hero';
import Library from '../components/Library';
import Subjects from '../components/Subjects';
import { HowItWorks, FinalCTA } from '../components/Closing';

export default function Landing() {
  return (
    <>
      <Hero />
      <Library />
      <Subjects />
      <HowItWorks />
      <FinalCTA />
    </>
  );
}
