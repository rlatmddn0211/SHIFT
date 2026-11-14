import { useId, useState } from 'react';
import type { Dispatch } from 'react';
import { Armchair, ArrowRight, BatteryFull, BookOpen, CalendarDays, CarFront, Check, ChevronRight, FileText, Headphones, Home, Link2, LogOut, ShieldCheck, Signal, SlidersHorizontal, Wifi } from 'lucide-react';
import { users } from '../data';
import type { PersonalNote, PhoneScreen } from '../data';
import type { Action, PrototypeState } from '../state';
import { Back, Button, Logo, Notice, Row, Toggle } from './Primitives';

interface Props { state: PrototypeState; dispatch: Dispatch<Action>; onMusicHelp: () => void; onReadNote: (note: PersonalNote) => void }

function MicrosoftMark() { return <svg width="19" height="19" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M0 0h9v9H0zm11 0h9v9h-9zM0 11h9v9H0zm11 0h9v9h-9z"/></svg>; }

export default function Phone({ state, dispatch, onMusicHelp, onReadNote }: Props) {
  const user = users[state.phoneUser];
  const profile = state.profiles[state.phoneUser];
  const isMine = state.connected && state.vehicleUser === state.phoneUser;
  const canUseNotes = state.phoneAuthenticated.includes(state.phoneUser);
  const notes = canUseNotes ? state.savedNotes[state.phoneUser] : [];
  const [pin, setPin] = useState('');
  const [text, setText] = useState('');
  const [visitId, setVisitId] = useState('');
  const memoCountId = useId();
  const go = (screen: PhoneScreen) => dispatch({ type: 'PHONE', screen });
  const update = (patch: Partial<typeof profile>) => dispatch({ type: 'PROFILE', user: state.phoneUser, patch });
  const screen = state.phone;
  const memoScreen = screen === 'P8' || screen === 'P9';
  const noNav = memoScreen || ['P1', 'P6', 'P7'].includes(screen);

  let content;
  if (screen === 'P1') {
    content = <div className="p-welcome"><div className="p-welcome-art"><div className="p-road"/><Logo inverse/><CarFront/><span>차가 바뀌어도, 나의 환경으로.</span></div><h1>어느 차를 타도,<br/>나의 업무 그대로.</h1><p>업무와 메모, 나의 좌석 설정을<br/>공용차에서 이어가세요.</p><div className="p-welcome-features"><Row icon={<CalendarDays/>} title="방문 업무와 목적지를 한 번에"/><Row icon={<Armchair/>} title="나에게 맞는 좌석 환경"/><Row icon={<ShieldCheck/>} title="교대할 때 개인 세션 정리"/></div><Button icon={<MicrosoftMark/>} onClick={() => go('P3')}>Microsoft 계정으로 시작</Button><p className="p-caption">회사·학교 Microsoft 계정으로 이용할 수 있어요.<br/>업무 서비스 연결은 로그인 후 선택합니다.</p></div>;
  } else if (screen === 'P2') {
    content = <><div className="p-greeting"><p>{user.role} · {user.name}</p><h1>탑승할 준비가<br/>됐어요, {user.short}님.</h1></div><section className={'p-session-card ' + (isMine ? 'is-connected' : '')}><div className="p-session-top"><CarFront/><span>{isMine ? state.locked ? '개인 세션 잠금' : '현재 연결한 차량' : '연결한 차량이 없어요'}</span>{isMine ? <span className="p-status-dot"/> : null}</div><h2>{isMine ? '공용차 01' : '차량에서 QR을 스캔하세요.'}</h2><p>{isMine ? '내 업무 환경이 이 차량에 연결돼 있어요.' : '차량 화면의 PIN을 입력하면 연결됩니다.'}</p><button onClick={() => go(isMine ? 'P7' : 'P6')}>{isMine ? '개인 세션 원격 종료' : '차량 연결 확인'}<ArrowRight/></button></section>{canUseNotes ? <Button className="p-memo-access" icon={<FileText/>} onClick={() => go('P8')}>내 방문 메모</Button> : null}<div className="p-section-title"><h2>이어 쓸 나의 환경</h2><span>개인 프로필</span></div><div className="p-list"><Row icon={<CalendarDays/>} title="업무 일정·메일" detail={profile.outlook ? 'Outlook 연결됨' : '사용 안 함'} onClick={() => go('P3')}/><Row icon={<BookOpen/>} title="선택한 OneNote" detail={profile.oneNote ? profile.selectedNotes.length + '개 노트' : '사용 안 함'} onClick={() => go('P4')}/><Row icon={<Armchair/>} title="내 좌석 프로필" detail={profile.seatSaved ? '높이·앞뒤 위치 저장됨' : '차량에서 설정을 저장해 주세요'} onClick={() => go('P5')}/><Row icon={<Headphones/>} title="휴대폰 음악 이어 듣기" detail="공식 음악 앱 · 차량 오디오" onClick={onMusicHelp}/></div>{notes.length ? <section className="p-recent-notes"><div className="p-section-title"><h2>방문 후 남긴 메모</h2></div>{notes.slice(0, 2).map((note) => <Row key={note.id} icon={<FileText/>} title={note.title} detail={note.updated} onClick={() => onReadNote(note)}/>)}</section> : null}</>;
  } else if (screen === 'P3') {
    content = <><div className="p-heading"><h1>내 업무를 연결해요.</h1><p>차량에서 이어 쓸 정보를 선택해 주세요.</p></div><div className="p-account"><span className="p-avatar">{user.initials}</span><div><strong>{user.name}</strong><span>{user.email}</span></div><Check/></div><section className="p-settings-group"><h2>업무 서비스</h2><Toggle label="Outlook 일정·메일" checked={profile.outlook} onChange={() => update({ outlook: !profile.outlook })} description="오늘 일정 · 최근 7일 관련·중요 메일"/><Toggle label="OneNote" checked={profile.oneNote} onChange={() => update({ oneNote: !profile.oneNote })} description="선택한 노트 조회 · 새 메모 저장"/>{profile.oneNote ? <button className="p-inline-link" onClick={() => go('P4')}>가져올 노트와 저장 위치 선택<ChevronRight/></button> : null}</section><section className="p-settings-group"><h2>출발 전 음성 브리핑</h2><Toggle label="일정·장소 변경 안내" checked={profile.briefing} onChange={() => update({ briefing: !profile.briefing })}/><Toggle label="중요 메일 요약" checked={profile.importantMail} onChange={() => update({ importantMail: !profile.importantMail })}/></section><p className="p-privacy"><ShieldCheck/>연결한 업무 내용은 개인 세션에서만 표시해요.<br/>연결은 언제든 해제할 수 있어요.</p><Button trailing onClick={() => go(profile.oneNote ? 'P4' : 'P2')}>설정 완료</Button></>;
  } else if (screen === 'P4') {
    content = <><div className="p-heading"><h1>필요한 노트만<br/>가져오세요.</h1><p>선택한 노트만 차량에 표시해요.</p></div>{!profile.oneNote ? <Notice>OneNote를 연결하면 노트를 선택할 수 있어요.</Notice> : null}<section className="p-note-selection"><h2><BookOpen/>내 업무 노트</h2>{user.notes.map((note) => <label className="p-note-option" key={note.id}><input type="checkbox" checked={profile.selectedNotes.includes(note.id)} disabled={!profile.oneNote} onChange={() => update({ selectedNotes: profile.selectedNotes.includes(note.id) ? profile.selectedNotes.filter((id) => id !== note.id) : [...profile.selectedNotes, note.id] })}/><span><strong>{note.title}</strong><small>{note.updated}</small></span></label>)}</section><label className="p-select-label"><span>음성 메모를 저장할 위치</span><select value={profile.noteSection} onChange={(event) => update({ noteSection: event.target.value })}><option>SHIFT 방문 메모</option><option>외근 기록</option></select></label><p className="p-caption">방문 후 남긴 새 메모는 선택한 OneNote 섹션에 저장해요. 기존 노트는 수정하지 않아요.</p><Button trailing onClick={() => go('P2')}>선택 완료 · {profile.selectedNotes.length}개</Button></>;
  } else if (screen === 'P5') {
    content = <><div className="p-heading"><h1>차가 바뀌어도,<br/>편한 나의 위치.</h1><p>차량에서 저장한 좌석 환경을 이어 써요.</p></div><div className="p-seat-illustration"><Armchair strokeWidth={1.2}/><span>운전석 프로필</span></div><section className="p-seat-profile"><div className="p-section-title"><h2>{user.short}님의 좌석 설정</h2>{profile.seatSaved ? <Check/> : null}</div><Row title="좌석 높이" detail={profile.seatSaved ? '선호 위치가 저장돼 있어요' : '저장된 설정이 없어요'}/><Row title="앞뒤 위치" detail={profile.seatSaved ? '선호 위치가 저장돼 있어요' : '저장된 설정이 없어요'}/></section><Notice>좌석 위치는 정차한 차량에서 조정하고 저장해 주세요. 차량별 지원 범위를 확인한 뒤 적용해요.</Notice><Button onClick={() => { if (isMine) dispatch({ type: 'VEHICLE', screen: 'V8' }); else go('P6'); }}>{isMine ? '차량에서 좌석 확인' : '차량 연결하기'}</Button>{profile.seatSaved ? <button className="p-delete-link" onClick={() => { update({ seatSaved: false }); dispatch({ type: 'TOAST', text: '저장된 좌석 프로필을 삭제했어요.' }); }}>저장된 좌석 설정 삭제</button> : null}</>;
  } else if (screen === 'P6') {
    content = <><div className="p-heading p-approval-heading"><h1>차량 로그인 승인</h1><p>차량 화면의 6자리 PIN을 입력하세요.</p></div>
      <form onSubmit={(event) => { event.preventDefault(); if (pin.length === 6) dispatch({ type: 'APPROVE', pin }); }}>
        <section className="p-approval-card"><div className="p-vehicle-identity"><CarFront/><div><h2>공용차 01</h2><p>직원 {user.name}</p></div></div>
          <label className="p-pin-label"><span>차량 화면의 PIN</span><input inputMode="numeric" autoComplete="off" maxLength={6}
            value={pin} placeholder="6자리 PIN" aria-invalid={Boolean(state.approvalError)}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}/></label>
        </section>
        {state.approvalError ? <Notice type="error">{state.approvalError}</Notice> : null}
        <div className="p-approval-actions">
          <Button type="submit" disabled={pin.length !== 6}>로그인 승인</Button>
          <Button type="button" variant="secondary" onClick={() => go('P2')}>취소</Button>
        </div>
      </form><p className="p-caption">새로운 인증이 완료되면 이전 개인 세션이 종료됩니다.</p></>;
  } else if (memoScreen) {
    content = <><div className="p-heading"><h1>내 방문 메모</h1></div>
      {!canUseNotes ? <><Notice>차량의 SHIFT QR에서 로그인한 후 열 수 있습니다.</Notice><Button onClick={() => go('P6')}>차량 로그인 승인 열기</Button></>
        : screen === 'P9' ? <form className="p-memo-form" onSubmit={(event) => { event.preventDefault(); dispatch({ type: 'SAVE_PHONE_NOTE', text, visitId }); }}>
          <label className="p-select-label"><span>연결할 방문 (선택)</span>
            <select value={visitId} onChange={(event) => setVisitId(event.target.value)}>
              <option value="">방문 연결 안 함</option>
              {profile.outlook ? user.visits.map((visit) => <option key={visit.id} value={visit.id}>{visit.title}</option>) : null}
            </select>
          </label>
          <label><span>메모 내용</span>
            <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={3000}
              required aria-describedby={memoCountId} placeholder="방문 후 기억할 내용을 적어 주세요."/>
          </label>
          <p id={memoCountId} className="p-memo-counter">{text.length} / 3000자</p>
          <div className="p-memo-actions">
            <Button type="submit" disabled={!text.trim()}>메모 저장</Button>
            <Button type="button" variant="secondary" onClick={() => go('P8')}>취소</Button>
          </div>
        </form> : <>
          {state.phoneNoteSaved ? <Notice type="success">메모를 저장했습니다.</Notice> : null}
          <Button onClick={() => go('P9')}>메모 작성</Button>
          {notes.length ? <ul className="p-memo-list">{notes.map((note) => <li key={note.id}><strong>{note.title}</strong><p>{note.body}</p></li>)}</ul>
            : <p className="p-memo-empty">저장한 방문 메모가 없습니다.</p>}
          <Button variant="secondary" onClick={() => go('P3')}>업무·개인 설정 열기</Button>
        </>}
      </>;
  } else {
    content = <><div className="p-heading"><h1>개인 세션을<br/>종료할까요?</h1><p>공용차 01 · {user.name}</p></div><div className="p-end-illustration"><ShieldCheck/></div>{isMine ? <><section className="p-end-list"><h2>차량에서 정리할 정보</h2><Row title="SHIFT의 개인 업무 접근" trailing={<Check/>}/><Row title="개인 화면과 임시 데이터" trailing={<Check/>}/><Row title="작성 중인 미저장 메모" trailing={<Check/>}/></section><Notice>원본 메일과 OneNote에 저장한 메모는 그대로 남아요. 기존 내비게이션 안내도 이어집니다.</Notice>{state.memo && state.vehicle !== 'S7' ? <p className="p-unsaved">아직 저장하지 않은 메모가 있어요. 종료하기 전에 저장해 주세요.</p> : null}<Button icon={<LogOut/>} onClick={() => dispatch({ type: 'END' })}>확인하고 종료</Button><Button variant="secondary" onClick={() => go('P2')}>계속 이용하기</Button></> : <><Notice>이 계정으로 연결한 차량 세션이 없어요.</Notice><Button onClick={() => go('P2')}>내 SHIFT로</Button></>}</>;
  }

  const showBack = memoScreen || ['P3', 'P4', 'P5', 'P7'].includes(screen);
  return <div className={memoScreen ? 'phone-app is-memo' : 'phone-app'} data-screen={screen}><div className="p-statusbar"><span>10:24</span><div><Signal/><Wifi/><BatteryFull/></div></div><header className="p-header">{showBack ? <Back onClick={() => go(screen === 'P9' ? 'P8' : 'P2')} label={memoScreen ? '뒤로' : ''}/> : <Logo/>}{showBack ? <Logo inverse={memoScreen}/> : null}{screen === 'P2' ? <span className="p-avatar">{user.initials}</span> : null}</header><main className="p-content">{content}</main>{!noNav ? <nav className="p-bottom-nav" aria-label="휴대폰 앱 메뉴"><button className={screen === 'P2' ? 'is-active' : ''} onClick={() => go('P2')}><Home/><span>내 SHIFT</span></button><button className={['P3', 'P4'].includes(screen) ? 'is-active' : ''} onClick={() => go('P3')}><Link2/><span>업무 연결</span></button><button className={screen === 'P5' ? 'is-active' : ''} onClick={() => go('P5')}><SlidersHorizontal/><span>좌석</span></button></nav> : null}<div className="p-home-indicator"/></div>;
}
