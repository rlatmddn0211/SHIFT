import { escapeHtml, type MobileIdentity, type WorkData } from "./microsoft-work.ts";
import { type Profile } from "./workspace-data.ts";

const styles = `
    :root { color-scheme: dark; background: #0b1728; color: #f7f8fa; font-family: system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; }
    main { max-width: 34rem; padding: 2.25rem clamp(1rem, 6vw, 1.5rem); margin: auto; }
    header { color: #aacae6; font-weight: 700; letter-spacing: .045em; margin-bottom: 1.25rem; }
    h1 { font-size: clamp(1.625rem, 7vw, 2rem); line-height: 1.25; margin: 0 0 .55rem; }
    h2, .field-title { font-size: 1.125rem; line-height: 1.4; margin: 0 0 .55rem; font-weight: 700; }
    p, li, pre { line-height: 1.55; overflow-wrap: anywhere; word-break: keep-all; margin: 0 0 .65rem; }
    .lead { margin-bottom: 1.2rem; }
    .card { min-inline-size: 0; padding: 1.05rem; margin: .85rem 0; border: 1px solid #2b3e56;
        background: #10213a; border-radius: .9rem; }
    .card > :last-child { margin-bottom: 0; }
    .card--account { background: #002c5f; }
    fieldset { min-inline-size: 0; border: 0; padding: 0; margin: 0; }
    legend { padding: 0; }
    label { padding: .25rem 0; }
    .check { min-height: 2.75rem; display: flex; align-items: center; gap: .65rem; }
    .check + .check { border-top: 1px solid #2b3e56; }
    input { font: inherit; }
    input[type=number] { display: block; width: 100%; border: 1px solid #536b85; background: #0b1728;
        color: inherit; border-radius: .65rem; padding: .65rem; margin: .4rem 0 0; }
    input[type=checkbox] { accent-color: #aacae6; width: 1.15rem; height: 1.15rem; flex: 0 0 auto; margin: 0; }
    .seat-values { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; }
    .actions { display: grid; gap: .65rem; margin-top: 1.1rem; }
    button, .button { display: inline-flex; align-items: center; justify-content: center; min-height: 3rem;
        border-radius: .7rem; padding: .65rem .85rem; border: 1px solid transparent; background: #aacae6;
        color: #0b1728; font: inherit; font-weight: 700; text-align: center; text-decoration: none; }
    .button--secondary { background: transparent; border-color: #536b85; color: #aac9e6; }
    a { color: #aacae6; }
    :focus-visible { outline: 3px solid #aacae6; outline-offset: 3px; }
    .muted { color: #afc0d5; } .error { color: #ffc5bd; }
    .status { background: #10213a; border-inline-start: .2rem solid #aacae6; padding: .7rem .85rem; }
    ul { padding-inline-start: 1.25rem; margin: 0 0 1rem; } pre { white-space: pre-wrap; font: inherit; }
`;

export function renderPage(title: string, content: string): string {
    return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml(title)} | SHIFT</title><style>${styles}</style></head><body><main><header>SHIFT</header>
        <h1>${escapeHtml(title)}</h1>${content}</main></body></html>`;
}

function checkbox(name: string, value: string, title: string, checked: boolean): string {
    return `<label class="check"><input type="checkbox" name="${name}" value="${escapeHtml(value)}"${checked ? " checked" : ""}><span>${escapeHtml(title)}</span></label>`;
}

function fieldCard(title: string, content: string): string {
    return `<div class="card"><fieldset><legend class="field-title">${title}</legend>${content}</fieldset></div>`;
}

export function permissionsPage(configured: boolean, returnTo: string, csrf: string): string {
    const back = `<a class="button button--secondary" href="${escapeHtml(returnTo)}">돌아가기</a>`;
    if (!configured) return renderPage("업무 계정 연결", `<p class="lead muted">Microsoft 365 시험 계정 연결 설정이 필요합니다.</p>${back}`);
    return renderPage("업무 계정 연결", `<p class="lead muted">사용할 기능에 필요한 권한을 선택합니다.</p>
        <form action="/mobile/microsoft/connect" method="post"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
        <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}">
        ${fieldCard("Microsoft 365 연결 범위", `
        ${checkbox("calendar", "yes", "Outlook 일정 읽기", true)}
        ${checkbox("mail", "yes", "Outlook 메일 읽기", false)}
        ${checkbox("notes", "yes", "OneNote 조회와 새 메모 저장", false)}`)}
        <p class="muted">AI 요약에 사용할 자료는 업무 설정에서 고를 수 있습니다.</p>
        <div class="actions"><button>선택한 권한으로 연결</button>${back}</div></form>`);
}

export function profilePage({ identity, profile, work, csrf, configured, notice, error }: {
    identity: MobileIdentity; profile: Profile; work: WorkData; csrf: string; configured: boolean; notice?: string; error?: string;
}) {
    const live = identity.id.startsWith("ms:");
    const mail = work.messages.map(item => checkbox("message", item.id, `${item.subject} · ${item.sender}`, profile.selectedMessages.includes(item.id))).join("");
    const notes = work.notes.map(item => checkbox("note", item.id, item.title, profile.selectedNotes.includes(item.id))).join("");
    return renderPage("내 차량 업무 설정", `<p class="lead muted">업무 계정과 시트 기본값을 관리합니다.</p>
        <section class="card card--account"><h2>${live ? "Microsoft 365" : "시연 계정"}</h2>
            <p>${escapeHtml(identity.name)} · ${live ? "Microsoft 365" : "시연 계정"}</p>
            ${live ? `<p class="muted">${[profile.calendar && "Outlook 일정", profile.mail && "Outlook 메일", profile.notes && "OneNote 방문 메모"].filter(Boolean).join(" · ") || "선택한 업무 권한이 없습니다."}</p>` : ""}
            ${configured ? `<a href="/mobile/microsoft/connect">${live ? "Microsoft 365 권한 보기" : "Microsoft 365 계정 연결"}</a>` : ""}</section>
        ${notice ? `<p class="status" role="status">${escapeHtml(notice)}</p>` : ""}${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}
        <form action="/mobile" method="post"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
        ${fieldCard("시트 프리셋", `<div class="seat-values">
            <label for="seat-height">높이 (0–100)<input id="seat-height" name="seatHeight" type="number" min="0" max="100" step="1" required value="${profile.seatHeight}"></label>
            <label for="seat-position">앞뒤 위치 (0–100)<input id="seat-position" name="seatPosition" type="number" min="0" max="100" step="1" required value="${profile.seatPosition}"></label>
            </div>`)}
        ${fieldCard("출발 전 음성 브리핑", `
            ${checkbox("speakBriefing", "yes", "선택한 업무를 음성으로 듣기", profile.speakBriefing)}
            ${checkbox("selectedCalendars", "yes", "오늘 일정 포함", profile.selectedCalendars)}
            ${checkbox("aiConsent", "yes", "외부 AI 요약 서비스에 선택한 업무 자료 전송 허용", profile.aiConsent)}`)}
        ${fieldCard("브리핑 메일", mail || '<p class="muted">선택할 메일이 없습니다.</p>')}
        ${fieldCard("차량에서 볼 노트", notes || '<p class="muted">선택할 노트가 없습니다.</p>')}
        <div class="actions"><button>설정 저장</button><a class="button button--secondary" href="/mobile/notes">내 방문 메모 열기</a></div></form>
        ${configured && live ? `<form class="actions" method="post" action="/mobile/microsoft/disconnect"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}"><button class="button--secondary">계정 연결 해제</button></form>` : ""}`);
}
