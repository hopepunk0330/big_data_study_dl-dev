# 하네스 포크 기록

새 프로젝트로 하네스(`.claude/`, `docs/harness/`)를 포크해갈 때만 한 줄 추가한다. 세세한 변경 이력은 각 프로젝트의 git 커밋 기록에 이미 있으므로 여기서는 반복하지 않는다 — 정확한 최신 판단 기준은 `git-workflow.md` 6절의 git 커밋 날짜다.

**이 파일은 포크할 때 새로 시작하지 않는다.** 이전 프로젝트의 기록 전체를 그대로 들고 가서 이어서 한 줄만 추가한다 — 어느 사본에서 열어봐도 전체 포크 계보가 한눈에 보이게 하기 위함이다.

## 2026-07-30 — pandas_dev (최초 구축)
- 도메인별 튜터 에이전트, qa-reviewer, data-harness-auditor, notebook-toolkit 스킬로 하네스 최초 구축.

## 2026-08-19 — pandas_dev → ml-dev
- 이 시점 하네스 상태: git-workflow.md(저장소 분리·이식 범위·다중 포크 최신 버전 추적)·memory-protocol.md(포크 시 agent-memory 제외 규칙 포함)·asset-gallery/(README 포함, 30문제 SVG 34개)까지 반영된 상태. `.claude/agent-memory/`는 정책대로 이식하지 않음.

## 2026-08-20 — ml-dev → portfolio/bigdata/01)ML_mercari price
- 이 시점 하네스 상태: `ml-tutor.md` + `ml-reference.md`(Notion 수업 필기 재구성, "⚠️ 확인 필요"·"💡 최신 기법" 표기) 신설로 머신러닝 도메인 지원 시작. `ml-project-workflow.md`(3-way 분할·데이터 누수 방지·공정한 하이퍼파라미터 비교·모델+전처리기 저장 등 ML 프로젝트 운영 원칙) 신설. `notion-workflow.md`(프로젝트 관리용 Notion 페이지 작성 규칙 — 기존 내용 절대 수정 금지, 하위 페이지·데이터베이스 활용, 시각화) 신설. `git-workflow.md`에 0절(다른 로컬 프로젝트 건드리지 않기 — 이후 CLAUDE.md로 재배치)·7절(하네스 고치면 곧바로 자체 감사) 추가. `notebook-toolkit` 스킬 E절에 ML 도메인 예외(표준 진단 플롯은 matplotlib 허용, 서사형 카드는 SVG+인사이트 강조 유지) 확정. `pandas-tutor.md`/`ml-tutor.md`의 "진단→정제 또는 전처리/규칙→대조" 워크플로우 용어를 각 도메인에 맞게 통일. 존댓말 등 소통 방식은 전역 `~/.claude/CLAUDE.md`로 별도 관리(하네스 이식 대상 아님).

## 2026-09-01 — portfolio/bigdata/01)ML_mercari price → dl-dev
- 이 시점 하네스 상태: 에이전트 15종(도메인 전문가 `dl-expert`·`ml-expert`·`pandas-expert`·`sql-expert`·`stats-advisor`, 감사 `qa-reviewer`·`data-harness-auditor`·`dev-qa`·`design-qa`·`report-qa`·`planning-doc-qa`, 실행 `full-stack-engineer`·`ui-ux-designer`·`report-writer`·`ml-doc-writer`). 문서는 A/B 테스트 워크스트림 산물이 대폭 추가된 상태 — `ab-test-app-workflow.md`(참여자 앱 스택 분리·아티팩트 프로토타입·Figma 쓰기 금지 규칙), `bug-log.md`(증상 기준 진단 로그), 계약 문서 5종(`expert`·`reviewer`·`report-writer`·`ml-doc-writer`·`planning-doc-qa`), 레퍼런스 3종(`design-methodology`·`estimation-method`·`bigdata-analytics-cert`), `stats-dashboard-design-reference.md`, Playwright 도구 폴더 `report-tools/`, `asset-gallery/`(SVG 43개, 번호 01~39 — 같은 번호로 여러 장인 경우가 있어 파일 수와 최대 번호가 다르다. 31~39는 결과보고서 브로셔급 카드).
- `.claude/agent-memory/`는 내용 없이 빈 템플릿(15종)만 이식됨 — 여기까지는 정책대로다. **다만 같은 정책(`memory-protocol.md`)이 요구하는 `.gitignore` 제외는 이 프로젝트에서 의도적으로 적용하지 않았다** — 하네스 전체를 `main`에서 추적하기로 한 결정에 따른 것으로, 상세와 전환 조건은 이 프로젝트 `CLAUDE.md`의 "하네스를 `main`에서 관리한다" 절에 있다.
- `git-workflow.md` 6절이 규정하는 "이전 프로젝트 DOM에 강결합된 `report-tools/` 검증 스크립트 포크 시 제외" 단계도 의도적으로 건너뛰었다 — 사용자 판단으로 이식 자산을 삭제하지 않고 전부 보존했다(기법 참고용). 실행 가능 여부 구분은 `CLAUDE.md`에 명시.
- dl-dev는 딥러닝 교재(chap01~10) 학습 저장소 — `CLAUDE.md`는 2절 절차대로 개요·폴더 구조·개발 환경(venv/Python 3.11/PyTorch)·검증 명령·금지 항목을 이 프로젝트에 맞게 수정했고, 행동 지침은 이식된 규칙을 그대로 유지했다(현재 워크스트림에서 안 쓰는 규칙도 삭제하지 않음).
