// Cópia do motor de regras do app (src/data/types.ts). Não edite aqui: altere no app e copie de novo.
// Modelo de dados local do Família Feliz.
// Espelha os conceitos da API documentada (families, tasks/assignments, scoring,
// rewards/wallet, allowances, growth, notifications), simplificado para rodar no aparelho.

export type ID = string;
export type ISO = string; // data/hora ISO 8601

export type Role = 'ADMIN' | 'GUARDIAN' | 'MEMBER';
export type MembershipStatus = 'ACTIVE' | 'INACTIVE';

export interface User {
  id: ID;
  name: string;
  email: string; // normalizado (trim + minúsculas)
  passwordHash: string;
  createdAt: ISO;
}

export interface Family {
  id: ID;
  name: string;
  timezone: string;
  createdAt: ISO;
}

export interface Member {
  id: ID;
  familyId: ID;
  userId: ID;
  displayName: string;
  nickname?: string;
  role: Role;
  status: MembershipStatus;
  canManage: boolean;
  canApprove: boolean;
  tone: number;
  birthYear?: number;
  joinedAt: ISO;
}

export interface Invitation {
  id: ID;
  familyId: ID;
  code: string;
  role: Exclude<Role, 'ADMIN'>;
  maxUses: number;
  uses: number;
  expiresAt: ISO;
  revokedAt?: ISO;
  createdBy: ID; // memberId
  createdAt: ISO;
}

export type Recurrence = 'NONE' | 'DAILY' | 'WEEKLY';

export interface Task {
  id: ID;
  familyId: ID;
  title: string;
  description?: string;
  points: number;
  recurrence: Recurrence;
  weekdays: number[]; // 0 = domingo … 6 = sábado (WEEKLY)
  startDate: string; // AAAA-MM-DD
  endDate?: string;
  dueTime: string; // HH:MM
  assigneeIds: ID[]; // memberIds
  requiresApproval: boolean;
  requiresEvidence: boolean;
  essential: boolean;
  valueId?: ID;
  status: 'ACTIVE' | 'CANCELED';
  createdBy: ID;
  createdAt: ISO;
}

export type AssignmentStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'WAITING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'CANCELED';

export interface Assignment {
  id: ID;
  familyId: ID;
  taskId: ID;
  memberId: ID;
  date: string; // AAAA-MM-DD
  dueAt: ISO;
  status: AssignmentStatus;
  expectedPoints: number;
  startedAt?: ISO;
  completedAt?: ISO;
  completedLate?: boolean;
  evidenceNote?: string;
  reviewComment?: string;
  reviewedBy?: ID;
  reviewedAt?: ISO;
}

export type ScoreType = 'TASK_APPROVAL' | 'TASK_AUTO_COMPLETION' | 'MANUAL_BONUS' | 'GOAL_COMPLETION_BONUS' | 'REVERSAL';

/** Ledger histórico (score): imutável; correção por reversão compensatória. */
export interface ScoreTx {
  id: ID;
  familyId: ID;
  memberId: ID;
  amount: number;
  type: ScoreType;
  eventId: string; // idempotência
  reason?: string;
  reversesId?: ID;
  createdBy?: ID;
  createdAt: ISO;
}

export type WalletType =
  | 'ELIGIBLE_CREDIT'
  | 'REWARD_POINTS_RESERVED'
  | 'REWARD_POINTS_RELEASED'
  | 'PIGGY_BANK_CONTRIBUTION'
  | 'PIGGY_BANK_WITHDRAWAL'
  | 'REVERSAL';

/** Carteira resgatável: separada do score histórico. */
export interface WalletTx {
  id: ID;
  familyId: ID;
  memberId: ID;
  amount: number; // + entra no disponível, − sai do disponível
  type: WalletType;
  sourceId: ID;
  createdAt: ISO;
}

export interface RewardItem {
  id: ID;
  familyId: ID;
  title: string;
  description?: string;
  cost: number;
  stock: number | null; // null = ilimitado
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: ISO;
}

export type RedemptionStatus = 'RESERVED' | 'APPROVED' | 'FULFILLED' | 'REJECTED' | 'CANCELLED';

export interface Redemption {
  id: ID;
  familyId: ID;
  rewardId: ID;
  memberId: ID;
  points: number;
  status: RedemptionStatus;
  note?: string;
  createdAt: ISO;
  updatedAt: ISO;
  decidedBy?: ID;
}

export interface PiggyBank {
  id: ID;
  familyId: ID;
  memberId: ID;
  title: string;
  target: number;
  saved: number;
  status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  createdAt: ISO;
}

export type AllowanceFrequency = 'WEEKLY' | 'MONTHLY';
export type AllowancePolicy = 'PROPORTIONAL' | 'FULL_IF_MINIMUM';

