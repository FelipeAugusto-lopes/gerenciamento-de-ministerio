export interface Ministry {
  id: string;
  name: string;
  colorIndex: number;
}

export interface Member {
  id: string;
  name: string;
  phone?: string;
  ministryIds: string[];
  unavailableDates: string[]; // ISO dates the member cannot serve
  createdAt?: string; // ISO datetime of registration
}

export type Shift = "Manhã" | "Noite";
export type ScheduleStatus = "Pendente" | "Confirmado" | "Recusado" | "Concluído";

export interface Schedule {
  id: string;
  ministryId: string;
  date: string; // ISO date
  shift: Shift;
  memberIds: string[];
  status: ScheduleStatus;
}

export interface Notification {
  id: string;
  memberId: string;
  scheduleId: string;
  message: string;
  createdAt: string; // ISO datetime
  read: boolean;
}

export type UserRole = "admin" | "leader";

export interface AppUser {
  id: string;
  name: string;
  role: UserRole;
  ministryId?: string;
  password: string;
}

export const MINISTRY_COLORS = [
  "152 45% 28%",
  "38 80% 55%",
  "210 60% 50%",
  "340 65% 50%",
  "270 50% 55%",
  "180 50% 40%",
  "25 75% 50%",
  "95 45% 42%",
  "0 65% 55%",
  "220 55% 60%",
  "45 80% 48%",
];

export const DEFAULT_MINISTRIES: Ministry[] = [
  { id: "1", name: "Voluntariado", colorIndex: 0 },
  { id: "2", name: "Louvor", colorIndex: 1 },
  { id: "3", name: "Áudio", colorIndex: 2 },
  { id: "4", name: "Mídia Story", colorIndex: 3 },
  { id: "5", name: "Mídia Fotos", colorIndex: 4 },
  { id: "6", name: "Projeção", colorIndex: 5 },
  { id: "7", name: "Transmissão", colorIndex: 6 },
  { id: "8", name: "Berçário", colorIndex: 7 },
  { id: "9", name: "INA Kids 3-6", colorIndex: 8 },
  { id: "10", name: "INA Kids 7-8", colorIndex: 9 },
  { id: "11", name: "INA Kids 9-12", colorIndex: 10 },
];

export const DEFAULT_USERS: AppUser[] = [
  { id: "admin-1", name: "Administrador", role: "admin", password: "admin123" },
];
