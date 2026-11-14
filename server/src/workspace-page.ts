import { escapeHtml, type MobileIdentity, type WorkData } from "./microsoft-work.ts";
import { type Profile } from "./workspace-data.ts";

const styles = `
    :root { color-scheme: dark; background: #0b1728; color: #f7f8fa; font-family: system-ui, sans-serif; }
    * { box-sizing: border-box; } body { margin: 0; } main { max-width: 36rem; padding: 2rem 1.5rem; margin: auto; }
    header { color: #aacae6; font-weight: 700; margin-bottom: 1rem; } h1 { font-size: 1.75rem; margin: 0 0 1rem; }
    h2 { font-size: 1.2rem; margin: 0 0 .75rem; } p, li, pre { line-height: 1.6; overflow-wrap: anywhere; }
    fieldset, section { padding: 1rem; margin: 1rem 0; border: 1px solid #2b3e56; border-radius: .8rem; }
    legend { padding: .35rem .45rem; font-weight: 700; } label { display: block; padding: .65rem 0; }
    input { font: inherit; } input[type=number] { display: block; width: 100%; border: 1px solid #536b85; background: #101f33;
        color: inherit; border-radius: .6rem; padding: .75rem; margin: .45rem 0 0; } input[type=checkbox] { accent-color: #aacae6; }
    button, .button { display: inline-block; background: #aacae6; color: #0b1728; border-radius: .65rem; padding: .85rem 1.2rem;
        min-height: 3rem; border: 0; font: inherit; font-weight: 700; text-decoration: none; } a { color: #aacae6; }
    :focus-visible { outline: 3px solid #aacae6; outline-offset: 3px; } .muted { color: #afc0d5; } .error { color: #ffc5bd; }
    ul { padding-inline-start: 1.25rem; } pre { white-space: pre-wrap; font: inherit; }
`;

export function renderPage(title: string, content: string): string {
    return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml(title)} | SHIFT</title><style>${styles}</style></head><body><main><header>SHIFT</header>
        <h1>${escapeHtml(title)}</h1>${content}</main></body></html>`;
}

function checkbox(name: string, value: string, title: string, checked: boolean): string {
    return `<label><input type="checkbox" name="${name}" value="${escapeHtml(value)}"${checked ? " checked" : ""}> ${escapeHtml(title)}</label>`;
}

export function permissionsPage(configured: boolean, returnTo: string, csrf: string): string {
    if (!configured) return renderPage("Microsoft 365 연결", `<p>Microsoft 365 시험 계정 연결 설정이 필요합니다.</p><a href="${escapeHtml(returnTo)}">돌아가기</a>`);
    return renderPage("Microsoft 365 연결", `<p>차량에서 사용할 업무 항목을 선택하세요. Microsoft 로그인에서 계정 접근을 승인할 수 있습니다.</p>
        <form action="/mobile/microsoft/connect" method="post"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
        <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}"><fieldset><legend>업무 계정 접근 권한</legend>
        ${checkbox("calendar", "yes", "Outlook 일정 읽기", true)}
        ${checkbox("mail", "yes", "Outlook 메일 읽기", false)}
        ${checkbox("notes", "yes", "OneNote 목록 조회와 새 메모 저장", false)}
        </fieldset><button>Microsoft에서 연결</button></form>`);
}

export function profilePage({ identity, profile, work, csrf, configured, notice, error }: {
    identity: MobileIdentity; profile: Profile; work: WorkData; csrf: string; configured: boolean; notice?: string; error?: string;
}) {
    const live = identity.id.startsWith("ms:");
    const mail = work.messages.map(item => checkbox("message", item.id, `${item.subject} · ${item.sender}`, profile.selectedMessages.includes(item.id))).join("");
    const notes = work.notes.map(item => checkbox("note", item.id, item.title, profile.selectedNotes.includes(item.id))).join("");
    return renderPage("업무·개인 설정", `<p>${escapeHtml(identity.name)} · ${live ? "Microsoft 365" : "시연 계정"}</p>
        ${notice ? `<p role="status">${escapeHtml(notice)}</p>` : ""}${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}
        <form action="/mobile" method="post"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
        <fieldset><legend>운전석 설정</legend>
            <label for="seat-height">높이 (0–100)<input id="seat-height" name="seatHeight" type="number" min="0" max="100" step="1" required value="${profile.seatHeight}"></label>
            <label for="seat-position">앞뒤 위치 (0–100)<input id="seat-position" name="seatPosition" type="number" min="0" max="100" step="1" required value="${profile.seatPosition}"></label>
        </fieldset><fieldset><legend>출발 전 음성 브리핑</legend>
            ${checkbox("speakBriefing", "yes", "선택한 업무를 음성 브리핑에 표시", profile.speakBriefing)}
            ${checkbox("selectedCalendars", "yes", "오늘 일정 포함", profile.selectedCalendars)}
            ${checkbox("aiConsent", "yes", "설정된 외부 AI 요약 서비스에 이 선택 항목 전송 허용", profile.aiConsent)}
        </fieldset><fieldset><legend>브리핑 메일</legend>${mail || '<p class="muted">선택할 메일이 없습니다.</p>'}</fieldset>
        <fieldset><legend>차량에서 볼 노트</legend>${notes || '<p class="muted">선택할 노트가 없습니다.</p>'}</fieldset>
        <button>설정 저장</button></form>
        <section><h2>휴대폰에서 방문 메모 보기</h2><a href="/mobile/notes">내 메모 열기</a></section>
        ${configured ? `<section><h2>업무 계정</h2><a href="/mobile/microsoft/connect">${live ? "접근 권한 다시 선택" : "Microsoft 365 연결"}</a>
        ${live ? `<form method="post" action="/mobile/microsoft/disconnect"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}"><p><button>연결 해제</button></p></form>` : ""}</section>` : ""}`);
}
