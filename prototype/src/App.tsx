import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, CarFront, Check, CheckCircle2, ChevronsUpDown, CodeXml, Focus, Grid2X2, Headphones, Image, Info, Menu, PanelsLeftBottom, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { baseVehicleScreens, getStep, phoneScreens, screens, stateScreens, steps } from './data';
import type { PersonalNote, PhoneScreen, ScreenId, UserId, VehicleScreen } from './data';
import { usePrototype } from './state';
import { Button, IconButton, Logo, Modal, ScaledCanvas } from './components/Primitives';
import Vehicle from './components/Vehicle';
import Phone from './components/Phone';
import Gallery from './components/Gallery';
import Brand from './components/Brand';
import Intro from './components/Intro';

type View = 'intro' | 'journey' | 'screens' | 'brand';
const initialParams = new URLSearchParams(window.location.search);
const isolated = initialParams.get('view') === 'vehicle' || initialParams.get('view') === 'phone' ? initialParams.get('view') : null;
const guidance = [
  '차량 화면의 QR을 누르고, 표시된 6자리 PIN을 휴대폰 화면에 입력한 뒤 로그인 승인하세요.',
  '주차한 상태에서 좌석 프로필을 확인하고 오늘 방문 업무를 열어 보세요.',
  '승인한 직원의 방문 업무를 확인하세요. 휴대폰에서 내 방문 메모를 열 수 있습니다.',
  '휴대폰의 내 방문 메모에서 내용을 입력하고 저장하세요. 일정을 선택하면 메모에 연결됩니다.',
  '주차 상태에서 Pleos의 방문 메모를 열고 저장한 메모 제목을 누르세요.',
  '차량의 QR을 열고 휴대폰에서 로그아웃을 승인하세요.',
];

