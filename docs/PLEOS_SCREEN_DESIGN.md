# SHIFT 차량 화면 디자인·개발 가이드

SHIFT는 공용차를 배정받은 직원이 차량에서 방문 일정을 확인하고, 목적지를 Pleos 기본 내비로 보낸 뒤 메모를 남기는 앱이다. 시안은 현대 시나리오의 직원 A와 B가 같은 차량에 차례로 탑승하는 흐름을 기준으로 한다. [SHIFT 기획안](PLAN.md)

## Pleos 화면 기준

- 전체 차량 화면은 Pleos Connect Emulator 2.1.0 기본 AVD의 **2560 × 1440 px, 160 dpi, 16:9**를 기준으로 한다. 상태 표시줄, Driving View, GNB는 Pleos 시스템 UI다. SHIFT 화면은 별도 앱 윈도우에 배치한다. [에뮬레이터 설치·실행](https://document.pleos.ai/docs/connect/guide/getting-started/application-development/setup-connect-sdk-emulator) · [디스플레이 구성](https://document.pleos.ai/docs/connect/guide/docs-design/getting-started/layout)
- Figma의 17인치 Connect-S 프레임에서 가로 앱 영역은 **1700 × 1184 px**, 1:1 분할 시 각 앱 영역은 **840 × 1184 px**다. 에뮬레이터 폼 팩터 테스트의 가로 **1360 × 948 dp**와 세로 **628 × 855 dp**는 별도 검토 예시다. 실행할 때 선택한 폼 팩터와 앱 윈도우 크기를 확인한다. [윈도우 정책](https://document.pleos.ai/docs/connect/guide/docs-design/getting-started/window) · [폼 팩터 테스트](https://document.pleos.ai/docs/pleos-only/app-test-guide/form-factor-test-guide)

## 시안 방향

웹 앱의 온보딩과 홈 구성은 리볼트의 간결한 정보 계층을 참고한다. Pleos에서도 여백과 정렬, 큰 제목으로 우선순위를 드러낸다. [리볼트 화면 레퍼런스](https://wwit.design/2025/03/15/revolt/)

Pleos 시안의 바탕은 짙은 네이비 `#0B1728`, 다음 방문을 강조하는 영역은 Hyundai Blue `#002C5F`다. 주요 버튼에는 Sky Blue `#AACAE6`와 짙은 글자, 본문에는 `#F7F8FA`를 사용한다. 한글은 Noto Sans KR, 영문과 숫자는 Asta Sans를 사용한다. 다음 방문의 시간과 장소를 가장 크게 배치하고, 목적지의 주소와 변경 근거는 짧게 제시한다. 화면마다 주요 동작을 하나씩 강조한다. [현대자동차 CI 전용색상](https://www.hyundai.com/kr/ko/info/ci/ci-color) · [Pleos UI 디자인 가이드](https://document.pleos.ai/docs/connect/guide/docs-design/Introduction/intro)

[오늘 방문 업무 분할 창 미리보기 (PNG)](images/shift-pleos-compact.png)

| 화면 | 화면에 남길 정보와 동작 | 완료 상태 |
| --- | --- | --- |
| 공용 대기·로그인 | 차량 식별, QR, 확인 코드(PIN), 짧은 휴대폰 안내 | 휴대폰에서 승인하면 현재 직원의 일정이 열림 |
| 오늘 방문 | 현재 직원, 다음 방문의 시간과 장소, 다른 방문 목록 | 방문을 선택하면 장소와 변경 근거를 확인할 수 있음 |
| 목적지 확인 | 확정 장소와 주소, 변경을 알린 일정 또는 메일의 제목·시각, `내비로 보내기` | Pleos 기본 내비 전송 결과를 표시하고 실패 시 재시도 제공 |
| 방문 후 메모 | 주차 상태에서 음성 입력, 인식된 텍스트, `메모 저장` | 메모 저장 결과를 표시하고 실패 시 재시도 제공 |
| 세션 종료·교대 | 로그아웃 QR, 휴대폰 승인 대기 | 승인 후 공용 대기로 복귀. 새 직원이 인증에 성공하면 기존 세션을 끝내고 새 직원 일정 표시 |

## Figma 리소스

- 작업 파일의 오늘 방문 시안은 가상의 일정과 방문 장소 변경을 알린 메일의 시각을 사용한다. 가로와 분할 창의 SHIFT 화면은 편집할 수 있다. 파일 열람은 Figma의 접근 권한을 따른다. [SHIFT Figma 작업 파일](https://www.figma.com/design/yICJ7aqxqub9JIPyEZX2BC) · [Pleos 전체 화면](https://www.figma.com/design/yICJ7aqxqub9JIPyEZX2BC?node-id=6-9966) · [분할 창 시안](https://www.figma.com/design/yICJ7aqxqub9JIPyEZX2BC?node-id=8-562)
- `Pleos_Connect_display_guide_215.fig`의 17인치 Connect-S 프레임을 기준으로 전체 차량 목업에 Pleos 시스템 UI와 앱 윈도우를 배치했다. 작업 파일에서 공식 라이트 모드의 가로·분할 프레임도 확인할 수 있다. [공식 프레임 레퍼런스](https://www.figma.com/design/yICJ7aqxqub9JIPyEZX2BC?node-id=0-1)
- `Pleos_Connect_design_assets_215.fig`의 Foundation과 Components 페이지는 색상, 글꼴, UI 컴포넌트의 레퍼런스로 쓴다. 이번 가져오기에서 로컬 변수와 페인트·텍스트 스타일은 확인되지 않았다.
- 두 원본은 [Pleos 공식 디자인 리소스](https://document.pleos.ai/docs/connect/guide/docs-design/Introduction/intro#design-resources-download)에서 내려받아 개인 Figma Drafts로 가져왔다. 팀원이 원본을 참고할 때도 링크에서 각각 내려받아 Figma 파일 브라우저에서 가져올 수 있다.

공모전 1차 시연 영상에는 목업·프로토타입·화면 녹화를 사용할 수 있다. 2차 PT에서는 실행 가능한 앱이 필요하다. GitHub를 개발 산출물로 제출할 경우 README에 실제 사용한 Pleos Connect 에뮬레이터 버전과 화면 규격을 기재한다. [공모전 지원·제출 안내](https://appdevchallenge.auto-hmg.io/guide/submission)
