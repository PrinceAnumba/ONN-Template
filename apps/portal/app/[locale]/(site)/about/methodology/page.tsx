import { CmsPageView, cmsMetadata } from "@/components/cms/cms-page";

export const generateMetadata = () => cmsMetadata("methodology");

export default function MethodologyPage() {
  return <CmsPageView slug="methodology" section="about" />;
}
