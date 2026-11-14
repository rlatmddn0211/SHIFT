import type { Dispatch } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { sampleMemo, screens } from '../data';
import type { ScreenId, VehicleScreen, PhoneScreen } from '../data';
import type { Action, PrototypeState } from '../state';
import Vehicle from './Vehicle';
import Phone from './Phone';
import { ScaledCanvas } from './Primitives';

const noop: Dispatch<Action> = () => {};
type Filter = 'all' | 'vehicle' | 'phone' | 'state';

export default function Gallery({ state, onOpen }: { state: PrototypeState; onOpen: (id: ScreenId) => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const filtered = screens.filter((screen) => filter === 'all' || (filter === 'state' ? screen.state : screen.device === filter && !screen.state));
  return <section className="gallery-page"><div className="page-intro"><h1>모든 화면을 한눈에.</h1><p>차량 9개, 휴대폰 7개, 주요 상태 8개. 화면을 열어 직접 눌러보세요.</p></div><div className="gallery-filters" aria-label="화면 종류">{([{ key: 'all', name: '전체', count: 24 }, { key: 'vehicle', name: '차량', count: 9 }, { key: 'phone', name: '휴대폰', count: 7 }, { key: 'state', name: '주요 상태', count: 8 }] as const).map((item) => <button key={item.key} className={filter === item.key ? 'is-active' : ''} onClick={() => setFilter(item.key)}>{item.name}<span>{item.count}</span></button>)}</div><div className="gallery-grid">{filtered.map((screen) => {
    const preview: PrototypeState = { ...state, vehicleUser: state.phoneUser, connected: true, locked: screen.id === 'S8', vehicle: screen.device === 'vehicle' ? screen.id as VehicleScreen : 'V3', phone: screen.device === 'phone' ? screen.id as PhoneScreen : 'P2', recording: screen.id === 'V7', memo: ['S6', 'S7'].includes(screen.id) ? sampleMemo : '', saveFailed: false, navigationSent: false, visitIndex: 0, toast: '' };
    return <article className="gallery-card" key={screen.id}><div className={'gallery-preview ' + (screen.device === 'phone' ? 'is-phone' : '')} inert aria-hidden="true"><ScaledCanvas width={screen.device === 'vehicle' ? 840 : 390} height={screen.device === 'vehicle' ? 1184 : 844}>{screen.device === 'vehicle' ? <Vehicle state={preview} dispatch={noop} onMusicHelp={() => {}}/> : <Phone state={preview} dispatch={noop} onMusicHelp={() => {}} onReadNote={() => {}}/>}</ScaledCanvas></div><button className="gallery-card-label" onClick={() => onOpen(screen.id)}><div><span>{screen.id} · {screen.state ? '상태' : screen.device === 'vehicle' ? '차량' : '휴대폰'}</span><h2>{screen.name}</h2><p>{screen.description}</p></div><ArrowUpRight/></button></article>;
  })}</div></section>;
}
