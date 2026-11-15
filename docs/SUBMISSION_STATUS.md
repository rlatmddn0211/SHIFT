# SHIFT 기획서 작성 기준과 개발 현황

작성일: 2026년 11월 15일. GitHub fetch 후 코드·실행 문서를 확인해 공식 접수양식 초안을 갱신했다. 친구의 개발 브랜치는 수정하지 않고 그 최신 커밋에서 별도 문서 브랜치를 만들었다.

## 작성 파일

- [공식 양식에 채운 Word 초안](SHIFT_application_draft.docx)
- [열람용 PDF · 8쪽](SHIFT_application_preview.pdf)
- [편집 가능한 기획서 본문 · 1~8번](SUBMISSION_DRAFT.md)
- [보관한 공식 원본 양식](templates/contest-application-consent.docx)

Word에는 공식 1~8번 항목과 참고자료 하이퍼링크를 넣고, 참가 단위 ‘팀’, 부문 ‘대학(원)생’, 인원 ‘2명’, 앱명 ‘SHIFT’를 채웠다. 팀명·성명·소속·역할·이메일·연락처·작성일·개별 동의·서명·서명일은 비워 두었다. 최신 개발 README와 APK 파일명은 팀명을 SHIFT로 표기하지만 신청서의 팀명은 팀이 최종 확인해 입력하도록 남겼다.

PDF는 동일 DOCX의 본문·표·링크를 읽어 별도의 인쇄 레이아웃으로 만든 열람용 파일이다. 현재 SSH 실행 환경의 Word 자동화에서는 공식 원본도 열리지 않아 Word 자체 렌더링은 검증하지 못했다. PDF와 DOCX의 페이지 배치가 같다는 의미는 아니다. 서명 등 최종 편집은 Word에서 확인한 뒤 제출용 PDF를 다시 내보내는 편이 좋다.

## GitHub 기준

| 자료 | 확인 기준 |
| --- | --- |
| 차량 앱·연동 서버·모바일 웹·release APK | `codex/pleos-screen-dev` / `de142f6df8d7c1233e410d933dca56fd7fab82f5` |
| 최근 개발 변경 | `33c7065` 모바일 메모 작성·Pleos 조회 → `e64964e` 차량 브랜딩 통일 → `de142f6` release APK·웹 소스 패키징 |
| 최신 클릭형 웹 시안 | `design/shift-prototype-v2` / `e1ab3394eb686078087ce50a11bb01c709487072` |
| 제품 범위 | 최종 기획 v1.2: 좌석 포함, 공조·조명 제외, 음악은 휴대폰 공식 앱·차량 오디오, 예약·관리 후속 확장 |
| 공개 웹 | https://shift-pleos-demo.pages.dev/ — HTTP 200과 페이지 제목 확인. 이번 문서 작업에서는 전체 UI를 재시험하지 않음 |

