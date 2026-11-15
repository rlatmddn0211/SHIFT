# SHIFT 프로젝트 소개와 클릭형 시연

SHIFT는 공용차로 외근하는 직원이 오늘 방문 일정과 변경 주소를 확인하고, 목적지를 Pleos 내비로 보내고, 휴대폰에서 저장한 방문 메모를 차량에서 이어서 확인하는 앱입니다. 교대 시 차량의 개인 세션을 종료합니다.

[SHIFT 공개 시연](https://shift-pleos-demo.pages.dev/) · [Pleos 에뮬레이터와 실제 서버에서 확인한 연동 결과](https://github.com/rlatmddn0211/SHIFT/blob/33c7065f89cd497b993d2718f1695d8bdb043eab/docs/SHIFT_WEBAPP_PLEOS.md)

## 로컬에서 열기

Node.js 24에서 저장소 루트 기준으로 실행합니다. 브라우저에서 [localhost:5173](http://127.0.0.1:5173/)을 엽니다.

```powershell
npm --prefix prototype ci
npm --prefix prototype run dev
```

## 대표 시연

1. **QR·PIN 시연 시작**을 누릅니다. 차량 QR을 클릭하고 차량의 6자리 PIN을 휴대폰 화면에 입력해 **로그인 승인**합니다.
2. 차량에서 **오늘 방문 업무**가 열리면 휴대폰의 **내 방문 메모 → 메모 작성**에서 내용을 입력합니다. 방문 연결은 선택 사항입니다.
3. **메모 저장**을 누르고, 정차 상태에서 Pleos의 **방문 메모**를 열어 같은 제목과 본문을 확인합니다.
4. 차량 세션 종료를 휴대폰에서 승인합니다. 직원 B로 전환하면 B의 업무와 메모를 확인할 수 있습니다.

**전체 화면**에서 좌석, 목적지 전달, 차량 음성 메모와 오류 상태를 둘러볼 수 있습니다. **발표 모드**는 사이드바를 접습니다. **다시 시작** 또는 새로고침하면 시연 데이터가 초기화됩니다.

공개 시연은 예시 계정과 일정을 사용합니다. 차량·휴대폰 화면은 한 브라우저 탭에서 같은 상태를 공유합니다. QR을 실물 휴대폰으로 스캔하면 해당 기기에 별도의 시연이 열립니다.

이전 시안의 화면별 이미지와 로고는 [디자인 자료](https://github.com/rlatmddn0211/SHIFT/blob/e1ab3394eb686078087ce50a11bb01c709487072/docs/design/prototype-v2/README.md)에 있습니다. 단독 화면은 `?view=vehicle&screen=V3` 또는 `?view=phone&screen=P6`으로 엽니다.

## 공개 배포 갱신

```powershell
npm --prefix prototype ci
npm --prefix prototype run build
```

Cloudflare 대시보드의 **Workers 및 Pages → shift-pleos-demo → 새 배포 만들기**에서 프로덕션 환경을 선택해 `prototype/dist`의 정적 빌드를 업로드합니다. ZIP을 쓸 때는 `index.html`과 `assets/`가 압축 파일 최상위에 있도록 압축합니다. [Cloudflare Pages Direct Upload 안내](https://developers.cloudflare.com/pages/get-started/direct-upload/)

Vite 산출물의 상대 주소는 GitHub Pages의 저장소 경로에서도 동작합니다. 이 저장소에서 GitHub Pages를 선택하려면 비공개 저장소를 지원하는 플랜과 게시 설정 권한이 필요합니다. [GitHub Pages 게시 설정](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## 검증

```powershell
npm --prefix prototype exec -- playwright install chromium --only-shell
npm --prefix prototype run test:e2e
```

Playwright는 소개 페이지에서 시작하는 QR·PIN과 웹 메모 작성, Pleos 상세, 운전자 간 분리, 정차 제한을 비롯해 좌석, 목적지 전달과 기존 음성 메모 흐름을 확인합니다.
