/**
 * Agrupamento visual da Mídia.
 * Não altera o banco: o id e o nome originais continuam no registro.
 * Só estes seis nomes entram no ministério visual. Os demais ficam como estão.
 */
const MEDIA_FUNCTIONS = [
  { name: "Mídia Fotos", functionName: "Fotos" },
  { name: "Mídia Story", functionName: "Story" },
  { name: "Mídia Fotos e Story", functionName: "Fotos e Story" },
  { name: "Mídia Reels", functionName: "Reels" },
  { name: "Projeção", functionName: "Projeção" },
  { name: "Transmissão", functionName: "Transmissão" },
] as const;

export const VISUAL_MEDIA_ID = "visual:midia";
export const VISUAL_MEDIA_NAME = "Mídia";

export interface VisualMinistry {
  ministryId: string;
  visualId: string;
  visualName: string;
  functionName: string | null;
  originalName: string;
  grouped: boolean;
}

function normalizeMinistryName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const mediaByName = new Map(
  MEDIA_FUNCTIONS.map((item, index) => [normalizeMinistryName(item.name), { ...item, index }]),
);

export function mediaFunctionIndex(name: string): number {
  return mediaByName.get(normalizeMinistryName(name))?.index ?? 999;
}

export function isMediaMinistryName(name: string): boolean {
  return mediaByName.has(normalizeMinistryName(name));
}

/** Ministério visual, função e registro original. Não consulta o banco. */
export function getVisualMinistry(ministry: { id: string; name: string }): VisualMinistry {
  const spec = mediaByName.get(normalizeMinistryName(ministry.name));
  if (!spec) {
    return {
      ministryId: ministry.id,
      visualId: ministry.id,
      visualName: ministry.name,
      functionName: null,
      originalName: ministry.name,
      grouped: false,
    };
  }
  return {
    ministryId: ministry.id,
    visualId: VISUAL_MEDIA_ID,
    visualName: VISUAL_MEDIA_NAME,
    functionName: spec.functionName,
    originalName: ministry.name,
    grouped: true,
  };
}

export function scheduleBelongsToMinistryFilter(
  ministry: { id: string; name: string } | undefined,
  filterId: string,
): boolean {
  if (filterId === "all") return true;
  if (!ministry) return false;
  if (filterId === VISUAL_MEDIA_ID) return isMediaMinistryName(ministry.name);
  return ministry.id === filterId;
}

export interface VisualMinistryOption {
  id: string;
  name: string;
  colorIndex: number;
  iconName: string;
}

/**
 * Opções do filtro visual. A Mídia aparece uma vez e guarda a cor de um registro já cadastrado.
 * A ordem entre os demais ministérios continua sendo a ordem do sistema.
 */
export function listVisualMinistries<T extends { id: string; name: string; colorIndex: number }>(
  ministries: readonly T[],
  orderOf: (name: string) => number,
): VisualMinistryOption[] {
  const sorted = [...ministries].sort((a, b) => orderOf(a.name) - orderOf(b.name) || a.name.localeCompare(b.name, "pt-BR"));
  const options: VisualMinistryOption[] = [];
  let mediaPlaced = false;
  for (const ministry of sorted) {
    if (isMediaMinistryName(ministry.name)) {
      if (mediaPlaced) continue;
      mediaPlaced = true;
      options.push({
        id: VISUAL_MEDIA_ID,
        name: VISUAL_MEDIA_NAME,
        colorIndex: visualMediaColorIndex(ministries) ?? ministry.colorIndex,
        iconName: VISUAL_MEDIA_NAME,
      });
      continue;
    }
    options.push({
      id: ministry.id,
      name: ministry.name,
      colorIndex: ministry.colorIndex,
      iconName: ministry.name,
    });
  }
  return options;
}

/** Cor já cadastrada de um dos registros da Mídia, na ordem explícita do agrupamento. */
export function visualMediaColorIndex(ministries: readonly { name: string; colorIndex: number }[]): number | null {
  for (const spec of MEDIA_FUNCTIONS) {
    const found = ministries.find(ministry => normalizeMinistryName(ministry.name) === normalizeMinistryName(spec.name));
    if (found) return found.colorIndex;
  }
  return null;
}
