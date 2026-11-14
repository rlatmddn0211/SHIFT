# SHIFT

SHIFT는 공용차를 배정받은 직원이 현대차의 Pleos Connect 차량 화면에서 방문 업무를 확인하고, 목적지를 내비게이션에 보내고, 방문 후 메모를 남기는 차량용 앱입니다.

**배정받은 차량 탑승 → SHIFT 인증 → 내 방문 업무 확인 → 목적지 전달 → 방문 후 메모 → 개인 세션 종료**

차량에서 QR과 PIN으로 인증한 탑승자의 업무가 열립니다. QR로 로그아웃하거나 새 탑승자가 인증하면 기존 차량 세션을 종료합니다. 첫 시제품은 현대 시나리오에 집중하고, A회사·B회사는 조직 확장 예시로 제시합니다. 회사 관리, 차량 등록과 권한 요청, 예약은 후속 개발 항목입니다.

## 기획 문서

- [전체 기획안 v1.1](docs/PLAN.md)
- [결정 기록](docs/DECISIONS.md)
- [공모전 작품 소개 초안](docs/SUBMISSION_DRAFT.md)
- [공식 접수양식에 본문을 넣은 Word 초안](docs/SHIFT_application_draft.docx)
- [Pleos 차량 화면 디자인·개발 가이드](docs/PLEOS_SCREEN_DESIGN.md)

Word 초안에는 작품 소개 본문이 들어 있습니다. 참가자 정보, 팀명, 전원 동의·서명과 최종 참고자료 링크는 제출 전에 작성합니다.

## Pleos에서 화면 실행

`app/`에는 Figma 시안을 구현한 Android 차량용 **오늘 방문 업무** 화면이 있습니다. 일정은 예시 데이터입니다. **내비로 보내기**를 누르면 주소와 시연 안내가 표시됩니다. 실제 목적지 전송과 업무 계정 연동은 아직 구현하지 않았습니다.

JDK 17 또는 21, Android SDK Platform 34, Build Tools 35.0.0, Platform-Tools를 준비합니다. `ANDROID_HOME`을 Android SDK 경로로 설정한 뒤 Pleos Connect Emulator를 실행합니다. [공식 에뮬레이터 가이드](https://document.pleos.ai/docs/connect/guide/getting-started/application-development/setup-connect-sdk-emulator)

저장소 루트에서 실행합니다. 아래 Gradle 옵션은 현재 작업 폴더처럼 Windows 경로에 한글이 있는 경우에 사용합니다.

```powershell
.\gradlew.bat '-Pandroid.overridePathCheck=true' :app:assembleDebug :app:lintDebug
$adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
$pleosSerial = 'emulator-5554'  # adb devices에 나온 Pleos 시리얼로 변경
$carUser = (& $adb -s $pleosSerial shell am get-current-user).Trim()
& $adb -s $pleosSerial install -r --user $carUser .\app\build\outputs\apk\debug\app-debug.apk
& $adb -s $pleosSerial shell am start --user $carUser -n com.shift.vehicle/.MainActivity
```

Pleos Connect Emulator 2.1.0에서 API 34, 전체 디스플레이 2560 × 1440 px, 160 dpi로 검증했습니다. 가로 앱 창은 실제 **1682 × 1210 dp**였습니다. 같은 에뮬레이터에서 앱 창을 **847 × 839 dp**로 줄여 한 열 배치와 스크롤을 확인했습니다. Asta Sans와 Noto Sans KR은 이 화면에 필요한 글리프를 포함하며, 라이선스는 `app/src/main/assets/fonts/`에 있습니다.

## Word 초안 갱신

[공식 접수양식](https://appdevchallenge.auto-hmg.io/downloads/contest-application-consent.docx)을 내려받고 Python과 `lxml`이 있는 환경에서 실행합니다.

```powershell
python tools/build_submission_docx.py '공식양식의 경로.docx'
```

`docs/SUBMISSION_DRAFT.md`의 1~7번 본문을 읽어 Word 초안을 다시 생성합니다. 참가자 정보와 서명은 팀이 작성합니다.
