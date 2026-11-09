import { CmsPageView, cmsMetadata } from "@/components/cms/cms-page";

export const generateMetadata = () => cmsMetadata("accessibility");

export default function AccessibilityPage() {
  return <CmsPageView slug="accessibility" />;
}
