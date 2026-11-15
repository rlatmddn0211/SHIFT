import { useReducer } from 'react';
import { sampleMemo, users } from './data';
import type { PersonalNote, PhoneScreen, ScreenId, UserId, VehicleScreen } from './data';

export interface Profile {
  outlook: boolean;
  oneNote: boolean;
  briefing: boolean;
  importantMail: boolean;
  selectedNotes: string[];
  noteSection: string;
  seatHeight: number;
  seatPosition: number;
  seatSaved: boolean;
}

export interface PrototypeState {
  vehicle: VehicleScreen;
  phone: PhoneScreen;
  phoneUser: UserId;
  phoneAuthenticated: UserId[];
  vehicleUser: UserId | null;
  connected: boolean;
  locked: boolean;
  driving: boolean;
  visitIndex: number;
  profiles: Record<UserId, Profile>;
  savedNotes: Record<UserId, PersonalNote[]>;
  activeNoteId: string | null;
  phoneNoteSaved: boolean;
  memo: string;
  recording: boolean;
  saveFailed: boolean;
  seatApplied: boolean;
  navigationSent: boolean;
  musicConnected: boolean;
  qrCode: string;
  approvalError: string;
  toast: string;
}

function profileFor(id: UserId): Profile {
  return { outlook: true, oneNote: true, briefing: true, importantMail: true, selectedNotes: users[id].notes.slice(0, 2).map((n) => n.id), noteSection: 'SHIFT 방문 메모', seatHeight: users[id].seatHeight, seatPosition: users[id].seatPosition, seatSaved: true };
}

export function initialState(): PrototypeState {
  return {
    vehicle: 'V1', phone: 'P2', phoneUser: 'A', phoneAuthenticated: [], vehicleUser: null,
    connected: false, locked: false, driving: false, visitIndex: 0,
    profiles: { A: profileFor('A'), B: profileFor('B') }, savedNotes: { A: [], B: [] },
    activeNoteId: null, phoneNoteSaved: false, memo: '', recording: false, saveFailed: false,
    seatApplied: false, navigationSent: false, musicConnected: false, qrCode: '482615', approvalError: '', toast: '',
  };
}

function nextPin(pin: string) { return pin === '482615' ? '739184' : '482615'; }

function authorizePhone(state: PrototypeState): UserId[] {
  return state.phoneAuthenticated.includes(state.phoneUser) ? state.phoneAuthenticated : [...state.phoneAuthenticated, state.phoneUser];
}

export type Action =
  | { type: 'VEHICLE'; screen: VehicleScreen }
  | { type: 'PHONE'; screen: PhoneScreen }
  | { type: 'USER'; user: UserId }
  | { type: 'APPROVE'; pin: string }
  | { type: 'LOADED' }
  | { type: 'END' }
  | { type: 'LOCK' }
  | { type: 'RESET' }
  | { type: 'STEP'; step: number }
  | { type: 'PREVIEW'; screen: ScreenId }
  | { type: 'VISIT'; index: number }
  | { type: 'PROFILE'; user: UserId; patch: Partial<Profile> }
  | { type: 'DRIVING'; value: boolean }
  | { type: 'SEAT_APPLY' }
  | { type: 'MUSIC'; value: boolean }
  | { type: 'NAV_SENT' }
  | { type: 'NAV_ERROR' }
  | { type: 'RECORD' }
  | { type: 'TRANSCRIBE' }
  | { type: 'MEMO'; text: string }
  | { type: 'SAVE'; fail?: boolean }
  | { type: 'SAVE_PHONE_NOTE'; text: string; visitId: string }
  | { type: 'READ_VISIT_NOTE'; noteId: string }
  | { type: 'QR_REFRESH' }
  | { type: 'TOAST'; text: string };

