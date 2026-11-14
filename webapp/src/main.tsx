import { useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { BookOpen, CarFront, CheckCircle2, ChevronRight, ShieldCheck } from 'lucide-react';
import logo from './shift-logo.svg';
import './styles.css';

type Approval = {
  kind: 'approval' | 'logout';
  title: string;
  status: string;
  vehicleName?: string;
  notice?: string;
  action?: string;
  accountName?: string;
  connectUrl?: string;
  profileUrl?: string;
  error?: string;
  selectedEmployee?: string;
  employees?: { id: string; name: string }[];
};

type Note = { id: string; title: string; text?: string; sourceUrl?: string; source: string };
type Notes = { kind: 'notes'; title: string; notes: Note[]; profileUrl?: string; message?: string };
type PhonePage = Approval | Notes;

async function loadPage(path: string, fields?: URLSearchParams, signal?: AbortSignal): Promise<PhonePage> {
  const response = await fetch(path, {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
    signal,
    ...(fields ? { method: 'POST', body: fields } : {}),
  });
  if (!response.headers.get('content-type')?.startsWith('application/json')) throw new Error('Invalid response');
  const page = await response.json();
  if (!['approval', 'logout', 'notes'].includes(page?.kind) || typeof page.title !== 'string') {
    throw new Error('Invalid page');
  }
  return page;
}

function ApprovalPage({ page, onSubmit, busy }: {
  page: Approval;
  onSubmit: (action: string, fields: URLSearchParams) => Promise<void>;
  busy: boolean;
}) {
  const [pin, setPin] = useState('');
  const [employee, setEmployee] = useState(page.selectedEmployee ?? '');
  const logout = page.kind === 'logout';
  const approved = page.status === 'approved';
  const formAction = page.action;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formAction || busy) return;
    const fields = new URLSearchParams();
    if (!logout) {
      fields.set('pin', pin);
      if (!page.accountName) fields.set('employee', employee);
    }
    setPin('');
    await onSubmit(formAction, fields);
  }

  return <>
    <h1>{page.title}</h1>
    {page.notice && <p className="muted" role={approved ? 'status' : undefined}>{page.notice}</p>}
    {page.vehicleName && <section className="card vehicle">
      {approved ? <CheckCircle2 aria-hidden="true"/> : logout ? <ShieldCheck aria-hidden="true"/> : <CarFront aria-hidden="true"/>}
      <div><h2>{page.vehicleName}</h2>{page.accountName && !logout && <p>{page.accountName} · Microsoft 365</p>}</div>
    </section>}
    {formAction && <form onSubmit={submit}>
      {!logout && <>
        {!page.accountName && <label>시연 계정
          <select name="employee" value={employee} onChange={event => setEmployee(event.target.value)} required>
            <option value="" disabled>직원을 선택하세요</option>
            {page.employees?.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </label>}
        <label>차량 화면의 PIN
          <input name="pin" type="text" inputMode="numeric" autoComplete="off" pattern="[0-9]{6}"
            maxLength={6} placeholder="6자리 PIN" required value={pin}
            onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
            aria-invalid={Boolean(page.error)} aria-describedby={page.error ? 'pin-error' : undefined}/>
        </label>
      </>}
      {page.error && <p className="error" id="pin-error" role="alert">{page.error}</p>}
      <button type="submit" disabled={busy}>{busy ? '승인 확인 중…' : logout ? '로그아웃 승인' : '로그인 승인'}</button>
    </form>}
    {page.connectUrl && <a className="text-link" href={page.connectUrl}>Microsoft 365 계정 연결</a>}
    {page.profileUrl && <div className="links">
      <a className="button secondary" href={page.profileUrl}>업무·개인 설정 열기</a>
      <a className="button secondary" href="/mobile/notes">내 방문 메모 <ChevronRight aria-hidden="true"/></a>
    </div>}
  </>;
}

function NotesPage({ page }: { page: Notes }) {
  return <>
    <h1>{page.title}</h1>
    {page.message ? <p className="muted">{page.message}</p> : page.notes.length === 0 ?
      <p className="muted">저장한 방문 메모가 없습니다.</p> :
      <ul className="notes">{page.notes.map(note => <li className="card" key={note.id}>
        <BookOpen size={19} aria-hidden="true"/>
        <div><h2>{note.title}</h2>
          {note.text && <p className="note-body">{note.text}</p>}
          {note.sourceUrl && <a className="text-link" href={note.sourceUrl} rel="noreferrer">OneNote에서 열기</a>}
        </div>
      </li>)}</ul>}
    {page.profileUrl && <a className="button secondary" href={page.profileUrl}>업무·개인 설정 열기</a>}
  </>;
}

function App() {
  const [page, setPage] = useState<PhonePage>();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const path = window.location.pathname;

  useEffect(() => {
    const controller = new AbortController();
    loadPage(path, undefined, controller.signal).then(setPage).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, [path]);

  useEffect(() => {
    if (page) document.title = `${page.title} | SHIFT`;
  }, [page]);

  async function submit(action: string, fields: URLSearchParams) {
    setFailed(false);
    setBusy(true);
    try {
      setPage(await loadPage(action, fields));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return <main className="phone">
    <header><img src={logo} alt="SHIFT" /></header>
    {failed && <div className="connection-error" role="alert">
      <p>서버에 연결하지 못했습니다.</p>
      <button className="secondary" onClick={() => window.location.reload()}>다시 확인</button>
    </div>}
    {!page && !failed && <p role="status">불러오는 중…</p>}
    {page && (page.kind === 'notes' ? <NotesPage page={page}/> :
      <ApprovalPage page={page} onSubmit={submit} busy={busy}/>)}
  </main>;
}

createRoot(document.getElementById('root')!).render(<App/>);
