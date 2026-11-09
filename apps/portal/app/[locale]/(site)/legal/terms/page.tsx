import { CmsPageView, cmsMetadata } from "@/components/cms/cms-page";

export const generateMetadata = () => cmsMetadata("terms");

export default function TermsPage() {
  return <CmsPageView slug="terms" />;
}