function reducer(state: PrototypeState, action: Action): PrototypeState {
  switch (action.type) {
    case 'VEHICLE': return { ...state, vehicle: action.screen, activeNoteId: null, toast: '' };
    case 'PHONE': return { ...state, phone: action.screen, phoneNoteSaved: false, approvalError: '', toast: '' };
    case 'USER': return { ...state, phoneUser: action.user, vehicle: 'V1', phone: 'P2', vehicleUser: null, connected: false, locked: false, activeNoteId: null, phoneNoteSaved: false, memo: '', recording: false, approvalError: '', navigationSent: false, qrCode: nextPin(state.qrCode), toast: '' };
    case 'APPROVE':
      if (state.vehicle === 'S1') return { ...state, approvalError: '인증 시간이 만료됐어요. 차량에서 새 PIN을 발급해 주세요.' };
      if (state.vehicle !== 'V1' || state.phone !== 'P6') return { ...state, approvalError: '차량에서 로그인 QR을 다시 열어 주세요.' };
      if (action.pin !== state.qrCode) return { ...state, approvalError: '차량 화면의 PIN을 확인하세요.' };
      return { ...state, phoneAuthenticated: authorizePhone(state), vehicleUser: state.phoneUser, connected: true, locked: false,
        vehicle: 'V3', phone: 'P2', activeNoteId: null, phoneNoteSaved: false, visitIndex: 0, memo: '', recording: false,
        saveFailed: false, seatApplied: false, navigationSent: false, approvalError: '', toast: '' };
    case 'LOADED': return state.vehicle === 'S2' ? { ...state, vehicle: 'V2' } : state;
    case 'END': return state.vehicleUser !== state.phoneUser ? { ...state, toast: '본인 계정으로 연결한 세션만 종료할 수 있어요.' } : { ...state, connected: false, locked: false, vehicleUser: null, vehicle: 'V1', phone: 'P2', activeNoteId: null, phoneNoteSaved: false, memo: '', recording: false, visitIndex: 0, navigationSent: false, seatApplied: false, qrCode: nextPin(state.qrCode), toast: '이 차량의 개인 세션을 종료했어요.' };
    case 'LOCK': return { ...state, vehicle: 'S8', locked: true, memo: '', recording: false, toast: '' };
    case 'RESET': return initialState();
    case 'STEP': {
      const vehicle: VehicleScreen = (['V1', 'V2', 'V3', 'V3', 'V10', 'V9'] as const)[action.step] ?? 'V3';
      const phone: PhoneScreen = (['P2', 'P2', 'P2', 'P9', 'P8', 'P7'] as const)[action.step] ?? 'P2';
      const connected = action.step !== 0;
      return { ...state, vehicle, phone, phoneAuthenticated: connected ? authorizePhone(state) : state.phoneAuthenticated,
        connected, locked: false, vehicleUser: connected ? state.phoneUser : null, activeNoteId: null, phoneNoteSaved: false,
        memo: '', recording: false, visitIndex: 0, navigationSent: false, approvalError: '', toast: '' };
    }
    case 'PREVIEW': {
      if (action.screen.startsWith('P')) {
        const screen = action.screen as PhoneScreen;
        return { ...state, phone: screen, phoneAuthenticated: screen === 'P8' || screen === 'P9' ? authorizePhone(state) : state.phoneAuthenticated, phoneNoteSaved: false, toast: '', approvalError: '' };
      }
      const screen = action.screen as VehicleScreen;
      const connected = !['V1', 'S1'].includes(screen);
      return { ...state, vehicle: screen, vehicleUser: connected ? state.phoneUser : null, connected, locked: screen === 'S8',
        activeNoteId: screen === 'V11' ? state.savedNotes[state.phoneUser][0]?.id ?? null : null,
        recording: false, memo: ['S6', 'S7'].includes(screen) ? sampleMemo : '', saveFailed: false, navigationSent: false, visitIndex: 0, toast: '' };
    }
    case 'VISIT': return { ...state, visitIndex: action.index, vehicle: 'V4', navigationSent: false, toast: '' };
    case 'PROFILE': return { ...state, seatApplied: action.patch.seatSaved === false && action.user === state.vehicleUser ? false : state.seatApplied, profiles: { ...state.profiles, [action.user]: { ...state.profiles[action.user], ...action.patch } } };
    case 'DRIVING': return { ...state, driving: action.value, recording: action.value ? false : state.recording, toast: '' };
    case 'SEAT_APPLY': {
      if (state.driving) return { ...state, toast: '정차 후 좌석 설정을 적용할 수 있어요.' };
      if (!state.connected || !state.vehicleUser || !state.profiles[state.vehicleUser].seatSaved) return { ...state, toast: '먼저 내 좌석 위치를 저장해 주세요.' };
      return { ...state, seatApplied: true, toast: '내 좌석 설정을 적용했어요.' };
    }
    case 'MUSIC': return { ...state, musicConnected: action.value };
    case 'NAV_SENT': return { ...state, navigationSent: true, vehicle: 'V5', toast: '확인한 목적지를 내비게이션에 전달했어요.' };
    case 'NAV_ERROR': return { ...state, vehicle: 'S5', navigationSent: false, toast: '' };
    case 'RECORD': return state.driving ? state : { ...state, vehicle: 'V7', recording: true, saveFailed: false, memo: '', toast: '' };
    case 'TRANSCRIBE': return { ...state, recording: false, memo: state.memo || sampleMemo, vehicle: 'S6' };
    case 'MEMO': return { ...state, memo: action.text };
    case 'SAVE': {
      if (!state.memo.trim() || state.driving) return state;
      const userId = state.vehicleUser;
      if (!userId || !state.connected) return { ...state, vehicle: 'V1', recording: false, memo: '' };
      if (action.fail || !state.profiles[userId].oneNote) return { ...state, vehicle: 'S7', saveFailed: true, toast: '' };
      const visit = users[userId].visits[state.visitIndex];
      const note: PersonalNote = { id: 'saved-' + Date.now(), title: visit.title + ' · 방문 메모', body: state.memo.trim(), updated: '방금 저장' };
      return { ...state, vehicle: 'S7', saveFailed: false, savedNotes: { ...state.savedNotes, [userId]: [note, ...state.savedNotes[userId]] }, toast: '' };
    }
    case 'SAVE_PHONE_NOTE': {
      const userId = state.phoneUser;
      if (state.phone !== 'P9' || !state.phoneAuthenticated.includes(userId)) return state;
      const body = action.text.trim();
      if (!body || action.text.length > 3000) return state;
      const visit = users[userId].visits.find((item) => item.id === action.visitId);
      if (action.visitId && !visit) return state;
      const title = visit ? `${visit.title} · 방문 메모` : '방문 메모';
      const note: PersonalNote = { id: `web-${state.savedNotes[userId].length + 1}`, title, body, updated: '방금 저장' };
      return { ...state, phone: 'P8', phoneNoteSaved: true, savedNotes: { ...state.savedNotes, [userId]: [note, ...state.savedNotes[userId]] } };
    }
    case 'READ_VISIT_NOTE': {
      const userId = state.vehicleUser;
      if (state.driving || state.locked || !state.connected || !userId || state.vehicle !== 'V10' || !state.savedNotes[userId].some((note) => note.id === action.noteId)) return state;
      return { ...state, vehicle: 'V11', activeNoteId: action.noteId };
    }
    case 'QR_REFRESH': return { ...state, qrCode: nextPin(state.qrCode), vehicle: 'V1', vehicleUser: null, connected: false, approvalError: '', toast: '새 PIN을 발급했어요.' };
    case 'TOAST': return { ...state, toast: action.text };
  }
}

export function usePrototype() { return useReducer(reducer, undefined, () => initialState()); }
