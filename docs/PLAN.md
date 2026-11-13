# SHIFT 전체 기획안 v1.1

작성 기준일 2026년 11월 13일

SHIFT는 공용차를 배정받은 직원이 현대차의 Pleos Connect 차량 화면에서 자신의 방문 업무를 이어가는 앱이다. 시연의 중심은 차량 화면에서 업무를 확인하고 목적지를 전달한 뒤, 방문 기록을 남기고 개인 세션을 종료하는 경험이다.

**배정받은 차량 탑승 → SHIFT 인증 → 내 방문 업무 확인 → 목적지 전달 → 방문 후 메모 → 개인 세션 종료**

## 1 사용자와 해결할 문제

첫 적용 시나리오는 현대자동차 사내 공용차로 고객사를 방문하는 영업·외근 직원이다. 방문 일정과 변경 장소는 일정·메일에, 상담 내용은 노트에 있다. 차에 타서 목적지를 다시 입력하고 방문 후 메모를 옮기는 과정이 반복된다. 같은 차를 여러 사람이 이용하므로 교대할 때 이전 직원의 개인 업무가 차량에 남지 않도록 해야 한다.

차량은 기존 회사 절차로 이미 배정된 상태에서 시작한다. 시제품은 현대 시나리오용 시험 차량과 직원 A·B 계정으로 검증한다. 현대자동차의 실제 사내 계정·차량 운영 시스템 연동과 도입은 향후 협의 대상이다.

## 2 이번 개발 범위

| 기능 | 차량 화면에서 제공할 경험 |
| --- | --- |
| 공용 대기와 인증 | 차량 화면에서 QR을 열고 탑승한 직원이 휴대폰으로 스캔한다. 차량 화면에 표시된 간단한 확인 코드(PIN)를 휴대폰에서 입력하고 승인하면 차량 앱에 자동 로그인한다. |
| 내 방문 업무 | 현재 직원의 오늘 방문 일정과 관련 메일을 확인한다. 변경된 장소가 있으면 주소 후보와 출처를 보여준다. |
| 목적지 전달 | 사용자가 장소와 근거를 확인한 뒤 Pleos 기본 내비에 목적지를 전달한다. 경로 요청 결과를 확인해 성공 또는 실패를 표시한다. |
| 방문 후 메모 | 주차 상태에서 음성으로 새 메모를 작성하고 인식된 내용을 확인한 뒤 저장한다. OneNote를 기존 연동 대상으로 유지하고 실제 연결 조건을 확인한다. |
| 개인 세션 종료 | 차량 화면에서 로그아웃 QR을 띄워 휴대폰으로 승인하면 해당 차량의 개인 세션을 끝내고 공용 대기 화면으로 돌아간다. |
| 탑승자 교대 | 같은 차량에 탑승한 다음 직원이 자신의 계정으로 인증하면 기존 차량 세션을 만료시키고 다음 직원의 업무를 표시한다. |

휴대폰 모바일 웹은 QR 스캔 후 로그인·로그아웃 요청을 확인하는 보조 화면이다. 차량용 Android 앱이 업무 확인, 목적지 전달, 메모, 세션 상태 표시를 담당한다. 회사 가입·관리, 차량 등록·권한 요청, 예약은 §7의 향후 개발 항목이다. 음악과 그 밖의 연동 세부 범위는 §8의 후속 결정 항목이다.

## 3 QR 인증과 세션 교체

1. 탑승자가 차량 화면에서 SHIFT를 열고 로그인 QR과 확인 코드를 표시한다. 휴대폰 브라우저에서 해당 차량의 로그인 요청과 자신의 계정을 확인한다.
2. 인증된 휴대폰 이용자가 차량 화면의 짧은 일회용 PIN을 입력하고 승인하면 서버가 해당 차량의 개인 세션을 발급한다. 차량 앱은 승인 상태를 확인한 뒤 자동 로그인한다.
3. 실제 차량 화면의 요청을 보고 승인한 탑승자에게 우선권을 준다. 같은 차량에서 직원 B의 인증이 완료되면 서버는 A의 차량 세션을 무효화하고 B의 세션으로 교체한다. 차량 앱은 A의 화면·캐시를 정리하고 B의 정보를 불러온다.
4. 직원은 차량 화면에서 로그아웃 QR을 열고 휴대폰으로 그 차량의 종료 요청을 확인한다. 로그인 요청과 로그아웃 요청은 구분하고, 로그아웃은 발급 당시의 차량 세션에만 적용한다.
5. 종료 후에는 차량에 부여한 SHIFT 접근을 끊고 앱이 보관한 개인 화면·캐시를 정리한다. 회사 계정의 원본 일정·메일과 OneNote에 저장한 메모는 각 서비스에 남는다.