export default function App() {
  const [state, dispatch] = usePrototype();
  const [view, setView] = useState<View>(() => initialParams.has('screen') || initialParams.get('view') === 'demo' ? 'journey' : 'intro');
  const [presentation, setPresentation] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [modal, setModal] = useState<'music' | PersonalNote | null>(null);
  const [heldLoading, setHeldLoading] = useState(() => initialParams.get('screen') === 'S2');
  const closeModal = useCallback(() => setModal(null), []);
  const step = getStep(state.vehicle, state.phone);

  useEffect(() => {
    const user = initialParams.get('user');
    if (user === 'B') dispatch({ type: 'USER', user: 'B' });
    const screen = initialParams.get('screen');
    if (screen && screens.some((item) => item.id === screen)) dispatch({ type: 'PREVIEW', screen: screen as ScreenId });
    const phone = initialParams.get('phone');
    if (phone && phoneScreens.some((item) => item.id === phone)) dispatch({ type: 'PHONE', screen: phone as PhoneScreen });
  }, []);

  useEffect(() => {
    if (state.vehicle !== 'S2' || heldLoading) return;
    const timer = window.setTimeout(() => dispatch({ type: 'LOADED' }), 1200);
    return () => clearTimeout(timer);
  }, [state.vehicle, heldLoading]);

  useEffect(() => {
    if (!state.toast) return;
    const timer = window.setTimeout(() => dispatch({ type: 'TOAST', text: '' }), 3500);
    return () => clearTimeout(timer);
  }, [state.toast]);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setPresentation(false); setMobileMenu(false); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, []);

  function changeView(next: View) {
    setView(next);
    setMobileMenu(false);
  }

  function startDemo() {
    setModal(null);
    setHeldLoading(false);
    dispatch({ type: 'RESET' });
    changeView('journey');
  }

  function selectUser(user: UserId) {
    setModal(null);
    setHeldLoading(false);
    dispatch({ type: 'USER', user });
  }

  function selectScreen(id: ScreenId) {
    setHeldLoading(id === 'S2');
    dispatch({ type: 'PREVIEW', screen: id });
    changeView('journey');
  }

  function jumpStep(index: number) {
    setHeldLoading(false);
    dispatch({ type: 'STEP', step: index });
    changeView('journey');
  }

  const vehicle = <Vehicle key={state.vehicle + '-' + state.vehicleUser} state={state} dispatch={dispatch} onMusicHelp={() => setModal('music')}/>;
  const phone = <Phone key={state.phone + '-' + state.phoneUser + '-' + state.qrCode} state={state} dispatch={dispatch} onMusicHelp={() => setModal('music')} onReadNote={setModal}/>;

  const overlays = <>{state.toast ? <div className="global-toast" role="status"><CheckCircle2/>{state.toast}</div> : null}{modal ? <Modal title={modal === 'music' ? '휴대폰 음악 이어 듣기' : modal.title} onClose={closeModal}>{modal === 'music' ? <><p className="modal-description">휴대폰에서 듣던 음악을 차량 오디오로 이어 들어요.</p><ol className="audio-instructions"><li><span>1</span><div><strong>휴대폰과 차량 오디오 연결</strong><p>차량의 오디오 설정에서 휴대폰 연결 상태를 확인해 주세요.</p></div></li><li><span>2</span><div><strong>공식 음악 앱에서 재생</strong><p>휴대폰의 YouTube Music 등 이용하던 앱에서 음악을 재생하세요.</p></div></li><li><span>3</span><div><strong>차량 스피커로 이어 듣기</strong><p>음량과 지원되는 조작은 차량 오디오에서 확인해 주세요.</p></div></li></ol><Button icon={<Headphones/>} onClick={() => { dispatch({ type: 'MUSIC', value: true }); dispatch({ type: 'TOAST', text: '휴대폰 오디오 연결을 확인했어요.' }); closeModal(); }}>오디오 연결 확인</Button></> : <><p className="modal-description">{modal.updated}</p><div className="personal-note-body">{modal.body}</div><Button onClick={closeModal}>확인</Button></>}</Modal> : null}</>;

  if (isolated) return <div className={'isolated-view isolated-view--' + isolated}><div className="isolated-device"><ScaledCanvas width={isolated === 'vehicle' ? 840 : 390} height={isolated === 'vehicle' ? 1184 : 844}>{isolated === 'vehicle' ? vehicle : phone}</ScaledCanvas></div>{overlays}</div>;

  return <div className={'studio ' + (presentation ? 'is-presenting' : '')}>
    <aside className={'studio-sidebar ' + (mobileMenu ? 'is-open' : '')}>
      <button className="studio-brand" aria-label="SHIFT 프로젝트 소개" onClick={() => changeView('intro')}><Logo/></button>
      <nav className="studio-nav" aria-label="프로토타입 보기 방식">
        <button className={view === 'intro' ? 'is-active' : ''} onClick={() => changeView('intro')}><Info/>프로젝트 소개</button>
        <button className={view === 'journey' ? 'is-active' : ''} onClick={() => changeView('journey')}><PanelsLeftBottom/>나란히 보기</button>
        <button className={view === 'screens' ? 'is-active' : ''} onClick={() => changeView('screens')}><Grid2X2/>전체 화면<span>{screens.length}</span></button>
        <button className={view === 'brand' ? 'is-active' : ''} onClick={() => changeView('brand')}><Image/>로고</button>
      </nav>
      <div className="journey-rail"><p>시연 순서</p>{steps.map((name, index) => <button key={name} className={view === 'journey' && index === step ? 'is-active' : ''} onClick={() => jumpStep(index)}><span>{view === 'journey' && index < step ? <Check/> : index + 1}</span>{name}</button>)}</div>
      <div className="sidebar-bottom"><div><ShieldCheck/><span>클릭형 프로토타입<br/><strong>예시 데이터로 체험해요.</strong></span></div><a href="https://github.com/rlatmddn0211/SHIFT" target="_blank" rel="noreferrer"><CodeXml/>SHIFT 프로젝트<ArrowUpRight/></a></div>
    </aside>
    {mobileMenu ? <button className="sidebar-scrim" aria-label="메뉴 닫기" onClick={() => setMobileMenu(false)}/> : null}
    <div className="studio-main"><header className="studio-topbar"><IconButton label="메뉴 열기" className="mobile-menu-button" onClick={() => setMobileMenu(true)}><Menu/></IconButton><div className="document-title"><strong>SHIFT</strong><span>/</span><span>{view === 'intro' ? '프로젝트 소개' : '인터랙티브 시연'}</span><small>예시 데이터</small></div><button className="presentation-button" onClick={() => { changeView('journey'); setPresentation(!presentation); }}>{presentation ? <X/> : <Focus/>}{presentation ? '발표 모드 끝내기' : '발표 모드'}</button></header>
      {view === 'intro' ? <Intro onStart={startDemo}/> : view === 'journey' ? <section className="journey-page">
        <div className="journey-heading"><h1>탑승부터 업무 종료까지.</h1><div className="journey-heading-actions"><div className="user-selector" role="group" aria-label="휴대폰 사용자 선택"><button aria-pressed={state.phoneUser === 'A'} className={state.phoneUser === 'A' ? 'is-active' : ''} onClick={() => selectUser('A')}>직원 A</button><button aria-pressed={state.phoneUser === 'B'} className={state.phoneUser === 'B' ? 'is-active' : ''} onClick={() => selectUser('B')}>직원 B</button></div><button className="reset-button" onClick={startDemo}><RotateCcw/>다시 시작</button></div></div>
        <p className="journey-guidance" aria-live="polite">{guidance[step]}</p>
        <div className="journey-tools"><label className="scenario-picker"><span>차량 화면</span><select aria-label="차량 화면 선택" value={state.vehicle} onChange={(event) => selectScreen(event.target.value as VehicleScreen)}><optgroup label="기본 화면">{baseVehicleScreens.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}</optgroup><optgroup label="주요 상태">{stateScreens.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}</optgroup></select><ChevronsUpDown/></label><button className={'drive-toggle ' + (state.driving ? 'is-driving' : '')} onClick={() => dispatch({ type: 'DRIVING', value: !state.driving })} aria-pressed={state.driving}><CarFront/>{state.driving ? '주행 중' : '정차 중'}</button>{state.vehicle === 'S2' && heldLoading ? <button className="scenario-link" onClick={() => dispatch({ type: 'LOADED' })}>불러오기 완료<ArrowRight/></button> : null}{state.vehicle === 'S7' || state.vehicle === 'S6' ? <button className="scenario-link" onClick={() => dispatch({ type: 'SAVE', fail: true })}>저장 실패 상황 보기</button> : null}<span className="simulation-note">예시 데이터 · 두 화면은 이 탭에서 연동됩니다.</span></div>
        <div className="device-stage"><div className="device-panel device-panel--vehicle"><div className="device-caption"><span><strong>Pleos Connect</strong> · 분할 창</span><a aria-label="차량 화면 크게 보기" href={'?view=vehicle&screen=' + state.vehicle + '&user=' + state.phoneUser} target="_blank" rel="noreferrer"><ArrowUpRight/></a></div><div className="vehicle-device"><ScaledCanvas width={840} height={1184}>{vehicle}</ScaledCanvas></div></div><div className="device-connection" aria-hidden="true"><span/><LinkGlyph/><span/></div><div className="device-panel device-panel--phone"><div className="device-caption"><label><select aria-label="휴대폰 화면 선택" value={state.phone} onChange={(event) => dispatch({ type: 'PHONE', screen: event.target.value as PhoneScreen })}>{phoneScreens.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}</select></label><a aria-label="휴대폰 화면 크게 보기" href={'?view=phone&screen=' + state.phone + '&user=' + state.phoneUser} target="_blank" rel="noreferrer"><ArrowUpRight/></a></div><div className="phone-device"><ScaledCanvas width={390} height={844}>{phone}</ScaledCanvas></div></div></div>
        <footer className="journey-footer"><div className="journey-progress"><div><strong>{steps[step]}</strong><small>차량 840 × 1184 · 모바일 390 × 844</small></div></div><div className="journey-pager"><IconButton label="이전 단계" disabled={step === 0} onClick={() => jumpStep(step - 1)}><ArrowLeft/></IconButton><span>{step + 1} / {steps.length}</span><IconButton label="다음 단계" disabled={step === steps.length - 1} onClick={() => jumpStep(step + 1)}><ArrowRight/></IconButton></div></footer>
      </section> : view === 'screens' ? <Gallery state={state} onOpen={selectScreen}/> : <Brand onNotify={(text) => dispatch({ type: 'TOAST', text })}/>}
    </div>{overlays}
  </div>;
}

function LinkGlyph() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m9 15 6-6m-8 3-1 1a4 4 0 0 0 5 6l3-3m-4-8 3-3a4 4 0 0 1 6 5l-2 2" strokeLinecap="round"/></svg>; }
