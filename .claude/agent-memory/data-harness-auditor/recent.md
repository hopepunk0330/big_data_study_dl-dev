# 에이전트 메모리 — 최근 상세 기록 (최대 5개 롤링)

의미 있는 순간 후 아래에 `### YYYY-MM-DD` 헤더로 새 항목을 추가한다. 6개가 되면 가장 오래된 항목을 index.md로 정리하고 여기서 삭제한다.

### 2026-09-01

dl-dev(딥러닝 교재 chap01~10 학습 저장소)로 이식된 하네스의 첫 정합성 감사. 이식 커밋 `4b80f1f`, 적응 커밋 `53854d3`(CLAUDE.md 재작성 + HARNESS_LOG 포크 항목 + .gitignore 확장)·`010dc67`(사용자 결정 3건 기록) 대상.

- 참조 무결성 자체는 이상 없음 — `.claude/agents/`·`docs/harness/`·`CLAUDE.md`가 가리키는 문서 경로 전부 실재하고, CLAUDE.md의 `@`참조 10개 모두 해석됨. 에이전트 15종 / harness 문서 19종 / agent-memory 빈 템플릿 15종 모두 HARNESS_LOG 기재와 일치.
- 가장 위험한 발견: `dl-expert`가 프로젝트 `CLAUDE.md`를 참조 목록에 넣지 않음. "PyTorch는 수업에서 직접 설치, Claude가 임의 설치 금지"·시드 고정·GTX 1660 SUPER VRAM 6GB 제약이 전부 CLAUDE.md에만 있는데, dl-expert는 `Bash`를 갖고 `ml-project-workflow.md` 0절(conda 기반 환경 세팅·패키지 설치 체크리스트)을 그대로 따르라고 지시받음.
- 이전 프로젝트(Mercari) 하드코딩이 여러 곳에 남음: `stats-advisor.md:8`(이 프로젝트 = ML 파이프라인 + A/B테스트라고 단정)·`:13`·`:27`·`:46`, `pandas-expert.md:3`·`:18~24`(`analysis/`·`ML/`), `qa-reviewer.md:22`(RMSLE), `notebook-toolkit/SKILL.md:86`·`:88`(`ML/scripts/`·`ML/results/`), `full-stack-engineer.md:15`(CLAUDE.md 재작성으로 없어진 Vitest·`app/` 검증 명령을 인용).
- 의도된 결정이 불완전하게 기록된 사례 3건: (1) CLAUDE.md:13이 report-tools 검증 스크립트를 "그대로 쓴다"고 적었으나 `git-workflow.md` 6절은 같은 스크립트를 "재사용 불가·포크 시 제외"로 규정 — 정면 충돌. (2) HARNESS_LOG:18의 "정책대로"가 agent-memory git 추적 유지(memory-protocol.md:33 위반)를 누락. (3) CLAUDE.md:9의 "notion-workflow.md는 적용 대상 없음"이 `notion-workflow.md` 8절의 전 프로젝트 공용 고정 페이지(JY-Data)까지 배제하는 것처럼 읽힘.
- 하네스가 `main`에 그대로 커밋됨(브랜치는 `main` 하나뿐) — `git-workflow.md` 2절이 "처음부터 적용" 대상이라 규정한 harness 브랜치 분리 미적용. 어디에도 의도적 이탈로 기록돼 있지 않아, 나중 세션이 8절의 `git filter-repo --refs main --force` 복구 절차를 제안할 위험이 있음.
- 교훈(재발 방지): `CLAUDE.md`를 포크 시 재작성할 때, 다른 하네스 파일이 CLAUDE.md의 특정 문장·항목을 인용하고 있는지 역방향으로 먼저 grep해야 한다 — 이번에 `full-stack-engineer.md:15`와 `git-workflow.md` 1-1절이 그 방식으로 깨졌다.
