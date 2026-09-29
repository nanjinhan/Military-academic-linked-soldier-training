export type Sport = 'run' | 'pushup' | 'situp';
export type Scope = 'unit' | 'corps' | 'region' | 'national';
export type Status = 'pending' | 'approved' | 'changes' | 'rejected' | 'revoked';
export type RecordKind = 'performance' | 'measurement' | 'self';
export interface User {
  id: string; name: string; nickname: string; role: 'soldier' | 'admin';
  unit: string; company: string; platoon: string; squad: string; corps: string; region: string;
  group: string; shareScope: Scope | 'private';
}
export interface Goal {
  id: string; userId: string; grade: string; targetDate: string | null;
  run: number; pushup: number; situp: number; days: number[]; minutes: number;
  location: 'indoor' | 'outdoor' | 'both'; equipment: boolean; excludedDates: string[]; createdAt: string;
}
export interface Exercise { name: string; sets: number; reps: string; rest: string; alternative: string; }
export interface RoutineVersion {
  version: number; at: string; reason: string; ruleVersion: string; goalId: string;
  minutes: number; title: string; intensity: string; exercises: Exercise[];
}
export interface Routine extends RoutineVersion { id: string; userId: string; date: string; type: 'training' | 'rest' | 'recovery'; sport: Sport; history: RoutineVersion[]; }
export interface Submission {
  id: string; userId: string; kind: RecordKind; routineId?: string; date: string;
  sport: Sport; value: number; protocol: string; group: string;
  completion: 'complete' | 'partial' | 'missed'; minutes: number; rpe: number; fatigue: number; pain: boolean;
  evidence: string; status: Status; createdAt: string; updatedAt: string; idempotencyKey: string;
}
export interface Review { id: string; submissionId: string; adminId: string; action: Status; reason: string; at: string; }
export interface Official { id: string; userId: string; date: string; run: number; pushup: number; situp: number; grade: string; standard: string; }
export interface Recovery { id: string; userId: string; fatigue: number; pain: boolean; at: string; }
export interface Xp { id: string; userId: string; submissionId: string; amount: number; date: string; }
export interface Audit { id: string; actorId: string; action: string; targetId: string; at: string; }
export interface State { schemaVersion: number; users: User[]; goals: Goal[]; routines: Routine[]; submissions: Submission[]; reviews: Review[]; officials: Official[]; recovery: Recovery[]; xp: Xp[]; audits: Audit[]; }
export interface RankingRow { rank: number; nickname: string; userId: string; value: number; date: string; mine: boolean; percentile: number; }
export interface Ranking { rows: RankingRow[]; participants: number; suppressed: boolean; sport: Sport; scope: Scope; protocol: string; period: string; group: string; minimum: number; }
export interface Snapshot { me: User; today: string; goal?: Goal; routines: Routine[]; submissions: Submission[]; reviews: Review[]; officials: Official[]; recovery?: Recovery; xp: Xp[]; totalXp: number; level: number; demo: boolean; members: User[]; memberGoals: Goal[]; memberOfficials: Official[]; memberXp: Xp[]; audits: Audit[]; }
export const sportLabels: Record<Sport, string> = { run: '3km 뜀걸음', pushup: '팔굽혀펴기', situp: '윗몸일으키기' };
export const scopeLabels: Record<Scope, string> = { unit: '우리 부대', corps: '군단', region: '지역', national: '전국' };
export const statusLabels: Record<Status, string> = { pending: '인증 대기', approved: '인증 완료', changes: '보완 요청', rejected: '반려', revoked: '인증 취소' };
export const kindLabels: Record<RecordKind, string> = { performance: '루틴 수행', measurement: '측정 기록', self: '자율 운동' };
export const protocols: Record<Sport, string> = { run: 'demo-3km-track-v1', pushup: 'demo-pushup-2min-v1', situp: 'demo-situp-2min-v1' };