구현 기록: [모바일 웹·Pleos 연동](https://github.com/rlatmddn0211/SHIFT/blob/de142f6df8d7c1233e410d933dca56fd7fab82f5/docs/SHIFT_WEBAPP_PLEOS.md), [SDK별 실행 결과](https://github.com/rlatmddn0211/SHIFT/blob/de142f6df8d7c1233e410d933dca56fd7fab82f5/docs/SHIFT_V12_DEMO.md), [실행·계정 설정](https://github.com/rlatmddn0211/SHIFT/blob/de142f6df8d7c1233e410d933dca56fd7fab82f5/docs/SHIFT_WORKSPACE.md).

## 친구가 진행한 범위

| 기능 | 저장소에서 확인한 진행 상황 | 남은 검증 |
| --- | --- | --- |
| QR·PIN / 로그아웃 / A·B 교대 | 차량·서버·모바일 승인 구현, 만료·입력 제한·재사용·이전 세션 차단 시험 | 실제 조직 계정과 원격 운영 환경 |
| 휴대폰 메모 → Pleos | 웹 작성·저장 후 차량 목록·본문 조회, 사용자별 분리 | 실제 OneNote 계정 연결 |
| 차량 메모 → 휴대폰 | 시험 음성을 인식해 로컬 시연 메모로 저장하고 웹에서 조회 | 차량 마이크 입력과 실제 OneNote 저장 |
| 내비게이션 | 공식 시험 POI를 기본 내비에 보내 안내 중인 POI 확인 | 일반 주소의 좌표·POI 일치 검증 |
| 브리핑 | Pleos 한국어 TTS 완료 응답, 외부 AI 요청·동의·실패 대체 코드 | 실제 AI 제공자와 업무 데이터 검증 |
| 좌석 | 높이·앞뒤 위치 조회, 이동·정지 명령. 위치 응답 불일치 시 중단 | 목표 위치 도달과 실차 검증 |
| 음악 | 음악 연결 안내와 Pleos Bluetooth 설정 진입 | 실물 휴대폰 페어링과 차량 오디오 재생 |
| Microsoft 365 | Entra OAuth·Graph·OneNote 코드 및 모의 응답 시험 | 권한을 승인한 실제 조직 계정 조회·저장 |
| 주행 상태 | 기어·CarUxRestrictions로 주차 전용 기능 제한 기록 | 실차·추가 창 규격에서 확인 |
| 패키징 | `apk/SHIFT_SHIFT_release.apk` 27,754,934바이트와 실행 안내, 공개 웹 소스 | 제출 직전 파일·참고 링크와 최종 커밋 선택 |

이번 작업에서 Android 빌드나 실차 시험을 다시 수행하지는 않았다. 위 에뮬레이터 동작은 해당 코드와 저장소의 실행 기록을 대조한 결과다.

## 이번에 직접 확인한 항목

- `npm --prefix server test`: 재실행 17개 통과. 첫 실행에서는 4개가 Node fetch의 `bad port` 오류로 실패했고 코드 변경 없이 재실행해 전부 통과했다. 반복된다면 테스트가 임의로 할당받는 포트를 확인할 필요가 있다.
- Word ZIP/XML 무결성, 공식 표 10개 보존, 1~8번 본문과 원본 Markdown 내용 일치, 하이퍼링크 10개.
- 개인정보 동의서·서명란의 원문이 그대로이며 동의·서명이 자동으로 채워지지 않았음을 확인.
- 열람용 PDF 8쪽, 한글 추출·항목·링크 보존, 빈 페이지·잘림 점검.
- APK ZIP 무결성. 서명 인증서와 설치·구동은 이번에 별도로 재검증하지 않았다.

## 제출 전 팀이 채울 항목

1. 팀명과 대표자·팀원 정보, 역할 및 작성일.
2. 참가자 각각의 동의 여부·본인 서명·서명일.
3. 시연 영상 링크. 숏폼은 참여하는 경우에만 입력.
4. 접수 메일에 적을 최종 전체 커밋 번호와 심사자가 열 수 있는 자료 접근 설정.

개인정보와 실제 서명을 채운 파일은 로컬 제출본으로 관리한다. 저장소에는 개인정보 없는 초안을 보관한다.

공식 안내: [지원·제출 방법](https://appdevchallenge.auto-hmg.io/guide/submission), [DOCX·PDF 및 서명·서식 안내](https://appdevchallenge.auto-hmg.io/notice/c0a1a000-2026-4923-8000-000000000007).

## 원본과 재생성

공식 원본 URL: https://appdevchallenge.auto-hmg.io/downloads/contest-application-consent.docx

SHA-256: `07be893d58b0e96ab7788f0d189d6829f0e59a2cee4bc18cb90ec37eeda2f5fd`

양식 끝의 동의서 버전은 `1020 ver.`다. 내려받은 원본은 수정하지 않았다.

Python과 lxml로 Word를 재생성한다.

```powershell
python tools/build_submission_docx.py
```

열람용 PDF는 추가로 prototype의 Playwright·Chromium 설치가 필요하다.

```powershell
python tools/render_submission_preview.py
```
