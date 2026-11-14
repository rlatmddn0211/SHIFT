
# SHIFT v1.2 실행 결과

Figma의 **03 · SHIFT v1.2 시연**을 클릭해서 A 로그인, 방문 업무, 브리핑, 시트, 장소 확인, 메모, 로그아웃 및 B 로그인, 주행 제한을 확인한 뒤 Android와 모바일 웹에 적용했다. 레이어, 버튼 컴포넌트, 색상 변수와 화면 연결은 Figma에서 편집할 수 있다. [편집 파일 및 시연](SHIFT_V12_FIGMA.md)

## 시험 환경

Pleos Connect Emulator 2.1.0, Android API 34, 2560 × 1440 px, 160 dpi, 가로 앱 영역 1682 × 1210 dp, 차량 사용자 10에서 확인했다. Android 디버그 빌드와 lint, Node 서버 테스트 14개가 통과했다. 차량 데이터를 변경한 것은 에뮬레이터의 시연 데이터다.

| 기능 | 실행 결과 | 캡처 |
| --- | --- | --- |
| QR·PIN 로그인, 로그아웃과 교대 | 휴대폰 승인 주소에 차량 PIN을 입력해 직원 A 일정을 열었다. 같은 브라우저에서 로그아웃을 승인하면 새 공용 QR이 열렸다. 이후 B 승인으로 B의 일정만 표시됐다. A 활성 세션을 B 승인으로 교체하는 경우, 만료·재사용·경합은 서버 테스트로 확인했다. | [공용 대기](images/shift-v12-emulator-public.png) · [직원 A](images/shift-v12-emulator-a.png) · [직원 B](images/shift-v12-emulator-b.png) |
| 모바일 설정·업무 계정 | 휴대폰 크기의 Chrome에서 개인별 좌석 설정과 메모 저장, A/B 분리, 서버 재시작 이후 복원을 확인했다. Entra OAuth 및 Outlook·OneNote 응답은 모의 서버로 검증했다. | [업무 설정](images/shift-v12-mobile-profile.png) · [권한 선택](images/shift-v12-mobile-consent.png) · [모바일 메모](images/shift-v12-mobile-note.png) |
| 업무 브리핑 | 시연 방문과 선택한 메일 텍스트를 요약하고 Pleos 온디바이스 한국어 음성 합성의 완료 응답을 확인했다. 외부 AI 제공자는 동의, HTTPS 인증, 선택한 입력, 실패 시 원문 요약을 모의 응답으로 확인했다. | [브리핑](images/shift-v12-emulator-briefing.png) · [음성 재생 완료](images/shift-v12-emulator-tts.png) |
| 변경 장소·Pleos 내비 | 기본 시연의 변경 주소와 근거를 표시했다. 공식 42dot 시험 POI를 보내 기본 내비의 안내를 열고, 같은 세션으로 돌아와 실제 안내 중인 목적지의 POI를 확인했다. 내비에는 좌표와 Pleos POI ID가 확인된 장소를 전송한다. | [변경 근거](images/shift-v12-emulator-location.png) · [기본 내비 안내](images/shift-v12-emulator-navigation.png) · [SHIFT 목적지 확인](images/shift-v12-emulator-navigation-confirmed.png) |
| 주차 전용 기능 | Virtual Console에서 Park → Drive → Park를 전환했다. Drive에서 시트, 목적지 요청, 메모와 로그아웃 동작이 숨겨졌다. Park 복귀 후 업무 동작을 다시 열 수 있었다. | [주행 제한 화면](images/shift-v12-emulator-driving.png) |
| 시트 프리셋 | 모바일 값과 SDK의 운전석 높이·앞뒤 현재 위치를 함께 확인했다. SDK 이동과 정지 요청에 응답이 왔고 첫 조작에서 위치가 변하지 않아 중단했다. 앱에서 확인된 최종 위치가 있어야 적용 완료를 표시한다. | [프리셋 확인](images/shift-v12-emulator-seat.png) · [중단 결과](images/shift-v12-emulator-seat-result.png) |
| 음성 메모 | 합성 한국어를 공식 PCM 입력으로 Pleos 온디바이스 STT에 보내 인식 결과를 받았다. 앱에서 결과를 확인하고 로컬 시연 메모로 저장했다. 차량 마이크 입력과 실제 OneNote 저장은 별도 시험이 필요하다. | [인식 검토](images/shift-v12-emulator-voice-review.png) · [차량 저장 완료](images/shift-v12-emulator-voice-saved.png) · [휴대폰에서 확인](images/shift-v12-mobile-note.png) |
| 휴대폰 음악 | Pleos의 오디오 소스 설정과 휴대폰 공식 음악 앱의 재생 안내를 제공한다. 휴대폰 페어링과 차량 오디오 재생은 실기기 시험이 필요하다. | [휴대폰 음악 안내](images/shift-v12-emulator-music.png) |

## 다시 실행

- 기본 명령은 [README 실행 절차](../README.md#pleos에서-화면-실행)를 따른다. 내비 시연은 서버 환경에 `SHIFT_ENABLE_NAV_TEST=1`을 설정해 A의 **42dot · 내비 시험**을 연다.
- 주행 상태는 **Pleos Virtual Console → Motion → Gear Selection**에서 확인하고 시트 위치는 SHIFT 시트 화면에서 읽는다. 기어와 `CarUxRestrictions`가 모두 주차로 확인될 때만 차량 제어를 연다. [Pleos Virtual Console](https://document.pleos.ai/en/docs/pleos-only/app-test-guide/virtual-console-guide)
- 개발 빌드에서 STT 엔진을 따로 시험하려면 `app/src/debug/assets/shift-stt-fixture.pcm`에 16 kHz, 16-bit, mono PCM 시험 음성을 두고 `assembleDebug`를 실행한다. **음성 메모 → 시험 음성 인식**이 나타난다. [Pleos PCM 입력](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/SpeechToText/sending-audio-data)
- 업무 계정과 AI 제공자의 실제 요청은 [업무·개인 설정 문서](SHIFT_WORKSPACE.md)의 시험 테넌트, 앱 등록, HTTPS 제공자 설정을 사용한다. 시제품은 로컬 파일과 메모리 세션을 사용하며 기획안의 AWS 및 PostgreSQL 배포는 구성하지 않았다.
