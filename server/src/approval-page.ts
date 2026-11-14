export const employees = new Map([
    ["employee-a", "직원 A"],
    ["employee-b", "직원 B"],
]);

type Page = {
    title: string;
    vehicleName?: string;
    notice?: string;
    action?: string;
    purpose?: "logout";
    selectedEmployee?: string;
    error?: string;
};

function escapeHtml(value: string): string {
    const entities: Record<string, string> = {
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    };
    return value.replace(/[&<>"']/g, (character) => entities[character]);
}

export function approvalPage(page: Page): string {
    let form = "";
    if (page.action && page.purpose === "logout") {
        form = `<form method="post" action="${escapeHtml(page.action)}">
            <button type="submit">로그아웃 승인</button>
        </form>`;
    } else if (page.action) {
        const employeeOptions = Array.from(employees, ([id, name]) => `
            <option value="${escapeHtml(id)}"${id === page.selectedEmployee ? " selected" : ""}>${escapeHtml(name)}</option>
        `).join("");
        form = `<form method="post" action="${escapeHtml(page.action)}">
            <label for="employee">시연 계정</label>
            <select id="employee" name="employee" required>${employeeOptions}</select>
            <label for="pin">차량 화면의 PIN</label>
            <input id="pin" name="pin" type="text" inputmode="numeric" autocomplete="off"
                pattern="[0-9]{6}" maxlength="6" placeholder="6자리 PIN" required
                ${page.error ? 'aria-invalid="true" aria-describedby="pin-error"' : ""}>
            ${page.error ? `<p class="error" id="pin-error" role="alert">${escapeHtml(page.error)}</p>` : ""}
            <button type="submit">로그인 승인</button>
        </form>
        <p class="demo">시연 계정을 사용합니다. Microsoft 365 계정 연동은 준비 중입니다.</p>`;
    }

    return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>${escapeHtml(page.title)} | SHIFT</title>
<style>
    :root { color-scheme: dark; background: #0b1728; color: #f7f8fa; font-family: system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; }
    main { max-width: 30rem; margin: auto; padding: clamp(1.5rem, 5vh, 3rem) 1.5rem; }
    header { color: #aacae6; font-size: 1rem; font-weight: 700; margin-bottom: 1.5rem; }
    h1 { font-size: 1.75rem; line-height: 1.3; margin: 0 0 1rem; }
    p { line-height: 1.55; margin: 0 0 1rem; word-break: keep-all; overflow-wrap: anywhere; }
    .vehicle { padding: .875rem 1rem; background: #002c5f; border-radius: .875rem; font-weight: 700; }
    .notice, .demo { color: #afc0d5; }
    form { display: grid; gap: .625rem; margin: 1.5rem 0; }
    label { margin-top: .375rem; font-weight: 600; }
    input, select, button { inline-size: 100%; min-height: 3.25rem; border-radius: .75rem; font: inherit; }
    input, select { border: 1px solid #536b85; padding: .75rem; margin-bottom: .375rem;
        color: #f7f8fa; background: #101f33; }
    input::placeholder { color: #afc0d5; }
    button { margin-top: .625rem; border: 0; background: #aacae6; color: #0b1728; font-weight: 700; }
    :focus-visible { outline: 3px solid #aacae6; outline-offset: 3px; }
    .error { color: #ffc5bd; margin-bottom: 0; }
    .demo { font-size: .875rem; }
</style>
</head>
<body>
<main>
    <header>SHIFT</header>
    <h1>${escapeHtml(page.title)}</h1>
    ${page.vehicleName ? `<p class="vehicle">${escapeHtml(page.vehicleName)}</p>` : ""}
    ${page.notice ? `<p class="notice">${escapeHtml(page.notice)}</p>` : ""}
    ${form}
</main>
</body>
</html>`;
}
