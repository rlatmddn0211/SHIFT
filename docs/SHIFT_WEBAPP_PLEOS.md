# SHIFT 모바일 웹앱과 Pleos 연동

Git에서 확인한 웹 시안은 `607b691`이다. 방문 후 메모, QR 승인, 개인 세션 종료 화면은 React의 브라우저 메모리에서 동작했다. 실제 휴대폰 승인과 차량 메모 조회 화면은 시안의 디자인과 로고를 사용하고, Pleos 개발 브랜치의 기존 승인·업무 서버에 연결했다. [웹 시안 README](https://github.com/rlatmddn0211/SHIFT/blob/607b69147458088381eaaf7bfd84fad9819dd44d/prototype/README.md)

## 실행

프로젝트 루트에서 아래 명령을 실행한다. Pleos 앱 설치와 Android 휴대폰의 USB 포트 전달은 [README의 실행 절차](../README.md#pleos에서-화면-실행)를 따른다.

```powershell
npm --prefix webapp ci
npm --prefix webapp run build
npm --prefix server start
```

Pleos가 발급한 QR을 열고 현재 차량 화면의 6자리 PIN을 입력한다. 서버가 승인하면 Pleos에서 **오늘 방문 업무**가 열린다. 주차 상태에서 차량의 **음성 메모**를 저장하면 승인에 사용한 브라우저의 **내 방문 메모**에서 같은 메모를 볼 수 있다. 차량의 **QR 로그아웃**을 열고 같은 브라우저에서 승인하면 차량은 공용 로그인 화면으로 돌아간다.

`/approve/<token>`과 `/logout/<token>`에서 승인하고 `/mobile/notes`에서 메모를 읽는다. React 빌드가 없으면 기존 HTML 화면으로 같은 작업을 할 수 있다. 모바일의 **업무·개인 설정**은 기존 서버 화면에서 시트 프리셋, 브리핑, 업무 권한을 관리한다. [업무 계정 설정](SHIFT_WORKSPACE.md)

웹에서 메모를 직접 작성하려면 휴대폰의 로그인 신원과 사용자별 저장 권한을 검사하는 쓰기 API를 추가할 수 있다. 저장 경로는 기존 중복 방지와 OneNote 연동을 재사용할 수 있다. 현재 웹앱에서 제공하는 메모 기능은 차량에서 저장한 메모 조회다.

## 검증

Pleos Connect Emulator 2.1.0과 390 × 844 크기의 Chrome에서 실제 차량 QR로 승인 화면을 열었다. 틀린 PIN은 거부됐고, 올바른 PIN을 입력하자 차량에 직원 A의 **오늘 방문 업무**가 열렸다. 차량에서 한국어 시험 음성을 인식해 저장한 메모가 휴대폰에 표시됐으며 새로고침 뒤에도 남았다. 로그인에 사용한 브라우저에서 로그아웃을 승인하자 공용 차량 화면으로 돌아갔고, 직원 B의 화면과 메모에는 A의 정보가 표시되지 않았다. [모바일 승인](images/shift-web-pleos-mobile-approved.png) · [차량 업무](images/shift-web-pleos-emulator-visits.png) · [휴대폰 메모](images/shift-web-pleos-mobile-note.png)

웹 빌드와 서버 테스트 16개가 통과했다. 실물 휴대폰 카메라와 실제 Microsoft 365 계정은 이번 검증 환경에 포함되지 않았다.
