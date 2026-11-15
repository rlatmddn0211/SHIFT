# SHIFT 모바일 웹앱과 Pleos 연동

Git에서 확인한 웹 시안은 `607b691`이다. 방문 후 메모, QR 승인, 개인 세션 종료 화면은 React의 브라우저 메모리에서 동작했다. 실제 휴대폰 승인과 차량 메모 조회 화면은 시안의 디자인과 로고를 사용하고, Pleos 개발 브랜치의 기존 승인·업무 서버에 연결했다. [웹 시안 README](https://github.com/rlatmddn0211/SHIFT/blob/607b69147458088381eaaf7bfd84fad9819dd44d/prototype/README.md)

## 실행

프로젝트 루트에서 아래 명령을 실행한다. Pleos 앱 설치와 Android 휴대폰의 USB 포트 전달은 [README의 실행 절차](../README.md#제출용-apk-실행)를 따른다.

```powershell
npm --prefix webapp ci
npm --prefix webapp run build
npm --prefix server start
```

1. Pleos가 발급한 QR을 열고 현재 차량 화면의 6자리 PIN을 입력한다. 승인되면 Pleos에서 **오늘 방문 업무**가 열린다.
2. 휴대폰 웹의 **내 방문 메모 → 메모 작성**에서 최대 3,000자의 메모를 입력하고 저장한다. 방문 일정을 선택하면 메모 제목에 일정 이름이 붙는다.
3. 주차 상태에서 Pleos의 **방문 메모**를 열고 메모 제목을 누르면 같은 계정으로 저장한 본문을 볼 수 있다. 차량의 **음성 메모**에서 저장한 메모도 휴대폰 웹 목록에 표시된다.
4. 차량의 **QR 로그아웃**을 열고 승인에 사용한 브라우저에서 승인하면 차량은 공용 로그인 화면으로 돌아간다.

React 빌드를 실행하면 `/mobile/notes`에서 메모를 작성하고 조회할 수 있다. 빌드 없이 서버만 실행하면 기존 HTML의 QR 승인과 메모 조회를 사용할 수 있다. 모바일의 **업무·개인 설정**에서 시트 프리셋, 브리핑, 업무 권한을 관리한다. Microsoft 365 계정은 OneNote 권한을 허용해야 메모를 저장할 수 있다. [업무 계정 설정](SHIFT_WORKSPACE.md)

## Figma

휴대폰 메모 목록, 작성, 저장 완료와 Pleos 메모 목록·상세를 `03 · SHIFT v1.2 시연` 페이지에서 편집할 수 있다. [작성 화면 편집](https://www.figma.com/design/yICJ7aqxqub9JIPyEZX2BC/?node-id=14-63) · [클릭 시연](https://www.figma.com/proto/yICJ7aqxqub9JIPyEZX2BC/?page-id=11%3A528&node-id=14-54&starting-point-node-id=14%3A54&scaling=scale-down)

## 검증

Pleos Connect Emulator 2.1.0과 390 × 844 크기의 Chrome에서 실제 차량 QR로 승인 화면을 열었다. 틀린 PIN은 거부됐고, 올바른 PIN을 입력하자 차량에 직원 A의 **오늘 방문 업무**가 열렸다. 차량에서 한국어 시험 음성을 인식해 저장한 메모가 휴대폰에 표시됐으며 새로고침 뒤에도 남았다. 로그인에 사용한 브라우저에서 로그아웃을 승인하자 공용 차량 화면으로 돌아갔고, 직원 B의 화면과 메모에는 A의 정보가 표시되지 않았다. [모바일 승인](images/shift-web-pleos-mobile-approved.png) · [차량 업무](images/shift-web-pleos-emulator-visits.png) · [휴대폰 메모](images/shift-web-pleos-mobile-note.png)

같은 환경에서 직원 A로 로그인해 Chrome에서 방문 일정을 연결한 메모를 작성했다. 연결 오류 뒤 초안이 유지됐고, 다시 저장한 메모가 웹 새로고침 뒤에도 남았다. Pleos에서 **방문 메모**를 다시 열어 같은 제목과 본문을 확인했다. 직원 B는 웹과 Pleos에서 A의 메모에 접근할 수 없었다. [웹 작성](images/shift-web-memo-compose.png) · [웹 저장 완료](images/shift-web-memo-saved.png) · [Pleos 메모 상세](images/shift-web-memo-pleos.png)

웹 빌드, 서버 테스트 17개, Android 디버그 빌드와 lint가 통과했다. 휴대폰은 Chrome 모바일 화면으로 시뮬레이션했고 Microsoft 365 저장·조회는 모의 응답으로 검증했다.
