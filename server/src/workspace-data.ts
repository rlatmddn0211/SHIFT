import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { text, type Note, type WorkData, type WorkPermissions } from "./microsoft-work.ts";

export type Profile = WorkPermissions & {
    seatHeight: number;
    seatPosition: number;
    speakBriefing: boolean;
    aiConsent: boolean;
    selectedMessages: string[];
    selectedNotes: string[];
    selectedCalendars: boolean;
};
export type SavedNote = Note & { text?: string; source: "demo" | "microsoft365"; requestId: string };
type EmployeeData = { profile: Profile; notes: SavedNote[] };

const seed: Record<string, WorkData> = {
    "employee-a": {
        visits: [
            { id: "a-visit-1", time: "10:30", title: "한빛모빌리티 미팅", address: "경기 성남시 분당구 판교역로 235",
                latitude: 37.4030, longitude: 127.1069, changedFrom: "경기 성남시 분당구 판교역로 166", evidence: "장소 변경 · 09:12 수신 메일" },
            { id: "a-visit-2", time: "13:00", title: "성우테크 방문", address: "경기 성남시 분당구 판교역로 166" },
            { id: "a-visit-3", time: "15:20", title: "서진솔루션 미팅", address: "경기 성남시 분당구 대왕판교로 660" },
        ],
        messages: [{ id: "a-mail-1", subject: "한빛모빌리티 미팅 장소 변경", preview: "10시 30분 미팅 장소가 판교역로 166에서 판교역로 235로 변경됐습니다.", receivedAt: "09:12", sender: "한빛모빌리티" }],
        notes: [{ id: "a-note-1", title: "한빛모빌리티 방문 준비" }],
    },
    "employee-b": {
        visits: [
            { id: "b-visit-1", time: "11:00", title: "한결로보틱스 방문", address: "경기 수원시 영통구 광교로 145",
                latitude: 37.2935, longitude: 127.0477, changedFrom: "경기 수원시 영통구 광교로 107", evidence: "장소 변경 · 09:40 수신 메일" },
            { id: "b-visit-2", time: "14:00", title: "가온테크 미팅", address: "경기 수원시 영통구 광교로 107" },
            { id: "b-visit-3", time: "16:10", title: "동림솔루션 방문", address: "경기 수원시 영통구 센트럴타운로 85" },
        ],
        messages: [{ id: "b-mail-1", subject: "한결로보틱스 방문 장소 변경", preview: "11시 방문 장소가 광교로 107에서 광교로 145로 변경됐습니다.", receivedAt: "09:40", sender: "한결로보틱스" }],
        notes: [{ id: "b-note-1", title: "한결로보틱스 방문 준비" }],
    },
};

export function demoData(employee: string): WorkData {
    return seed[employee] ?? { visits: [], messages: [], notes: [] };
}

export function demoNoteText(id: string): string {
    if (id === "a-note-1") return "지난 제안서의 수정 항목과 납기 일정을 미팅에서 확인합니다.";
    if (id === "b-note-1") return "시연 장비의 설치 조건과 다음 회의 일정을 방문 중 확인합니다.";
    return "";
}

export function profileDefaults(employee: string): Profile {
    const demo = Object.hasOwn(seed, employee);
    return {
        seatHeight: employee === "employee-b" ? 64 : 46, seatPosition: employee === "employee-b" ? 42 : 57,
        speakBriefing: demo, aiConsent: false, calendar: demo, mail: demo, notes: demo, selectedCalendars: demo,
        selectedMessages: demoData(employee).messages.map(message => message.id),
        selectedNotes: demoData(employee).notes.map(note => note.id),
    };
}

export function createWorkspaceStore(file = process.env.SHIFT_WORKSPACE_FILE ?? join(homedir(), ".shift", "workspace.json")) {
    let all: Record<string, EmployeeData> = {};
    if (file) {
        try {
            all = JSON.parse(readFileSync(file, "utf8")) as Record<string, EmployeeData>;
            if (!all || Array.isArray(all) || typeof all !== "object") throw new Error("Invalid workspace storage");
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
    }

    function find(employee: string): EmployeeData {
        return Object.hasOwn(all, employee) ? all[employee] : { profile: profileDefaults(employee), notes: [] };
    }

    function update(employee: string, entry: EmployeeData) {
        const next = { ...all, [employee]: entry };
        if (file) {
            mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
            const tmp = `${file}.${randomUUID()}.tmp`;
            writeFileSync(tmp, JSON.stringify(next), { mode: 0o600, flag: "wx" });
            renameSync(tmp, file);
        }
        all = next;
    }

    return {
        read: find,
        saveProfile(employee: string, profile: Profile) { update(employee, { ...find(employee), profile }); },
        saveNote(employee: string, note: SavedNote) {
            const entry = find(employee);
            update(employee, { ...entry, notes: [note, ...entry.notes] });
        },
        clearMicrosoftNotes(employee: string) {
            const entry = find(employee);
            update(employee, { ...entry, notes: entry.notes.filter(note => note.source === "demo") });
        },
    };
}

export async function createBriefing(profile: Profile, data: WorkData, source: "demo" | "microsoft365", fetcher: typeof fetch) {
    const selected = profile.speakBriefing ? data.messages.filter(message => profile.selectedMessages.includes(message.id)).slice(0, 5) : [];
    const visits = profile.speakBriefing && profile.selectedCalendars ? data.visits.slice(0, 5) : [];
    const details = [
        ...visits.filter(visit => visit.changedFrom).map(visit => `${visit.time} ${visit.title} 장소가 ${visit.address}로 변경되었습니다.`),
        ...visits.filter(visit => visit.previousTime).map(visit => `${visit.title} 시간이 ${visit.previousTime}에서 ${visit.time}으로 변경되었습니다.`),
        ...selected.map(message => `${message.subject}. ${message.preview}`),
    ];
    if (!details.length && visits[0]) details.push(`다음 일정은 ${visits[0].time} ${visits[0].title}입니다.`);
    const fallback = text(details.slice(0, 3).join(" "), 360);
    const endpoint = profile.aiConsent && process.env.SHIFT_BRIEFING_URL;
    const token = process.env.SHIFT_BRIEFING_TOKEN;
    if (endpoint && token && details.length) {
        try {
            const url = new URL(endpoint);
            if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid summarizer URL");
            const response = await fetcher(url, {
                method: "POST", redirect: "error", signal: AbortSignal.timeout(5_000),
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ language: "ko", maxCharacters: 240,
                    instruction: "제공된 원본만 사용해 업무 변경 사실을 한국어로 요약하세요. 원본에 없는 내용은 추가하지 마세요.", details }),
            });
            if (response.ok) {
                const result: { text?: unknown } = await response.json();
                if (typeof result.text === "string" && result.text.trim()) return { text: text(result.text, 240), source: "ai" as const };
            }
        } catch { /* The source-based summary stays available. */ }
    }
    return { text: fallback, source: source === "demo" ? "demo" as const : "extractive" as const };
}
