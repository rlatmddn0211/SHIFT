# SHIFT 업무·개인 설정

`codex/pleos-screen-dev`의 로컬 승인 서버에서 차량 QR로 직원 A 또는 B에 로그인하면 모바일 승인 완료 화면의 **업무·개인 설정 열기**로 들어갈 수 있습니다. **내 차량 업무 설정**에서 좌석 높이와 앞뒤 위치, 브리핑에 포함할 일정·메일, 차량에서 볼 노트를 선택합니다. 새 방문 메모는 같은 브라우저의 **내 방문 메모 열기**에서 확인합니다. [Figma 시연 흐름](https://www.figma.com/proto/yICJ7aqxqub9JIPyEZX2BC/?page-id=11%3A528&node-id=11-887)

[모바일 업무 설정](images/shift-v12-mobile-profile.png) · [Microsoft 365 권한 선택](images/shift-v12-mobile-consent.png) · [저장된 시연 메모](images/shift-v12-mobile-note.png)

## 로컬 시연

- 서버는 `npm --prefix server start`로 시작합니다. 기본 주소는 `127.0.0.1:8787`입니다.
- 직원 A는 10:30 **한빛모빌리티 미팅**과 좌석 설정 46·57, 직원 B는 11:00 **한결로보틱스 방문**과 좌석 설정 64·42로 시작합니다. 각 직원의 선택, 메모와 좌석 설정은 분리됩니다. 좌석 숫자는 시연에 쓰는 0~100의 선호도입니다.
- Pleos 내비 경로 요청을 시험할 때 서버 시작 전에 `SHIFT_ENABLE_NAV_TEST=1`을 설정합니다. 직원 A의 방문 목록 끝에 16:40 **42dot · 내비 시험**이 표시됩니다. [NaviHelper 공식 시험 목적지](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/routes)
- 프로필과 시연 메모는 사용자 홈의 `.shift/workspace.json`에 보관합니다. `SHIFT_WORKSPACE_FILE`로 시연마다 별도 저장 파일을 지정할 수 있습니다. 업무 계정 접근 토큰과 로그인 승인 상태는 서버 메모리에 있습니다.
- API는 차량 세션의 Bearer 토큰을 사용합니다. `GET /api/vehicles/hyundai-demo-01/workspace`는 당일 방문과 선택한 자료, 좌석 프로필, 브리핑을 제공합니다. `POST /api/vehicles/hyundai-demo-01/workspace/notes`에 `requestId`, `text`, 선택적 `visitId`를 보내 새 메모를 저장합니다. 재시도 시 같은 `requestId`를 사용합니다. `GET /api/vehicles/hyundai-demo-01/workspace/notes/{id}`는 선택한 노트를 조회합니다.

## Microsoft 365 시험 계정

1. Microsoft Entra에 **Web** 앱을 등록하고 `{SHIFT_PUBLIC_ORIGIN}/mobile/microsoft/callback`을 리디렉션 URI로 설정합니다. 예를 들어 로컬 시험용으로 `SHIFT_PUBLIC_ORIGIN=http://localhost:8787`을 사용한 경우 `http://localhost:8787/mobile/microsoft/callback`을 등록합니다. 실제 휴대폰에서 원격으로 시험할 때는 접속 가능한 HTTPS 주소를 사용합니다. [Microsoft 인증 흐름](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)
2. 서버 환경에 `SHIFT_MICROSOFT_CLIENT_ID`, `SHIFT_MICROSOFT_CLIENT_SECRET`, `SHIFT_MICROSOFT_TENANT`를 설정합니다. 테넌트 기본값은 `organizations`입니다. 차량 QR의 로그인 페이지에서 **Microsoft 365 계정 연결**을 열고 아래 권한 가운데 사용할 항목을 승인합니다. [Graph 위임 권한](https://learn.microsoft.com/graph/auth-v2-user)

| 선택 | 위임 권한 |
| --- | --- |
| 계정 식별과 연결 유지 | `User.Read`, `offline_access` |
| Outlook 일정 | `Calendars.Read` |
| Outlook 메일 | `Mail.Read` |
| OneNote 목록과 새 페이지 저장 | `Notes.ReadWrite` |

3. **업무·개인 설정**에서 표시할 메일과 노트를 선택합니다. 업무 화면은 한국 시간 기준 당일 일정과 최근 일주일의 중요·미확인 메일 후보를 제공합니다. 다시 불러올 때 일정의 장소나 시간이 변하면 앞서 조회한 결과와 대조해 변경 정보를 표시합니다. 고유한 일정 제목을 명시한 선택 메일이 동일한 새 주소를 안내하면 변경 근거로 표시합니다. Pleos 내비로 전달하려면 목적지 좌표와 Pleos POI ID가 필요합니다. [Outlook 메일 필드](https://learn.microsoft.com/en-us/graph/api/resources/message) · [NaviHelper 목적지](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/destinations)
4. 새 방문 메모는 기본 OneNote 노트북의 **SHIFT 방문 메모** 섹션에 추가합니다. `SHIFT_ONENOTE_SECTION`으로 섹션 이름을 지정할 수 있습니다. [OneNote 페이지 저장](https://learn.microsoft.com/en-us/graph/onenote-create-page)

현재 확인 범위는 로컬 시연과 테스트가 모사한 Microsoft 인증·Graph 응답입니다. 실제 Outlook과 OneNote 연동 시험에는 권한을 승인할 수 있는 Microsoft 365 시험 계정과 Entra 앱 등록이 필요합니다. 390px 모바일 브라우저에서 A의 시트 설정과 메모를 저장하고, B의 QR 승인으로 A의 차량 세션이 종료되는 것을 확인했습니다. B의 화면에는 B의 설정과 메모만 표시됐으며, 서버를 다시 시작한 뒤 A의 설정과 메모를 복원했습니다. `npm --prefix server test`로 프로필 보관, 사용자별 데이터 분리, 메모 재시도, Microsoft 인증 상태 검사를 재현할 수 있습니다.

## AI 브리핑 제공자

`SHIFT_BRIEFING_URL`에 조직이 승인한 HTTPS 요약 엔드포인트, `SHIFT_BRIEFING_TOKEN`에 해당 엔드포인트의 토큰을 설정합니다. 개인 설정에서 외부 요약 전송을 선택한 직원의 브리핑에만 요청합니다. 요청은 `language`, `maxCharacters`, `instruction`, 원문에서 선택한 `details`를 JSON으로 보내며 응답은 `{ "text": "…" }`입니다. 제공자가 비어 있거나 응답이 실패하면 일정과 메일에서 확인한 내용으로 브리핑을 만듭니다. `briefing.source`는 `demo`, `extractive`, `ai`로 생성 경로를 표시합니다.
