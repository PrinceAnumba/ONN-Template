import { CmsPageView, cmsMetadata } from "@/components/cms/cms-page";

export const generateMetadata = () => cmsMetadata("partners");

export default function PartnersPage() {
  return <CmsPageView slug="partners" section="about" />;
}
