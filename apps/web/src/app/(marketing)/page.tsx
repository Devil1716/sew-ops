import { Hero } from "@/components/marketing/Hero";
import FloorCarousel from "@/components/marketing/FloorCarousel";
import {
  CtaFooter,
  FeaturesBento,
  HowItWorks,
  ProblemStrip,
  ReliabilityBand,
  RoleShowcase,
} from "@/components/marketing/Sections";

export default function MarketingHomePage() {
  return (
    <>
      <Hero />
      <ProblemStrip />
      <FloorCarousel />
      <HowItWorks />
      <RoleShowcase />
      <FeaturesBento />
      <ReliabilityBand />
      <CtaFooter />
    </>
  );
}
