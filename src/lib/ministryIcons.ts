import {
  Heart,
  Music,
  Headphones,
  BookImage,
  Camera,
  Monitor,
  Radio,
  Baby,
  Smile,
  Star,
  Sparkles,
  Church,
  type LucideIcon,
} from "lucide-react";

const MINISTRY_ICON_MAP: Record<string, LucideIcon> = {
  voluntariado: Heart,
  louvor: Music,
  áudio: Headphones,
  "mídia story": BookImage,
  "mídia fotos": Camera,
  projeção: Monitor,
  transmissão: Radio,
  berçário: Baby,
  "ina kids 3-6": Smile,
  "ina kids 7-8": Star,
  "ina kids 9-12": Sparkles,
};

export function getMinistryIcon(name: string): LucideIcon {
  return MINISTRY_ICON_MAP[name.toLowerCase()] || Church;
}
