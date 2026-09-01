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

### 2026-09-01 (2)

dl-dev 재감사 — 1차 감사(`010dc67`) 이후 7개 커밋(`8f246e8`·`2a71d51`·`c43dec1`·`e8a59cb`·`61a784d`·`d705b6f`·`8053668`) 대상. 특히 다른 세션/머신에서 온 `61a784d`(하드코딩 제거 + `git-workflow.md` 2절 "조건부 이식" 4번째 범주 신설 + `memory-protocol.md` "CLAUDE.md 먼저 읽기" 신설)가 미감사 상태였다.

- **최대 발견**: `61a784d`가 `notion-workflow.md` 4절 전체에 "PM 기획 문서를 갖는 프로젝트에만 적용"(`:35`) 게이트를 달았는데, 4절·4-1~4-5절은 순수 ML/DL 경로가 그대로 의존하는 문서다 — `ml-project-workflow.md:62/76/78/80`(11절), `ml-doc-writer.md:13`, `planning-doc-qa.md:12`. 그런데 같은 커밋의 `git-workflow.md:51`은 `ml-doc-writer`·`planning-doc-qa`를 "순수 ML/DL 프로젝트에도 그대로 필요"하다고 조건부 제외에서 명시적으로 뺐다. 즉 두 에이전트를 남기면서 그들이 의존하는 절을 껐다.
- 조건부 이식 목록의 구조적 결함 2건: (1) 리드문은 "아래를 이식 대상에서 제외한다"인데 5개 불릿 중 3개(`notion-workflow.md`·`bug-log.md`·`planning-doc-qa`)가 "제외하지 않는다"는 반대 내용 — 목록을 훑는 에이전트가 오독하기 쉽다. (2) 제외 대상(`stats-dashboard-design-reference.md`)을 남는 파일이 참조: `planning-doc-qa.md:14`, `notebook-toolkit/SKILL.md:121`, `notion-workflow.md:46`. `bug-log.md:3`(서두 — 새 규칙상 이식 대상)도 제외 대상 `ab-test-app-workflow.md`를 인용.
- `memory-protocol.md:12`가 "각 에이전트 파일에 개별 명시하지 않고 여기 한 곳에 둔다"고 선언했는데 `dl-expert.md:11`·`full-stack-engineer.md:15`가 실제로 개별 명시 중 — 문자적 모순. `dl-expert.md:11`의 DL 고유 제약(PyTorch 임의 설치 금지)은 공용 문서에 없으므로 그 문단을 "중복"으로 지우면 안 된다는 걸 어디에도 안 적어둠.
- `dl-expert.md:12`가 `expert-contract.md`의 "54절"을 인용하나 그 문서엔 번호 절이 없다(총 54행, 명명 절 9개). `c43dec1`에서 유입.
- `dl-reference.md` 순환: 파일이 존재하지만 내용이 비어 있는데 `dl-expert.md:14`는 "파일이 없으면"으로만 분기하고, `dl-reference.md`의 ⚠️1은 다시 expert-contract "참고 문서가 없는 프로젝트라면"(=문서를 만들자고 제안하라)로 넘긴다.
- 1차 감사 이월분 재평가: `.vscode/settings.json`은 `.gitignore`에 `.vscode/`가 있는데도 **실제로는 git 추적 중**(`git ls-files` 확인)이라 동작에는 문제 없음 — 진짜 위험은 나중 세션이 "gitignore 불일치"를 고치겠다고 `git rm --cached` 하는 것. agent-memory와 똑같은 상황인데 CLAUDE.md에 그 예외가 안 적혀 있다. `docs/planning/` 부재 + `ml-project-workflow.md` 11·13절 게이트는 `61a784d`가 손대지 않아 그대로 남음. CLAUDE.md:4 "세 번째" vs CLAUDE.md:13 4홉 계보는 이제 같은 파일 안에서 모순.
- 참조 무결성 자체는 이상 없음 — `@`참조 6개 및 모든 `docs/harness/`·`.claude/` 경로 실재. 신규 파일 `dl-reference.md` 포함.

### 2026-09-01 (3)

dl-dev 3차 감사 — 2차 감사(`8053668`) 이후 `87305bc`(환경 정정 + 감사 수정)·`2c604d2`(잔여 감사 수정) 대상. 2차 findings 9건의 수정이 실제로 성립하는지 검증.

- **완전 해결 6건**: `.gitignore` `.vscode/*` + `!.vscode/settings.json` 부정 패턴 실동작 확인(`git check-ignore` 결과 settings.json만 비무시, `.vscode/`에 다른 파일 없음) / `dl-expert.md:12`의 "54절" → "사용자 제공 참고 문서 활용" 절(실재) / 빈 참고문서 분기 추가 / 조건부 이식 목록 【제외】·【유지】 태그(내용과 일치) + 잔존 참조 grep 단계 신설 / `CLAUDE.md:4` 학습 시리즈 vs 포크 계보 구분 / conda 환경 실측 대조 전부 일치(Python 3.11.16, torch 2.5.1/CUDA 11.8/GTX 1660 SUPER, numpy 2.0.1, pandas 3.0.5, sklearn 1.9.0, 커널 `dl-dev` 등록, `.venv` 삭제됨).
- **최대 미해결**: `notion-workflow.md` 4절 게이트는 쪼갰는데 그 게이트를 **복제해 갖고 있던** `git-workflow.md:49`를 같은 커밋에서 안 고쳤다 — 여전히 "4절(표준 문서 규격)만 PM 전용(그 절 자신에 표시돼 있다)"이라 적혀 있어, 다음 포크에서 4-1~4-5까지 통째로 끄는 원래 버그가 그대로 재현된다. **교훈: 게이트 문구가 두 문서에 복제돼 있으면 한쪽만 고치는 수정은 무효다 — 고치기 전에 그 문장을 인용하는 다른 문서를 먼저 grep한다.**
- 부분 해결: 하드코딩 일반화가 `report-writer-contract.md`는 128행 한 줄만 손봐 `ML/assets/cleaned_*`·`docs/reference/reports/`·`docs/gemini/` 참조 6곳(30·34·79·84·85·227행)이 무조건문으로 남음 — 이 저장소에 실재하지 않는 경로다.
- `memory-protocol.md:12`("각 에이전트 파일에 개별 명시하지 않는다")는 그대로인데 예외 표시는 `dl-expert.md:11`에만 달렸다 — 선언 문서 쪽을 안 고쳐 `full-stack-engineer.md:15`는 여전히 무표시 위반이고, 그 줄에만 있는 "값을 복제하지 말고 매번 CLAUDE.md에서 읽어라" 지시가 중복 정리 때 삭제될 위험이 남는다.
- 환경 정정의 교훈이 이식 가능한 하네스로 전파되지 않음: "PATH에 없다 = 설치 안 됨이 아니다" 규칙이 `CLAUDE.md`·`dl-reference.md`(둘 다 프로젝트 전용)에만 있고 `ml-project-workflow.md` 0절에는 없다. 같은 0절 9행은 아직 "DL에는 venv를 관례로" — 이 저장소 사실과 반대. `HARNESS_LOG.md:20`도 "개발 환경(venv/…)"으로 낡음.
