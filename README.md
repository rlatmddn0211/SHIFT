# SHIFT

SHIFT는 공용차를 배정받은 직원이 현대차의 Pleos Connect 차량 화면에서 방문 업무를 확인하고, 목적지를 내비게이션에 보내고, 방문 후 메모를 남기는 차량용 앱입니다.

**배정받은 차량 탑승 → SHIFT 인증 → 내 방문 업무 확인 → 목적지 전달 → 방문 후 메모 → 개인 세션 종료**

차량에서 QR과 PIN으로 인증한 탑승자의 업무가 열립니다. QR로 로그아웃하거나 새 탑승자가 인증하면 기존 차량 세션을 종료합니다. 첫 시제품은 현대 시나리오에 집중하고, A회사·B회사는 조직 확장 예시로 제시합니다. 회사 관리, 차량 등록과 권한 요청, 예약은 후속 개발 항목입니다.

## 기획 문서

- [전체 기획안 v1.1](docs/PLAN.md)
- [최종 기획안 v1.2](https://github.com/rlatmddn0211/SHIFT/blob/aeda8d4c3b82be50da4d7a23d391b591580507f5/docs/PLAN.md)
- [결정 기록](docs/DECISIONS.md)
- [공모전 작품 소개 초안](docs/SUBMISSION_DRAFT.md)
- [공식 접수양식에 본문을 넣은 Word 초안](docs/SHIFT_application_draft.docx)
- [Pleos 차량 화면 디자인·개발 가이드](docs/PLEOS_SCREEN_DESIGN.md)

Word 초안에는 작품 소개 본문이 들어 있습니다. 참가자 정보, 팀명, 전원 동의·서명과 최종 참고자료 링크는 제출 전에 작성합니다.

## Pleos에서 화면 실행

Pleos의 **공용차 로그인** 화면에서 QR을 스캔하고 모바일 웹에 6자리 일회용 PIN을 입력하면 **오늘 방문 업무** 화면으로 자동 전환됩니다. 직원 A와 B는 각자 다른 예시 일정을 봅니다. PIN은 2분 동안 유효하며 5회 틀리면 잠깁니다. 다른 직원의 승인이 완료되면 이전 차량 세션이 만료됩니다.

이번 시연은 로컬 승인 서버, 메모리 세션, 시연 계정을 사용합니다. 실제 Microsoft 365 계정 연동, QR 로그아웃과 목적지 전송은 후속 구현입니다. **내비로 보내기**를 누르면 주소와 시연 안내가 표시됩니다.

Node.js 24.12 이상, JDK 17 또는 21, Android SDK Platform 34, Build Tools 35.0.0, Platform-Tools를 준비합니다. `ANDROID_HOME`을 Android SDK 경로로 설정한 뒤 Pleos Connect Emulator를 실행합니다. [공식 에뮬레이터 가이드](https://document.pleos.ai/docs/connect/guide/getting-started/application-development/setup-connect-sdk-emulator)

저장소 루트에서 서버를 실행한 상태로 둡니다. 기본 주소는 `http://127.0.0.1:8787`이며, 에뮬레이터는 `http://10.0.2.2:8787`로 같은 서버에 접속합니다.

```powershell
npm --prefix server start
```

다른 터미널에서 빌드하고 차량 앱을 엽니다. 아래 Gradle 옵션은 Windows 작업 경로에 한글이 있는 경우에 사용합니다.

```powershell
.\gradlew.bat '-Pandroid.overridePathCheck=true' :app:assembleDebug :app:lintDebug
$adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
$pleosSerial = 'emulator-5554'  # adb devices에 나온 Pleos 시리얼로 변경
$carUser = (& $adb -s $pleosSerial shell am get-current-user).Trim()
& $adb -s $pleosSerial install -r --user $carUser .\app\build\outputs\apk\debug\app-debug.apk
& $adb -s $pleosSerial shell am start --user $carUser -n com.shift.vehicle/.MainActivity
```

같은 PC에서는 차량에 표시된 QR의 주소를 PC 브라우저에서 열 수 있습니다. 실제 휴대폰으로 시연하려면 USB 디버깅이 허용된 테스트용 Android 휴대폰을 PC에 연결하고 그 휴대폰에 포트를 전달한 뒤, 카메라로 차량 화면의 QR을 스캔합니다. [Android 포트 전달 안내](https://developer.android.com/develop/ui/views/layout/webapps/access-local-server)

```powershell
& $adb -s '<휴대폰 시리얼>' reverse tcp:8787 tcp:8787
```

Pleos Connect Emulator 2.1.0의 API 34, 2560 × 1440 px, 160 dpi 환경에서 검증했습니다. 실제 가로 앱 창은 **1682 × 1210 dp**였습니다. 휴대폰 크기로 설정한 Chrome에서 화면의 QR 주소를 열고 틀린 PIN 거부, 올바른 PIN 승인, 앱 자동 전환과 승인 재사용 차단을 확인했습니다. `npm --prefix server test`로 만료, 입력 제한, 동시 승인, 세션 교대를 재현할 수 있습니다.

[Pleos QR·PIN 대기 화면](docs/images/shift-qr-login-pleos.png) · [모바일 승인 페이지](docs/images/shift-qr-login-mobile.png) · [승인 후 오늘 방문 업무](docs/images/shift-qr-login-approved.png)

## Word 초안 갱신

[공식 접수양식](https://appdevchallenge.auto-hmg.io/downloads/contest-application-consent.docx)을 내려받고 Python과 `lxml`이 있는 환경에서 실행합니다.

```powershell
python tools/build_submission_docx.py '공식양식의 경로.docx'
```

`docs/SUBMISSION_DRAFT.md`의 1~7번 본문을 읽어 Word 초안을 다시 생성합니다. 참가자 정보와 서명은 팀이 작성합니다.