QR에는 개인 정보나 업무 계정 토큰을 넣지 않는다. 요청을 차량과 용도에 묶고 짧게 만료시키며, 승인된 요청은 재사용할 수 없도록 설계한다. 휴대폰 로그인과 차량 세션을 구분하고, 사용자가 바뀐 뒤 도착한 이전 세션의 응답은 화면에 반영하지 않는다. QR·PIN의 구체적인 유효 시간, 오프라인 시 세션 잠금과 복구 방식은 후속 설계에서 결정한다.

## 4 방문 업무와 메모

- **방문 업무**는 Microsoft 365 Outlook 메일과 일정을 우선 연동 대상으로 삼는다. 오늘 일정, 최근 7일의 관련 메일, 중요 표시·미확인 메일을 검토하되 정확한 필터, 요약 방식, 본문 조회 범위는 개발 중 결정한다. 업무 연동은 선택 사항이며, 권한을 준 기능에서만 데이터를 읽는다. [Microsoft Graph 권한](https://learn.microsoft.com/en-us/graph/permissions-reference)
- **목적지**는 일정 장소와 관련 메일을 근거로 제안한다. 변경 장소나 후보가 모호하면 근거를 표시하고 직원이 확인할 때만 차량 내비에 전달한다. NaviHelper의 요청 완료·실패 이벤트를 확인한다. 주소를 좌표로 변환하는 공급자와 목적지 후보 처리 방식은 후속 설계 항목이다. [NaviHelper 목적지 요청](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/destinations)
- **메모**는 Pleos SpeechToText를 이용해 음성을 텍스트로 바꾼 뒤 내용을 확인하고 저장하는 흐름으로 설계한다. OneNote는 사용자 위임 인증과 전용 섹션 새 페이지 생성을 검증한다. 기존 노트 편집은 범위에서 제외하고, 사전 선택한 노트의 조회 범위와 메모 저장 오류 처리는 추후 정한다. [Pleos STT](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/SpeechToText/intro) · [OneNote API](https://learn.microsoft.com/en-us/graph/integrate-with-onenote)
- **차량 상태**에 맞춰 기능을 제공한다. 인증, 본문 조회, 메모 편집과 종료는 우선 주차 상태에서 설계하고, 주행 중 화면과 입력은 `CarUxRestrictions` 및 앱 카테고리 기준으로 시험한다. SHIFT의 정리 범위는 앱과 서버가 관리하는 차량 세션·개인 데이터에 한한다. [Pleos 주행 규제](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/driving-restriction-development-guide) · [개인정보 설계](https://document.pleos.ai/docs/pleos-only/vehicle-app-planning-guide/security-privacy)

## 5 차량 화면과 Figma 기준

| 화면 | 주요 내용 |
| --- | --- |
| 공용 대기·SHIFT 인증 | 차량 식별, 로그인 QR, PIN, 승인 대기·실패 |
| 내 방문 업무 | 현재 직원, 오늘 방문 일정, 관련 메일, 방문지 변경 근거 |
| 목적지 확인 | 장소 후보와 출처, 전달 확인, 내비 결과 |
| 방문 후 메모 | 음성 입력, 인식 결과 확인, 저장 결과 |
| 개인 세션 종료 | 로그아웃 QR, 종료 결과, 공용 대기 복귀 |

- **전체 차량 화면 기준**은 Pleos Connect Emulator 2.1.0 기본 AVD 프로필의 **2560 × 1440 px, 160 dpi, 16:9, API 34**다. Figma에서 전체 차량 화면을 보여줄 때 이 프로필을 기준으로 잡고 SHIFT 화면은 그 안의 앱 윈도우에 배치한다. 상태 표시줄, Driving View, GNB는 Pleos의 시스템 영역이다. [에뮬레이터 설치](https://document.pleos.ai/docs/connect/guide/getting-started/application-development/setup-connect-sdk-emulator) · [공식 AVD 프로필 이미지](https://document.pleos.ai/assets/images/portal-x86-setting-up-5fb9af480965ca30f4bc9363761d78a5.png) · [디스플레이 구성](https://document.pleos.ai/docs/connect/guide/docs-design/getting-started/layout)
- **가변 앱 영역**은 Connect-S의 1:1 분할·단일 앱과 Connect-W의 2:1·1:2 배치를 참고한다. 폼 팩터 예시의 앱 영역은 14.6인치 가로 **1360 × 948 dp**와 12.9인치 세로 **628 × 855 dp**다. 이 수치는 설계·검증에 활용할 예시이며, 실제 테스트에서 선택한 앱 창의 크기를 FormFactorConsole에서 확인한다. [윈도우 정책](https://document.pleos.ai/docs/connect/guide/docs-design/getting-started/window) · [폼 팩터 테스트](https://document.pleos.ai/docs/pleos-only/app-test-guide/form-factor-test-guide)
- 시안이 필요하면 Pleos가 제공하는 Figma 디스플레이 가이드와 디자인 에셋을 사용한다. 공모전 제출 가이드는 사용한 에뮬레이터 버전과 화면 규격을 README에 기재하도록 안내한다. [Figma 리소스 다운로드](https://document.pleos.ai/docs/connect/guide/docs-design/Introduction/intro#design-resources-download) · [공모전 제출 안내](https://appdevchallenge.auto-hmg.io/guide/submission)

## 6 개발 구성

| 구성 | 기본안 |
| --- | --- |
| 차량 앱 | Kotlin 기반 Pleos Connect Android 앱. Android API 28 이상 및 Gradle 8 이상 환경에서 Pleos SDK를 사용한다. |
| 휴대폰 승인 | 브라우저에서 여는 최소 승인 화면. QR 요청과 차량을 확인하고 PIN을 입력하거나 로그아웃을 승인한다. |
| 앱 서버 | Node.js LTS·TypeScript 단일 서비스가 모바일 승인 화면과 HTTPS REST API를 제공한다. 차량 앱은 인증 대기 중 서버에서 승인 상태를 조회한다. |
| 데이터 저장 | PostgreSQL에 시연용 조직·차량·사용자 식별자, 승인 요청과 차량 세션을 저장한다. 차량마다 활성 개인 세션은 하나다. |
| 시연 배포 | AWS 서울 리전 Lightsail 인스턴스와 비공개 관리형 PostgreSQL을 기본안으로 한다. 도메인·비용·배포 계정 등 운영 설정은 추후 정한다. |

사용 사례가 많고 공식 문서가 갖춰진 기술을 기본안으로 선택했다. Stack Overflow 2026 조사에서 Node.js와 PostgreSQL은 각 조사 항목에서 가장 많이 사용됐고, AWS는 Synergy의 2026년 3분기 클라우드 인프라 조사에서 선두였다. [Node.js 조사](https://survey.stackoverflow.co/2026/technology/data/web-framework) · [PostgreSQL 조사](https://survey.stackoverflow.co/2026/technology/data/databases) · [클라우드 시장 조사](https://www.srgresearch.com/articles/cloud-market-growth-rate-surges-to-well-over-50-per-year-q3-revenues-reach-168-billion) · [Lightsail 리전](https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-regions-and-availability-zones-in-amazon-lightsail.html) · [Lightsail PostgreSQL](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-databases.html)

업무 계정은 Microsoft 365를 우선 검증한다. 시험 계정의 메일·일정·OneNote 접근, Entra 앱 등록과 사용자·관리자 동의는 실제 시험 전에 확인한다. 차량 앱은 SHIFT의 차량 세션으로 서버에 접근하고, Microsoft 연동은 필요한 사용자 위임 권한을 사용한다. 구현 진행과 자료 공유는 `rlatmddn0211/SHIFT`에서 관리하며 차량 앱 작업 위치는 `app/`이다. [공모전 개발 환경](https://appdevchallenge.auto-hmg.io/guide/development)

## 7 향후 확장

- **여러 회사**를 등록할 수 있는 모델을 계획한다. 회사 목록·구조 예시는 **A회사, B회사, 현대**로 제시하고, 동작하는 시제품은 **현대** 시나리오 한 곳으로 구성한다. A회사와 B회사는 확장 예시로 표시한다.
- **회사와 차량 운영**이 추가되면 팀이 회사 관리자를 직접 지정한다. 관리자는 차량 이용 권한을 부여하고 직원은 권한을 요청할 수 있다. 차량 등록에는 등록 코드 또는 QR을 사용한다. 등록 QR은 차량 등록에, 탑승 후 QR은 개인 세션의 시작과 종료에 사용한다. 관리자에게 제공할 기록은 예약·이용 시간과 수동 인계 메모로 제한하는 기존 방향을 유지한다.
- **예약**은 기존 차량 배정 흐름을 SHIFT에서 관리할 수 있도록 확장하는 단계다. 예약, 즉시 이용, 취소·연장, 중복 확인의 정책은 이 단계에서 구체화한다. 예약 종료 알림, 유예 시간과 기록 보유 기간도 이 단계의 미정 항목이다.
- 현대 시나리오로 방문 준비 시간, 메모 저장 성공, 교대 후 정보 분리를 검증한다. 운영 부서와 실증을 협의한 뒤 다른 회사로 확대할 수 있다. 실증 규모, 예상 MAU와 재이용률 목표는 사용 환경과 시험 결과를 확인한 뒤 정한다.

## 8 후속 결정 항목

| 항목 | 추후 정할 내용 |
| --- | --- |
| 인증과 종료 | 휴대폰 계정 로그인 상세, PIN 길이·유효 시간, 재시도·동시 승인·오프라인 처리, 원격 종료 방식 |
| 업무 연동 | 시험 계정과 권한, 요약·주소 검색 방식, 외부 데이터 처리와 동의, OneNote 조회 단위·저장 오류 처리 |
| 운전자 화면 | 실제 주행 중 허용 기능, 가로·세로 및 분할 창 우선순위, 기본 내비에 전달한 주소 등 타 앱 정보 처리 |
| 음악과 인계 | 기존 후보인 YouTube Music의 적용 여부와 직접 연동 또는 휴대폰 공식 앱·차량 오디오 경로, 차량 상태와 인계 메모 범위 |
| 팀과 운영 | 팀명·분담·일정, 시안·영상 제작, 배포 비용·계정, 실증과 운영 기록 보유 기간 |

## 9 공모전 제출과 시연

1차 접수 계획은 공식 기획서, 화면 시안과 클릭형 프로토타입 영상이다. 마감은 11월 15일 23:59 KST이며, 팀명과 참가자별 동의·서명·날짜, 참고자료 링크는 제출 전에 준비한다. 1차 결과 발표는 11월 23일이고, 12월 3~4일 2차 PT는 Pleos Connect 에뮬레이터에서 실제 동작하는 앱을 시연한다. [제출 안내](https://appdevchallenge.auto-hmg.io/guide/submission) · [공식 일정](https://appdevchallenge.auto-hmg.io/guide/schedule) · [에뮬레이터 시연 공지](https://appdevchallenge.auto-hmg.io/notice/c0a1a000-2026-4923-8000-000000000008)

2차 시연은 현대 시연 차량 한 대에 A와 B가 차례로 탑승하는 장면을 사용한다. A는 QR·PIN 인증 후 변경된 방문지를 확인해 차량 내비로 보내고, 방문 후 메모를 확인해 저장한 뒤 QR로 로그아웃한다. B는 같은 차량에 로그인해 자신의 업무를 본다. 추가로 A가 로그아웃을 놓친 경우 B의 새 인증이 A의 세션과 화면을 교체하는지 검증한다. 시험에는 실제 고객과 구분된 데이터를 사용하며, 연동이 확인된 동작과 시안·시험 데이터는 명시한다.
