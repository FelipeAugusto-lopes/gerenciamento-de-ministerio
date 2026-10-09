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

const MINISTRY_ICON_MAP: Record<string, { key: string; icon: LucideIcon }> = {
  voluntariado: { key: "heart", icon: Heart },
  louvor: { key: "music", icon: Music },
  áudio: { key: "headphones", icon: Headphones },
  mídia: { key: "camera", icon: Camera },
  "mídia story": { key: "book-image", icon: BookImage },
  "mídia fotos": { key: "camera", icon: Camera },
  projeção: { key: "monitor", icon: Monitor },
  transmissão: { key: "radio", icon: Radio },
  berçário: { key: "baby", icon: Baby },
  "ina kids 3-6": { key: "smile", icon: Smile },
  "ina kids 7-8": { key: "star", icon: Star },
  "ina kids 9-12": { key: "sparkles", icon: Sparkles },
};

/** Chave estável do ícone, sem componente visual. Ministérios sem ícone próprio usam "church". */
export function getMinistryIconKey(name: string): string {
  return MINISTRY_ICON_MAP[name.toLowerCase()]?.key || "church";
}

export function getMinistryIcon(name: string): LucideIcon {
  return MINISTRY_ICON_MAP[name.toLowerCase()]?.icon || Church;
}
