# SHIFT 차량 화면 디자인·개발 가이드

SHIFT는 공용차를 배정받은 직원이 차량에서 방문 일정을 확인하고, 목적지를 Pleos 기본 내비로 보낸 뒤 메모를 남기는 앱이다. 시안은 현대 시나리오의 직원 A와 B가 같은 차량에 차례로 탑승하는 흐름을 기준으로 한다. [SHIFT 기획안](PLAN.md)

## Pleos 화면 기준

- 전체 차량 화면은 Pleos Connect Emulator 2.1.0 기본 AVD의 **2560 × 1440 px, 160 dpi, 16:9**를 기준으로 한다. 상태 표시줄, Driving View, GNB는 Pleos 시스템 UI다. SHIFT 화면은 별도 앱 윈도우에 배치한다. [에뮬레이터 설치·실행](https://document.pleos.ai/docs/connect/guide/getting-started/application-development/setup-connect-sdk-emulator) · [디스플레이 구성](https://document.pleos.ai/docs/connect/guide/docs-design/getting-started/layout)
- Figma의 17인치 Connect-S 프레임에서 가로 앱 영역은 **1700 × 1184 px**, 1:1 분할 시 각 앱 영역은 **840 × 1184 px**다. 에뮬레이터 폼 팩터 테스트의 가로 **1360 × 948 dp**와 세로 **628 × 855 dp**는 별도 검토 예시다. 실행할 때 선택한 폼 팩터와 앱 윈도우 크기를 확인한다. [윈도우 정책](https://document.pleos.ai/docs/connect/guide/docs-design/getting-started/window) · [폼 팩터 테스트](https://document.pleos.ai/docs/pleos-only/app-test-guide/form-factor-test-guide)

## 시안 방향

웹 앱의 온보딩과 홈 구성은 리볼트의 간결한 정보 계층을 참고한다. Pleos에서도 여백과 정렬, 큰 제목으로 우선순위를 드러낸다. [리볼트 화면 레퍼런스](https://wwit.design/2025/03/15/revolt/)

Pleos는 공개 웹 시연의 짙은 네이비 `#0B1728`, 다음 방문 카드의 Hyundai Blue `#002C5F`, 주요 버튼의 Sky Blue `#AACAE6`를 사용한다. 한글 제목과 본문은 Noto Sans KR, PIN과 일정 시각은 Asta Sans로 표시한다. 웹의 워드마크와 파비콘을 Android 벡터로 옮겨 앱 상단과 실행 아이콘에 적용했다. 주요 기능의 버튼 아이콘은 웹과 같은 Lucide 벡터를 사용한다. [공개 웹 시연](https://shift-pleos-demo.pages.dev/) · [웹 디자인 소스](https://github.com/rlatmddn0211/SHIFT/tree/e1ab3394eb686078087ce50a11bb01c709487072/prototype)

공용 로그인, 운전자 교대, QR 로그아웃은 남색 QR 카드와 같은 버튼 스타일을 사용한다. 가로 창은 다음 방문과 이후 일정을 나란히 배치하고, 좁은 창은 위아래로 배치한다. 저장한 메모 본문은 웹 시연과 같은 밝은 읽기 카드에 표시한다. [가로 업무 화면](images/shift-style-pleos-wide-dashboard.png) · [웹에서 저장한 메모 상세](images/shift-style-pleos-wide-memo.png)

| 화면 | 화면에 남길 정보와 동작 | 완료 상태 |
| --- | --- | --- |
| 공용 대기·로그인 | 차량 식별, QR, 확인 코드(PIN), 짧은 휴대폰 안내 | 휴대폰에서 승인하면 현재 직원의 일정이 열림 |
| 오늘 방문 | 현재 직원, 다음 방문의 시간과 장소, 다른 방문 목록 | 방문을 선택하면 장소와 변경 근거를 확인할 수 있음 |
| 목적지 확인 | 확정 장소와 주소, 변경을 알린 일정 또는 메일의 제목·시각, `내비로 보내기` | Pleos 기본 내비 전송 결과를 표시하고 실패 시 재시도 제공 |
| 방문 후 메모 | 주차 상태에서 음성 메모 작성, 웹에서 저장한 방문 메모 조회 | 메모 목록에서 제목을 선택해 본문 확인 |
| 세션 종료·교대 | 로그아웃 QR, 휴대폰 승인 대기 | 승인 후 공용 대기로 복귀. 새 직원이 인증에 성공하면 기존 세션을 끝내고 새 직원 일정 표시 |

## Figma 리소스

- `03 · SHIFT v1.2 시연`에 웹 공용 디자인을 반영한 편집 프레임 네 개를 추가했다. [공용차 로그인](https://www.figma.com/design/yICJ7aqxqub9JIPyEZX2BC/?node-id=18-144) · [오늘 방문 업무](https://www.figma.com/design/yICJ7aqxqub9JIPyEZX2BC/?node-id=18-171) · [방문 메모](https://www.figma.com/design/yICJ7aqxqub9JIPyEZX2BC/?node-id=18-206) · [메모 상세](https://www.figma.com/design/yICJ7aqxqub9JIPyEZX2BC/?node-id=18-226)
- 작업 파일의 오늘 방문 시안은 가상의 일정과 방문 장소 변경을 알린 메일의 시각을 사용한다. 가로와 분할 창의 SHIFT 화면은 편집할 수 있다. 파일 열람은 Figma의 접근 권한을 따른다. [SHIFT Figma 작업 파일](https://www.figma.com/design/yICJ7aqxqub9JIPyEZX2BC) · [Pleos 전체 화면](https://www.figma.com/design/yICJ7aqxqub9JIPyEZX2BC?node-id=6-9966) · [분할 창 시안](https://www.figma.com/design/yICJ7aqxqub9JIPyEZX2BC?node-id=8-562)
- `Pleos_Connect_display_guide_215.fig`의 17인치 Connect-S 프레임을 기준으로 전체 차량 목업에 Pleos 시스템 UI와 앱 윈도우를 배치했다. 작업 파일에서 공식 라이트 모드의 가로·분할 프레임도 확인할 수 있다. [공식 프레임 레퍼런스](https://www.figma.com/design/yICJ7aqxqub9JIPyEZX2BC?node-id=0-1)
- `Pleos_Connect_design_assets_215.fig`의 Foundation과 Components 페이지는 색상, 글꼴, UI 컴포넌트의 레퍼런스로 쓴다. 이번 가져오기에서 로컬 변수와 페인트·텍스트 스타일은 확인되지 않았다.
- 두 원본은 [Pleos 공식 디자인 리소스](https://document.pleos.ai/docs/connect/guide/docs-design/Introduction/intro#design-resources-download)에서 내려받아 개인 Figma Drafts로 가져왔다. 팀원이 원본을 참고할 때도 링크에서 각각 내려받아 Figma 파일 브라우저에서 가져올 수 있다.

공모전 1차 시연 영상에는 목업·프로토타입·화면 녹화를 사용할 수 있다. 2차 PT에서는 실행 가능한 앱이 필요하다. GitHub를 개발 산출물로 제출할 경우 README에 실제 사용한 Pleos Connect 에뮬레이터 버전과 화면 규격을 기재한다. [공모전 지원·제출 안내](https://appdevchallenge.auto-hmg.io/guide/submission)
