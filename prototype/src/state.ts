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
  vehicleUser: UserId | null;
  connected: boolean;
  locked: boolean;
  driving: boolean;
  visitIndex: number;
  profiles: Record<UserId, Profile>;
  savedNotes: Record<UserId, PersonalNote[]>;
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

export function initialState(start = false): PrototypeState {
  return { vehicle: start ? 'V1' : 'V3', phone: start ? 'P6' : 'P6', phoneUser: 'A', vehicleUser: start ? null : 'A', connected: !start, locked: false, driving: false, visitIndex: 0, profiles: { A: profileFor('A'), B: profileFor('B') }, savedNotes: { A: [], B: [] }, memo: '', recording: false, saveFailed: false, seatApplied: false, navigationSent: false, musicConnected: false, qrCode: '4826', approvalError: '', toast: '' };
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
  | { type: 'QR_REFRESH' }
  | { type: 'TOAST'; text: string };

function reducer(state: PrototypeState, action: Action): PrototypeState {
  switch (action.type) {
    case 'VEHICLE': return { ...state, vehicle: action.screen, toast: '' };
    case 'PHONE': return { ...state, phone: action.screen, approvalError: '', toast: '' };
    case 'USER': return { ...state, phoneUser: action.user, vehicle: 'V1', phone: 'P6', memo: '', recording: false, approvalError: '', navigationSent: false, toast: '' };
    case 'APPROVE':
      if (action.pin !== state.qrCode) return { ...state, approvalError: '코드가 일치하지 않아요. 차량 화면을 다시 확인해 주세요.' };
      return { ...state, vehicleUser: state.phoneUser, connected: true, locked: false, vehicle: 'S2', phone: 'P2', visitIndex: 0, memo: '', recording: false, saveFailed: false, seatApplied: false, navigationSent: false, approvalError: '', toast: '' };
    case 'LOADED': return state.vehicle === 'S2' ? { ...state, vehicle: 'V2' } : state;
    case 'END': return state.vehicleUser !== state.phoneUser ? { ...state, toast: '본인 계정으로 연결한 세션만 종료할 수 있어요.' } : { ...state, connected: false, locked: false, vehicleUser: null, vehicle: 'V1', phone: 'P2', memo: '', recording: false, visitIndex: 0, navigationSent: false, seatApplied: false, toast: '이 차량의 개인 세션을 종료했어요.' };
    case 'LOCK': return { ...state, vehicle: 'S8', locked: true, memo: '', recording: false, toast: '' };
    case 'RESET': return initialState(true);
    case 'STEP': {
      const vehicle: VehicleScreen = (['V1', 'V2', 'V3', 'V5', 'V7', 'V9'] as const)[action.step] ?? 'V3';
      return { ...state, vehicle, phone: action.step === 0 ? 'P6' : action.step === 5 ? 'P7' : 'P2', connected: action.step !== 0, locked: false, vehicleUser: action.step === 0 ? null : state.phoneUser, memo: '', recording: false, visitIndex: 0, navigationSent: false, toast: '' };
    }
    case 'PREVIEW': {
      if (action.screen.startsWith('P')) return { ...state, phone: action.screen as PhoneScreen, toast: '', approvalError: '' };
      const screen = action.screen as VehicleScreen;
      return { ...state, vehicle: screen, vehicleUser: state.phoneUser, connected: !['V1', 'S1'].includes(screen), locked: screen === 'S8', recording: false, memo: ['S6', 'S7'].includes(screen) ? sampleMemo : '', saveFailed: false, navigationSent: false, visitIndex: 0, toast: '' };
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
    case 'QR_REFRESH': return { ...state, qrCode: state.qrCode === '4826' ? '7391' : '4826', vehicle: 'V1', approvalError: '', toast: '새 확인 코드를 발급했어요.' };
    case 'TOAST': return { ...state, toast: action.text };
  }
}

export function usePrototype() { return useReducer(reducer, undefined, () => initialState()); }
