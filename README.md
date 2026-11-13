# SHIFT

공유차량을 나의 업무 공간으로.

SHIFT는 배정받은 공용차에서 직원이 자신의 방문 업무와 개인 서비스를 이어 쓰고, 이용이 끝나면 개인 업무 세션을 정리하는 차량용 서비스입니다.

**차량 탑승 → SHIFT 인증 → 방문 업무 확인 → 목적지 전달 → 방문 후 메모 → 개인 세션 종료**를 핵심 흐름으로 확정했습니다. 사내 차량 관리 기능은 확장으로 남깁니다.

## 기획 문서

- [전체 기획안 v1.1](docs/PLAN.md)
- [디자인·협업·시연·검증 계획](docs/DELIVERY_PLAN.md)
- [공모전 작품 소개 초안](docs/SUBMISSION_DRAFT.md)
- [공식 접수양식에 본문을 넣은 Word 초안](docs/SHIFT_application_draft.docx)
- [확정 사항과 질문 목록](docs/DECISIONS.md)

현재는 기획 단계입니다. 기능의 구현 완료 여부와 외부 서비스의 실제 지원 여부는 구분해서 기록합니다.

기술 기본 구성은 차량 Kotlin·Jetpack Compose, 웹·API TypeScript·Next.js, DB PostgreSQL입니다. 기능별 브랜치와 PR로 변경을 공유하고 상대방 확인 후 main에 병합합니다.

Word 초안에는 작품 소개 본문을 채웠습니다. 참가자 정보, 팀명, 전원 동의·서명과 최종 참고자료 링크는 제출 전에 작성해야 합니다. 원본 동의서의 문구와 서명란은 유지했습니다.

## Word 초안 갱신

[공식 접수양식](https://appdevchallenge.auto-hmg.io/downloads/contest-application-consent.docx)을 내려받은 뒤 Python과 `lxml`이 있는 환경에서 실행합니다.

```powershell
python tools/build_submission_docx.py '공식양식의 경로.docx'
```

`docs/SUBMISSION_DRAFT.md`의 1~7번 본문을 읽어 Word 초안을 다시 생성합니다. 앱명은 SHIFT로 입력하고 참가자 정보와 서명은 자동 입력하지 않습니다.

## 작업 위치

이 저장소의 코드와 문서는 `daker/SHIFT`에서 관리합니다. 상위 `daker` 저장소와는 별도의 Git 저장소입니다.