export interface AllowanceConfig {
  memberId: ID;
  familyId: ID;
  baseAmount: number; // em reais
  frequency: AllowanceFrequency;
  policy: AllowancePolicy;
  minimumPercent: number; // 0–100, usado em FULL_IF_MINIMUM
  capAmount?: number;
  bonusThresholdPercent?: number;
  bonusAmount?: number;
  active: boolean;
}

export type AllowanceStatus =
  | 'OPEN'
  | 'CALCULATED'
  | 'CLOSED'
  | 'APPROVED'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'REOPENED'
  | 'CANCELLED';

export interface AllowanceSnapshot {
  earnedPoints: number;
  expectedPoints: number;
  percent: number;
  baseAmount: number;
  policy: AllowancePolicy;
  minimumPercent: number;
  calculatedAmount: number;
  bonusAmount: number;
  adjustments: number;
  capApplied: boolean;
  finalAmount: number;
  calculatedAt: ISO;
}

export interface AllowanceAdjustment {
  id: ID;
  amount: number;
  reason: string;
  createdBy: ID;
  createdAt: ISO;
}

export interface AllowancePeriod {
  id: ID;
  familyId: ID;
  memberId: ID;
  start: string; // AAAA-MM-DD
  end: string; // AAAA-MM-DD (inclusivo)
  status: AllowanceStatus;
  snapshot?: AllowanceSnapshot;
  adjustments: AllowanceAdjustment[];
  history: { status: AllowanceStatus; at: ISO; by?: ID; note?: string }[];
  paidNote?: string;
}

export interface FamilyValue {
  id: ID;
  familyId: ID;
  title: string;
  description?: string;
  createdAt: ISO;
}

export interface Goal {
  id: ID;
  familyId: ID;
  title: string;
  scope: 'FAMILY' | 'INDIVIDUAL';
  memberId?: ID;
  targetPoints: number;
  startDate: string;
  endDate: string;
  bonusPoints: number;
  status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  completedAt?: ISO;
  createdAt: ISO;
}

export type NotificationCategory = 'TASKS' | 'APPROVAL' | 'REWARDS' | 'ALLOWANCE' | 'ACHIEVEMENTS' | 'FAMILY';

export interface AppNotification {
  id: ID;
  familyId: ID;
  memberId: ID; // destinatário
  eventId: string; // idempotência por evento + destinatário
  category: NotificationCategory;
  priority: 'NORMAL' | 'CRITICAL';
  title: string;
  body: string;
  link?: string;
  createdAt: ISO;
  deliverAt: ISO; // quiet hours adiam a entrega
  readAt?: ISO;
  dismissedAt?: ISO;
}

export interface NotificationPrefs {
  memberId: ID;
  categories: Record<NotificationCategory, boolean>;
  quietHoursEnabled: boolean;
  quietStart: string; // HH:MM
  quietEnd: string; // HH:MM
}

export type TimelineKind =
  | 'TASK_DONE'
  | 'ACHIEVEMENT'
  | 'GOAL_COMPLETED'
  | 'REWARD_FULFILLED'
  | 'MEMBER_JOINED'
  | 'PIGGY_COMPLETED'
  | 'FAMILY_CREATED';

export interface TimelineEvent {
  id: ID;
  familyId: ID;
  kind: TimelineKind;
  memberId?: ID;
  text: string;
  createdAt: ISO;
}

export interface UnlockedAchievement {
  id: ID;
  familyId: ID;
  memberId: ID;
  code: string;
  unlockedAt: ISO;
}

export interface RecoveryRequest {
  email: string;
  codeHash: string;
  expiresAt: ISO;
  usedAt?: ISO;
}

export interface Session {
  userId: ID;
  activeFamilyId?: ID;
  /** Família de exemplo: tudo local, sem servidor. */
  demo?: boolean;
  /** Conta do servidor: usuário, famílias, membros e convites vêm da API. */
  remote?: boolean;
}

export interface AppState {
  version: 1;
  users: User[];
  families: Family[];
  members: Member[];
  invitations: Invitation[];
  tasks: Task[];
  assignments: Assignment[];
  score: ScoreTx[];
  wallet: WalletTx[];
  rewards: RewardItem[];
  redemptions: Redemption[];
  piggyBanks: PiggyBank[];
  allowanceConfigs: AllowanceConfig[];
  allowancePeriods: AllowancePeriod[];
  values: FamilyValue[];
  goals: Goal[];
  notifications: AppNotification[];
  notificationPrefs: NotificationPrefs[];
  timeline: TimelineEvent[];
  achievements: UnlockedAchievement[];
  recovery: RecoveryRequest[];
  session: Session | null;
  pendingInviteCode?: string;
}
