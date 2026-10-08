import { Hero } from "@/components/marketing/Hero";
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
      <HowItWorks />
      <RoleShowcase />
      <FeaturesBento />
      <ReliabilityBand />
      <CtaFooter />
    </>
  );
}
