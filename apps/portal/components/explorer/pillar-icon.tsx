import {
  ChartColumnIcon,
  CircleIcon,
  GraduationCapIcon,
  LandmarkIcon,
  LeafIcon,
  RadioTowerIcon,
  ShieldIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

// Pillar icons come from the API as names; unknown names get a neutral dot.
const ICONS: Record<string, LucideIcon> = {
  antenna: RadioTowerIcon,
  users: UsersIcon,
  chart: ChartColumnIcon,
  wallet: WalletIcon,
  graduation: GraduationCapIcon,
  shield: ShieldIcon,
  landmark: LandmarkIcon,
  leaf: LeafIcon,
};

export function PillarIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? CircleIcon;
  return <Icon aria-hidden className={className} />;
}
