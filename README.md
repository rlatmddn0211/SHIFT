# SHIFT

SHIFT는 공용차의 Pleos Connect에서 개인별 좌석 설정과 방문 업무를 불러오고, 내비게이션·메모를 휴대폰과 이어 쓰며, 교대 시 개인 세션을 정리하는 앱입니다.

## 공모전 제출 파일

- [Pleos 서명 릴리스 APK](apk/SHIFT_SHIFT_release.apk) · 차량용 앱 0.2.0
- [공개 웹 시연](https://shift-pleos-demo.pages.dev/) · 예시 데이터로 QR·PIN과 메모 흐름을 체험하는 클릭형 시연입니다. [웹 시연 소스와 실행 방법](prototype/README.md)
- [실제 Pleos 연동용 모바일 웹앱](webapp/) · 차량의 QR 승인과 방문 메모 저장에 사용합니다. [연동 서버](server/) · [Pleos 앱 소스](app/)

**배정받은 차량 탑승 → SHIFT 인증 → 내 방문 업무 확인 → 목적지 전달 → 방문 후 메모 → 개인 세션 종료**

차량에서 QR과 PIN으로 인증한 탑승자의 업무가 열립니다. QR로 로그아웃하거나 새 탑승자가 인증하면 기존 차량 세션을 종료합니다. 시제품은 팀이 구성한 가상 직원 A·B의 시험 데이터로 개인 환경 전환을 검증하며, 현대자동차 사내 공용차 이용 상황을 적용 예시로 삼습니다. A회사·B회사는 조직 확장 예시입니다. 회사 관리, 차량 등록과 권한 요청, 예약은 후속 개발 항목입니다.

## 실행·검증 문서

- [업무 계정과 모바일 설정](docs/SHIFT_WORKSPACE.md)
- [Pleos v1.2 기능별 실행 결과](docs/SHIFT_V12_DEMO.md)
- [모바일 웹앱과 Pleos 연동](docs/SHIFT_WEBAPP_PLEOS.md)

## 프로젝트 구성

| 경로 | 역할 |
| --- | --- |
| `apk/` | 설치할 차량용 release APK |
| `app/` | Pleos Android 앱 소스, 리소스와 사용한 폰트·아이콘 라이선스 |
| `server/` | QR 승인·차량 세션·업무·메모 연동 서버와 테스트 |
| `webapp/` | 실제 연동 서버를 사용하는 휴대폰 모바일 웹 |
| `gradle/`, `gradlew`, `gradlew.bat`, Gradle 설정 | Android 소스 빌드 |
| `docs/` | 실행 설정·검증 기록과 화면 캡처 |
| `prototype/` | 공개 클릭형 웹 시연 소스. 차량 APK와 별도로 실행 |

## 제출용 APK 실행

차량 APK는 개발 PC의 연동 서버에 접속합니다. 아래 서버를 먼저 실행한 뒤 Pleos에 APK를 설치합니다.

Pleos Connect Emulator를 실행하고 변속 상태를 **P(주차)**로 설정합니다. 앱의 **공용차 로그인**에서 QR의 주소를 개발 PC 브라우저로 열고, 시연 계정 **직원 A**와 차량에 표시된 6자리 PIN을 입력합니다. 승인이 완료되면 **오늘 방문 업무**가 열립니다. 브라우저의 **내 방문 메모**에서 메모를 작성하고 저장한 뒤, Pleos의 **방문 메모**에서 제목과 본문을 확인할 수 있습니다. PIN은 2분 동안 유효하며 5회 틀리면 잠깁니다.

시연 계정 A/B에는 서로 다른 예시 일정이 있고 Microsoft 365 연결 없이 사용할 수 있습니다. 로컬 서버는 차량 세션을 메모리에, 설정과 메모를 로컬 파일에 저장합니다. 내비 경로 요청은 `SHIFT_ENABLE_NAV_TEST=1`을 설정한 서버에서 직원 A의 **42dot · 내비 시험**으로 확인할 수 있습니다. [Microsoft 365와 외부 AI 설정](docs/SHIFT_WORKSPACE.md)

음성 브리핑, 시트 프리셋, 차량 음성 메모, QR 로그아웃과 운전자 교대도 주차 상태에서 사용할 수 있습니다. 다른 직원이 승인하면 이전 차량 세션이 만료됩니다.

### 1. 연동 서버 시작

Node.js 24.12 이상에서 아래 명령을 저장소 루트에서 실행합니다. 호스트 서버는 `http://127.0.0.1:8787`에서 실행되고, 제공하는 APK는 에뮬레이터의 주소 `http://10.0.2.2:8787`로 같은 서버에 접속합니다. [Android 에뮬레이터 네트워크 안내](https://developer.android.com/studio/run/emulator-networking-address)

```powershell
npm --prefix webapp ci
npm --prefix webapp run build
npm --prefix server start
```

### 2. APK 설치

Android SDK의 Platform-Tools와 Pleos Connect Emulator 2.1.0이 필요합니다. `ANDROID_HOME`을 Android SDK 경로로 설정합니다. 아래는 PowerShell 예시입니다. [공식 에뮬레이터 가이드](https://document.pleos.ai/docs/connect/guide/getting-started/application-development/setup-connect-sdk-emulator)

```powershell
$adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
$pleosSerial = 'emulator-5554'  # adb devices에 나온 Pleos 시리얼로 변경
$carUser = (& $adb -s $pleosSerial shell am get-current-user).Trim()
& $adb -s $pleosSerial install -r --user $carUser .\apk\SHIFT_SHIFT_release.apk
& $adb -s $pleosSerial shell am start --user $carUser -n com.shift.vehicle/.MainActivity
```

다른 키로 서명한 SHIFT 디버그 앱이 이미 설치된 경우, 제출 APK는 별도의 Pleos AVD에 설치합니다.

같은 PC에서는 차량에 표시된 QR의 주소를 PC 브라우저에서 열 수 있습니다. 실제 휴대폰으로 시연하려면 USB 디버깅이 허용된 테스트용 Android 휴대폰을 PC에 연결하고 그 휴대폰에 포트를 전달한 뒤, 카메라로 차량 화면의 QR을 스캔합니다. [Android 포트 전달 안내](https://developer.android.com/develop/ui/views/layout/webapps/access-local-server)

```powershell
& $adb -s '<휴대폰 시리얼>' reverse tcp:8787 tcp:8787
```

### 테스트 환경과 소스 빌드

Pleos Connect Emulator **2.1.0**, Android **API 34**, 전체 화면 **2560 × 1440 px / 160 dpi**, 가로 앱 창 **1682 × 1210 dp**를 기준으로 개발했습니다. 휴대폰 화면은 Chrome 모바일 뷰포트 **390 × 844**에서 검증했습니다. `npm --prefix server test`로 인증 만료, 입력 제한, 동시 승인과 세션 교대를 재현할 수 있습니다.

소스에서 빌드할 때는 JDK 17 또는 21, Android SDK Platform 34와 Build Tools 35.0.0이 필요합니다. 다음 명령은 Windows 한글 경로에서 서명 전 릴리스 APK를 빌드합니다. 기본 에뮬레이터 연결 주소 외의 서버는 `-PshiftReleaseApiOrigin=https://…`로 지정합니다.

```powershell
.\gradlew.bat '-Pandroid.overridePathCheck=true' :app:assembleRelease :app:lintRelease
```

[Pleos QR·PIN 대기 화면](docs/images/shift-qr-login-pleos.png) · [모바일 승인 페이지](docs/images/shift-qr-login-mobile.png) · [승인 후 오늘 방문 업무](docs/images/shift-qr-login-approved.png)
