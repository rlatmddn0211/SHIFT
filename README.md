# SHIFT

공유차량을 나의 업무 공간으로.

SHIFT는 회사 공용차를 교대 이용하는 직원이 휴대폰 인증으로 자신의 업무·노트·음악 환경을 차량에서 이어 쓰고, 반납할 때 차량 앱의 개인 세션을 정리하는 차량용 서비스입니다.

## 기획 문서

- [전체 기획안 v1.0](docs/PLAN.md)
- [공모전 작품 소개 초안](docs/SUBMISSION_DRAFT.md)
- [공식 접수양식에 본문을 넣은 Word 초안](docs/SHIFT_application_draft.docx)
- [확정 사항과 질문 목록](docs/DECISIONS.md)

현재는 기획 단계입니다. 기능의 구현 완료 여부와 외부 서비스의 실제 지원 여부는 구분해서 기록합니다.

Word 초안에는 작품 소개 본문을 채웠습니다. 참가자 정보, 팀명, 전원 동의·서명과 최종 참고자료 링크는 제출 전에 작성해야 합니다. 원본 동의서의 문구와 서명란은 유지했습니다.

## Word 초안 갱신

[공식 접수양식](https://appdevchallenge.auto-hmg.io/downloads/contest-application-consent.docx)을 내려받은 뒤 Python과 `lxml`이 있는 환경에서 실행합니다.

```powershell
python tools/build_submission_docx.py '공식양식의 경로.docx'
```

`docs/SUBMISSION_DRAFT.md`의 1~7번 본문을 읽어 Word 초안을 다시 생성합니다. 앱명은 SHIFT로 입력하고 참가자 정보와 서명은 자동 입력하지 않습니다.

## 작업 위치

이 저장소의 코드와 문서는 `daker/SHIFT`에서 관리합니다. 상위 `daker` 저장소와는 별도의 Git 저장소입니다.
