import { useEffect, useState } from 'react';
import type { Dispatch } from 'react';
import { Armchair, ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, CheckCircle2, ChevronRight, CircleAlert, FileText, Headphones, LoaderCircle, LockKeyhole, LogOut, MapPin, Mic, RefreshCw, ShieldCheck, Square, Volume2, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { users } from '../data';
import type { PersonalNote, VehicleScreen } from '../data';
import type { Action, PrototypeState } from '../state';
import { Button, IconButton, Logo, Notice, Row } from './Primitives';

interface Props { state: PrototypeState; dispatch: Dispatch<Action>; onMusicHelp: () => void }

const titles: Record<VehicleScreen, string> = {
  V1: '공용차 로그인', V2: '탑승을 준비해요', V3: '오늘 방문 업무', V4: '방문 업무 상세', V5: '목적지를 확인하세요', V6: '내 업무 노트', V7: '방문 후 메모', V8: '내 좌석 프로필', V9: '이용을 마치셨나요?', V10: '방문 메모', V11: '방문 메모 상세',
  S1: '다시 연결해 주세요', S2: '내 환경을 불러와요', S3: '오늘 방문 업무', S4: '내 좌석 프로필', S5: '목적지를 확인하세요', S6: '메모를 확인해 주세요', S7: '방문 메모', S8: '개인 세션이 잠겼어요',
};

function Qr({ value, onClick }: { value: string; onClick: () => void }) {
  return <button className="qr-code" onClick={onClick} aria-label="휴대폰 승인 화면 열기"><QRCodeSVG value={value} size={236} level="M" bgColor="#FFFFFF" fgColor="#002C5F" marginSize={2}/></button>;
}

export default function Vehicle({ state, dispatch, onMusicHelp }: Props) {
  const owner = state.vehicleUser ?? state.phoneUser;
  const user = users[owner];
  const profile = state.profiles[owner];
  const visit = user.visits[state.visitIndex] ?? user.visits[0];
  const screen = state.vehicle;
  const isPublic = ['V1', 'S1', 'S8'].includes(screen);
  const [mailExpanded, setMailExpanded] = useState(false);
  const [briefing, setBriefing] = useState(false);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [seatConfirm, setSeatConfirm] = useState(false);
  const [seatHeight, setSeatHeight] = useState(profile.seatHeight);
  const [seatPosition, setSeatPosition] = useState(profile.seatPosition);
  const notes: PersonalNote[] = user.notes.filter((note) => profile.selectedNotes.includes(note.id));
  const visitNotes = state.connected && state.vehicleUser && !state.locked && !state.driving ? state.savedNotes[state.vehicleUser] : [];
  const openedNote = visitNotes.find((note) => note.id === state.activeNoteId);
  const selectedNote = notes.find((note) => note.id === noteId) ?? notes[0];
  const go = (next: VehicleScreen) => dispatch({ type: 'VEHICLE', screen: next });
  const phone = (next: 'P3' | 'P6' | 'P7') => dispatch({ type: 'PHONE', screen: next });
  const qrLink = new URL(window.location.href);
  // The public prototype keeps pairing in the current page. Scanning starts a new demo.
  qrLink.search = new URLSearchParams({ view: 'demo', user: state.phoneUser }).toString();
  qrLink.hash = '';

  useEffect(() => () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }, []);

  function readBriefing() {
    setBriefing(true);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const message = new SpeechSynthesisUtterance(visit.briefing);
      message.lang = 'ko-KR';
      message.rate = 0.95;
      window.speechSynthesis.speak(message);
    }
  }

  const driveNotice = <Notice>정차 후 확인하거나 입력할 수 있어요. 기존 내비게이션 안내는 이어집니다.</Notice>;

  let content;
  if (screen === 'V1' || screen === 'S1') {
    content = <div className="v-connect"><p className="v-lead">QR을 열고 휴대폰에서<br/>차량 로그인을 승인하세요.</p><div className="v-qr-panel"><span className="v-car-label">공용차 01</span><Qr value={qrLink.href} onClick={() => phone('P6')}/><span className="v-code-label">차량 화면의 6자리 PIN</span><strong className="v-pin">{state.qrCode}</strong>{screen === 'S1' ? <Notice type="error">인증 시간이 만료됐어요. 새 코드를 발급해 주세요.</Notice> : <span className="v-qr-status"><span className="status-dot"/>휴대폰 승인 대기 중</span>}</div>{screen === 'S1' ? <Button icon={<RefreshCw/>} onClick={() => dispatch({ type: 'QR_REFRESH' })}>새 PIN 발급</Button> : <p className="v-footnote"><ShieldCheck/>시연에서는 QR을 누르면 오른쪽에 승인 화면이 열려요.</p>}</div>;
  } else if (screen === 'S2') {
    content = <div className="v-loading"><div className="v-avatar">{user.initials}</div><h2>{user.name}님, 반가워요.</h2><p>이 차량에서 이어 쓸 환경을 준비하고 있어요.</p><div className="v-loading-list"><Row title="회사 업무 계정 확인" trailing={<Check/>}/><Row title="선택한 노트 연결" trailing={<Check/>}/><Row title="좌석 프로필 불러오기" trailing={<LoaderCircle className="spin"/>}/></div><div className="loading-track"><span/></div></div>;
  } else if (screen === 'V2') {
    content = <div className="v-stack"><p className="v-lead">{user.name}님의 업무와 착석 환경을<br/>공용차 01에서 이어가세요.</p><div className="v-status-list"><Row icon={<CalendarDays/>} title="Outlook 일정·메일" detail={profile.outlook ? '연결됐어요' : '업무 연결을 선택하지 않았어요'} trailing={profile.outlook ? <Check/> : <ChevronRight/>} onClick={() => phone('P3')}/><Row icon={<BookOpen/>} title="선택한 OneNote" detail={profile.oneNote ? profile.selectedNotes.length + '개 노트 준비 완료' : '휴대폰에서 연결할 수 있어요'} trailing={profile.oneNote ? <Check/> : <ChevronRight/>} onClick={() => phone('P3')}/></div><div className="v-seat-card"><Armchair/><div><h2>내 좌석 위치</h2><p>{profile.seatSaved ? '운전석 높이·앞뒤 위치' : '아직 저장된 위치가 없어요'}</p></div>{state.seatApplied && profile.seatSaved ? <span className="v-applied"><Check/>적용 완료</span> : <Button disabled={state.driving} onClick={() => profile.seatSaved ? setSeatConfirm(true) : go('V8')}>{profile.seatSaved ? '적용' : '위치 저장'}</Button>}</div><button className="v-text-link" onClick={() => go('V8')}>좌석 설정 확인·저장 <ArrowRight/></button><Row icon={<Headphones/>} title="휴대폰 오디오" detail={state.musicConnected ? '공식 음악 앱에서 이어 듣기 준비 완료' : '휴대폰의 음악을 차량 오디오로 이어 들어요'} onClick={onMusicHelp}/>{state.driving ? driveNotice : null}<Button trailing onClick={() => { go('V3'); dispatch({ type: 'PHONE', screen: 'P2' }); }}>오늘 방문 업무</Button></div>;
  } else if (screen === 'V3' || screen === 'S3') {
    content = !profile.outlook || screen === 'S3' ? <div className="v-empty"><CalendarDays/><h2>업무를 연결하면<br/>방문 준비가 간편해져요.</h2><p>휴대폰에서 일정·메일 접근을 선택해 주세요.<br/>좌석 설정과 개인 세션은 계속 이용할 수 있어요.</p><Button onClick={() => phone('P3')}>휴대폰에서 업무 연결</Button><Button variant="secondary" onClick={() => go('V8')}>내 좌석 설정</Button></div> : <><article className="visit-card"><p className="visit-eyebrow">다음 방문</p><p className="visit-time">{visit.time}</p><h2><button onClick={() => go('V4')}>{visit.title}</button></h2><p className="visit-address">{visit.address}</p><div className="visit-change"><span>{visit.originalAddress ? '장소 변경 · ' : '일정 확인 · '}{visit.emailTime} 수신 메일</span><IconButton label="음성 브리핑 듣기" onClick={readBriefing}><Volume2/></IconButton></div><Button onClick={() => go('V5')}>내비로 보내기</Button></article><section className="v-schedule"><h2>이후 일정</h2>{user.visits.filter((item) => item.id !== visit.id).map((item) => <button className="visit-row" key={item.id} onClick={() => dispatch({ type: 'VISIT', index: user.visits.findIndex((v) => v.id === item.id) })}><time>{item.time}</time><span>{item.title}</span></button>)}</section></>;
    content = <>{content}{state.connected && state.vehicleUser && !state.locked && !state.driving
      ? <Button className="v-visit-memos" variant="secondary" icon={<BookOpen/>} onClick={() => go('V10')}>방문 메모</Button> : null}</>;
  } else if (screen === 'V4') {
    content = state.driving ? driveNotice : <div className="v-stack"><div className="v-detail-title"><span>{visit.time}</span><h2>{visit.title}</h2><p>11월 16일 월요일 · {visit.contact}</p></div><div className="v-address"><MapPin/><span>{visit.address}</span></div>{visit.originalAddress ? <p className="v-muted">변경 전 <del>{visit.originalAddress}</del></p> : null}<div className="v-source"><div className="v-source-label"><FileText/>관련 메일 · {visit.emailTime}</div><h3>{visit.emailSubject}</h3><p>{visit.briefing}</p><button className="v-text-link" aria-expanded={mailExpanded} onClick={() => setMailExpanded(!mailExpanded)}>{mailExpanded ? '원문 접기' : '메일 원문 확인'}<ChevronRight/></button>{mailExpanded ? <p className="v-mail-body">{visit.emailBody}</p> : null}</div><Button trailing onClick={() => go('V5')}>목적지 확인</Button></div>;
  } else if (screen === 'V5' || screen === 'S5') {
    content = state.driving ? driveNotice : <div className="v-stack"><div className="destination-card"><div className="destination-marker"><MapPin/></div><span className="v-overline">방문할 장소</span><h2>{visit.title}</h2><p>{visit.address}</p></div><div className="v-source compact"><div className="v-source-label"><FileText/>{visit.originalAddress ? '장소 변경 근거' : '일정 확인 근거'}</div><p>{visit.emailTime} 수신 · {visit.emailSubject}</p></div>{screen === 'S5' ? <Notice type="error">내비게이션에 전달하지 못했어요. 확인한 주소는 유지하고 있어요.</Notice> : state.navigationSent ? <Notice type="success">목적지를 전달했어요. 경로 안내는 내비게이션에서 이어집니다.</Notice> : <p className="v-footnote">주소와 변경 근거를 확인한 뒤 전달해 주세요.</p>}{state.navigationSent ? <Button trailing onClick={() => go('V7')}>방문 후 메모 작성</Button> : <Button trailing onClick={() => dispatch({ type: 'NAV_SENT' })}>{screen === 'S5' ? '다시 보내기' : '내비로 보내기'}</Button>}<Button variant="secondary" onClick={() => go('V4')}>일정·메일 다시 확인</Button></div>;
  } else if (screen === 'V6') {
    content = state.driving ? driveNotice : !profile.oneNote ? <div className="v-empty"><BookOpen/><h2>선택한 노트를 가져오세요.</h2><p>휴대폰에서 OneNote 연결과 조회할 노트를 선택할 수 있어요.</p><Button onClick={() => phone('P3')}>휴대폰에서 연결</Button></div> : <div className="v-stack"><div className="v-note-tabs">{notes.map((note) => <button className={note.id === selectedNote?.id ? 'is-selected' : ''} key={note.id} onClick={() => setNoteId(note.id)}>{note.title}</button>)}</div>{selectedNote ? <article className="v-note-sheet"><span>OneNote · {selectedNote.updated}</span><h2>{selectedNote.title}</h2><p>{selectedNote.body}</p></article> : <Notice>휴대폰에서 차량에 가져올 노트를 선택해 주세요.</Notice>}<Button icon={<Mic/>} onClick={() => go('V7')}>새 음성 메모</Button></div>;
  } else if (screen === 'V10') {
    content = state.driving ? driveNotice : <div className="v-stack">
      <p className="v-lead">내가 저장한 방문 메모를 확인합니다.</p>
      {visitNotes.length ? visitNotes.map((note) => (
        <Button key={note.id} variant="secondary" onClick={() => dispatch({ type: 'READ_VISIT_NOTE', noteId: note.id })}>{note.title}</Button>
      )) : <Notice>저장한 방문 메모가 없습니다.</Notice>}
      <Button variant="secondary" onClick={() => go('V3')}>오늘 방문 업무</Button>
    </div>;
  } else if (screen === 'V11') {
    content = state.driving ? driveNotice : <div className="v-stack">
      {openedNote ? <article className="v-note-sheet"><p>{openedNote.body}</p></article>
        : <Notice>방문 메모 목록에서 메모를 선택하세요.</Notice>}
      <Button variant="secondary" icon={<ArrowLeft/>} onClick={() => go('V10')}>돌아가기</Button>
    </div>;
  } else if (screen === 'V7') {
    content = state.driving ? driveNotice : <div className="v-recording"><p className="v-record-context">{visit.title}</p><div className={'microphone-orbit ' + (state.recording ? 'is-recording' : '')}><Mic/></div><h2>{state.recording ? '편하게 말씀해 주세요.' : '미팅 내용을 기억해둘게요.'}</h2><p>{state.recording ? '말씀을 마치면 아래 버튼을 눌러 주세요.' : '음성으로 남기고, 확인한 뒤 저장하세요.'}</p><div className={'waveform ' + (state.recording ? 'is-active' : '')} aria-hidden="true">{[24, 42, 64, 36, 78, 50, 96, 58, 82, 40, 60, 34, 20].map((height, index) => <span key={index} style={{ height, animationDelay: index * -0.12 + 's' }}/>)}</div><Button icon={state.recording ? <Square/> : <Mic/>} onClick={() => dispatch({ type: state.recording ? 'TRANSCRIBE' : 'RECORD' })}>{state.recording ? '녹음 마치기' : '음성 메모 시작'}</Button><p className="v-footnote">저장 위치 · OneNote / {profile.noteSection}</p></div>;
  } else if (screen === 'S6') {
    content = state.driving ? driveNotice : <div className="v-stack"><p className="v-record-context">{visit.title}</p><label className="v-memo-editor"><span>음성으로 남긴 내용</span><textarea aria-label="저장할 메모 내용" value={state.memo} onChange={(event) => dispatch({ type: 'MEMO', text: event.target.value })} rows={6}/></label><p className="v-footnote">OneNote / {profile.noteSection}에 새 메모로 저장해요.</p><Button disabled={!state.memo.trim()} icon={<Check/>} onClick={() => dispatch({ type: 'SAVE' })}>확인하고 저장</Button><Button variant="secondary" icon={<Mic/>} onClick={() => dispatch({ type: 'RECORD' })}>다시 말하기</Button></div>;
  } else if (screen === 'S7') {
    content = <div className="v-result"><div className={'result-icon ' + (state.saveFailed ? 'is-error' : '')}>{state.saveFailed ? <CircleAlert/> : <CheckCircle2/>}</div><h2>{state.saveFailed ? '저장하지 못했어요.' : '메모를 저장했어요.'}</h2><p>{state.saveFailed ? '작성한 내용은 이 화면에 유지하고 있어요.' : '휴대폰에서도 같은 메모를 확인할 수 있어요.'}</p><article className="v-saved-note"><span>{state.saveFailed ? '저장 대기' : 'OneNote / ' + profile.noteSection}</span><h3>{visit.title} · 방문 메모</h3><p>{state.memo}</p></article>{state.saveFailed ? <><Button icon={<RefreshCw/>} onClick={() => dispatch({ type: 'SAVE' })}>다시 저장</Button><Button variant="secondary" onClick={() => phone('P3')}>OneNote 연결 확인</Button></> : <><Button trailing onClick={() => { go('V3'); dispatch({ type: 'PHONE', screen: 'P2' }); }}>오늘 업무로</Button><Button variant="secondary" onClick={() => { go('V9'); phone('P7'); }}>개인 세션 종료</Button></>}</div>;
  } else if (screen === 'V8' || screen === 'S4') {
    content = <div className="v-stack"><div className="seat-visual"><Armchair strokeWidth={1.3}/><div className="seat-visual-label"><span>운전석</span><strong>{user.short}님의 착석 환경</strong></div></div>{screen === 'S4' ? <Notice>이 차량은 좌석 프로필 적용을 지원하지 않아요. 차량의 좌석 조절 장치를 이용해 주세요.</Notice> : <><div className="v-sliders"><label><span>좌석 높이</span><input type="range" aria-label="좌석 높이" min="0" max="100" value={seatHeight} disabled={state.driving} onChange={(event) => setSeatHeight(Number(event.target.value))}/><span className="range-labels"><small>낮게</small><small>높게</small></span></label><label><span>앞뒤 위치</span><input type="range" aria-label="좌석 앞뒤 위치" min="0" max="100" value={seatPosition} disabled={state.driving} onChange={(event) => setSeatPosition(Number(event.target.value))}/><span className="range-labels"><small>앞으로</small><small>뒤로</small></span></label></div>{state.driving ? driveNotice : <p className="v-footnote">편한 위치로 조정한 뒤 저장하세요.<br/>다음 탑승 시 지원하는 차량에서 확인 후 적용해요.</p>}<Button disabled={state.driving} icon={<Check/>} onClick={() => { dispatch({ type: 'PROFILE', user: owner, patch: { seatHeight, seatPosition, seatSaved: true } }); dispatch({ type: 'TOAST', text: '현재 좌석 위치를 내 프로필에 저장했어요.' }); }}>현재 위치 저장</Button><Button disabled={state.driving || !profile.seatSaved} variant="secondary" onClick={() => setSeatConfirm(true)}>저장한 위치 적용</Button></>}</div>;
  } else if (screen === 'V9') {
    content = <div className="v-connect"><p className="v-lead">휴대폰에서 승인하면 이 차량의<br/>개인 업무 화면과 접근을 정리해요.</p><div className="v-qr-panel"><span className="v-car-label">{user.name} · 공용차 01</span><Qr value={qrLink.href} onClick={() => phone('P7')}/><span className="v-qr-status"><span className="status-dot"/>휴대폰 종료 승인 대기 중</span></div><p className="v-footnote">OneNote에 저장한 메모와 원본 업무는 그대로 남아요.</p><Button variant="secondary" icon={<ArrowLeft/>} onClick={() => go('V3')}>업무 화면으로 돌아가기</Button></div>;
  } else {
    content = <div className="v-locked"><div className="locked-icon"><LockKeyhole/></div><h2>개인 정보를 보호하고 있어요.</h2><p>SHIFT를 다시 이용하려면<br/>휴대폰으로 인증해 주세요.</p><Button onClick={() => { go('V1'); phone('P6'); }}>다시 인증하기</Button><p className="v-footnote">기존 내비게이션 안내는 이어집니다.</p></div>;
  }

  const nav = [{ label: '업무', icon: <CalendarDays/>, screen: 'V3' }, { label: '노트', icon: <BookOpen/>, screen: 'V6' }, { label: '좌석', icon: <Armchair/>, screen: 'V8' }, { label: '세션', icon: <LogOut/>, screen: 'V9' }] as const;

  return <div className={'vehicle-app ' + (isPublic ? 'is-public' : '')} data-screen={screen}><header className="v-header"><div className="v-brand-line"><Logo inverse/>{!isPublic ? <span>{user.name}<span className="v-dot">·</span>{state.driving ? '주행 중' : '정차 중'}</span> : <span>공용차 01</span>}</div><h1>{screen === 'V11' && openedNote ? openedNote.title : titles[screen]}</h1></header><main className="v-content">{content}</main>{!isPublic ? <nav className="v-bottom-nav" aria-label="차량 앱 메뉴">{nav.map((item) => <button key={item.screen} className={screen === item.screen || (item.screen === 'V3' && ['V4', 'V5', 'V10', 'V11', 'S3', 'S5'].includes(screen)) || (item.screen === 'V6' && ['V7', 'S6', 'S7'].includes(screen)) || (item.screen === 'V8' && screen === 'S4') ? 'is-active' : ''} onClick={() => { go(item.screen); if (item.screen === 'V9') phone('P7'); }}>{item.icon}<span>{item.label}</span></button>)}</nav> : null}{briefing ? <div className="v-briefing" role="status"><div><Volume2/><strong>오늘의 방문 브리핑</strong><IconButton label="브리핑 닫기" onClick={() => { setBriefing(false); window.speechSynthesis?.cancel(); }}><X/></IconButton></div><p>{visit.briefing}</p><button className="v-text-link" onClick={() => { setBriefing(false); go('V4'); }}>일정과 메일 확인 <ChevronRight/></button></div> : null}{seatConfirm ? <div className="v-dialog-backdrop"><section className="v-dialog" role="dialog" aria-modal="true" aria-label="좌석 설정 적용 확인"><Armchair/><h2>내 좌석 위치를 적용할까요?</h2><p>운전석 높이와 앞뒤 위치를 조절해요.<br/>정차 상태와 주변 공간을 확인해 주세요.</p><Button onClick={() => { setSeatHeight(profile.seatHeight); setSeatPosition(profile.seatPosition); dispatch({ type: 'SEAT_APPLY' }); setSeatConfirm(false); }} disabled={state.driving}>확인하고 적용</Button><Button variant="secondary" onClick={() => setSeatConfirm(false)}>취소</Button></section></div> : null}</div>;
}
