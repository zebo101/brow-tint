import { ComponentType } from 'react';
import {
  Activity,
  BookOpenText,
  Box,
  Brain,
  Coins,
  CreditCard,
  DollarSign,
  FileText,
  Folder,
  Github,
  HelpCircle,
  History,
  Home,
  Key,
  Mail,
  MessageCircle,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  Zap,
} from 'lucide-react';
import {
  RiCameraLensLine,
  RiChat2Line,
  RiDiscordFill,
  RiExchangeLine,
  RiHdLine,
  RiImage2Line,
  RiKeyLine,
  RiLock2Line,
  RiMagicLine,
  RiMessage2Line,
  RiPaletteLine,
  RiQuestionLine,
  RiRobot2Line,
  RiScissorsCutLine,
  RiShoppingCartLine,
  RiSmartphoneLine,
  RiSpeedLine,
  RiTaskLine,
  RiTwitterXFill,
  RiUserSmileLine,
  RiVipCrownLine,
  RiWomenLine,
} from 'react-icons/ri';

// Static maps of all icons referenced by name across `src/config/locale/messages/**`.
// The previous implementation used `lazy(() => import('react-icons/ri'))` which made
// the bundler emit the ENTIRE Remix Icon set (~440 KiB unused) as a separate chunk
// even though only ~22 icons are used. Static named imports + a lookup table let
// the bundler tree-shake everything down to just the icons listed below.
//
// To add a new icon: add the import and a matching entry to the map.
//
// Known dangling reference: locale JSON uses `RiCompareLine` which doesn't
// exist in react-icons@5.5.0 (closest: `RiArrowLeftRightLine`,
// `RiContrastLine`). The old dynamic implementation silently fell back to
// `RiQuestionLine` for missing names — current site renders a "?" for that
// feature card. Map lookup keeps the same fallback behavior, so visuals are
// preserved. Fix the JSON when you're ready to choose a real icon.
const RI_MAP: Record<string, ComponentType<any>> = {
  RiCameraLensLine,
  RiChat2Line,
  RiDiscordFill,
  RiExchangeLine,
  RiHdLine,
  RiImage2Line,
  RiKeyLine,
  RiLock2Line,
  RiMagicLine,
  RiMessage2Line,
  RiPaletteLine,
  RiRobot2Line,
  RiScissorsCutLine,
  RiShoppingCartLine,
  RiSmartphoneLine,
  RiSpeedLine,
  RiTaskLine,
  RiTwitterXFill,
  RiUserSmileLine,
  RiVipCrownLine,
  RiWomenLine,
  RiQuestionLine,
};

const LUCIDE_MAP: Record<string, ComponentType<any>> = {
  Activity,
  BookOpenText,
  Box,
  Brain,
  Coins,
  CreditCard,
  DollarSign,
  FileText,
  Folder,
  Github,
  History,
  Home,
  Key,
  Mail,
  MessageCircle,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  Zap,
  HelpCircle,
};

function detectIconLibrary(name: string): 'ri' | 'lucide' {
  if (name && name.startsWith('Ri')) {
    return 'ri';
  }
  return 'lucide';
}

export function SmartIcon({
  name,
  size = 24,
  className,
  ...props
}: {
  name: string;
  size?: number;
  className?: string;
  [key: string]: any;
}) {
  const library = detectIconLibrary(name);

  const IconComponent =
    library === 'ri'
      ? (RI_MAP[name] ?? RiQuestionLine)
      : (LUCIDE_MAP[name] ?? HelpCircle);

  return <IconComponent size={size} className={className} {...props} />;
}
