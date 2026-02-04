# Steam Tag Mixer

Steam 게임 태그를 무작위로 조합하여 **매일 자동으로 웹 게임 프로토타입을 생성**하는 파이프라인입니다.

n8n Cloud + 로컬 Webhook 서버 + Claude Code로 구성된 자동화 워크플로우를 통해, 매일 아침 독창적인 게임 프로토타입이 만들어집니다.

---

## 1. 개요

### 파이프라인 흐름

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    ┌────────────┐
│ n8n Cloud    │───▶│ Steam 태그    │───▶│ Claude Code     │───▶│ 게임 출력   │
│ (매일 9시)   │    │ 랜덤 2~5개   │    │ 디자인 → 구현   │    │ outputs/   │
└─────────────┘    └──────────────┘    └─────────────────┘    └────────────┘
```

### 주요 특징

1. **일일 자동 생성**: n8n Cron 트리거로 매일 아침 9시에 실행
2. **랜덤 태그 조합**: Steam 태그 170+개 중 2~5개를 무작위 선택
3. **6단계 AI 파이프라인**: 기획 → 가이드 → 리뷰 → 사양 → 리뷰 → 구현
4. **반복 검증 (ralph-wiggum)**: 구현 후 빌드·사양 준수를 자동 검증, 실패 시 최대 10회 이터레이션
5. **Vite + TypeScript**: 생성된 게임은 즉시 `npm run dev`로 플레이 가능
6. **자동 GitHub 레포 생성**: 완성된 게임마다 별도 Public 레포지토리 자동 생성
7. **자동화된 QA**: 코드 리뷰, 이슈 발견, 버그 수정 프로세스 내장

---

## 2. 빠른 시작

### 설치

```bash
npm install
```

### .env 설정

```bash
cp .env.example .env
# .env 파일에서 WEBHOOK_SECRET과 ANTHROPIC_API_KEY 설정
```

### 로컬 Webhook 서버 실행

```bash
npm start          # 프로덕션
npm run dev        # 개발 (watch 모드)
```

### 수동 파이프라인 실행 (테스트)

```bash
# 자체 태그 선택으로 파이프라인 직접 실행
npm run pipeline

# 태그 선택만 테스트
npm run select-tags
```

### n8n Cloud 연동

1. [n8n/steam-tag-mixer-workflow.json](n8n/steam-tag-mixer-workflow.json)을 n8n Cloud에 import
2. 환경 변수 설정:
   - `WEBHOOK_URL`: 로컬 서버 주소 (예: `http://your-ip:3847`)
   - `WEBHOOK_SECRET`: `.env`와 동일한 값
3. 워크플로우 활성화

### API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/webhook/run` | 파이프라인 실행 (태그 전달 가능) |
| GET | `/status` | 현재 상태 조회 |
| GET | `/health` | 헬스 체크 |

**POST /webhook/run** 요청 예시:
```json
{
  "tags": ["Roguelike", "Cooking", "Pixel Graphics"],
  "createRepo": true
}
```
- `tags`: 생략하면 서버에서 자동으로 랜덤 선택
- `createRepo`: GitHub 레포 자동 생성 여부 (기본 `true`). `false`로 설정 시 로컬 `outputs/`에만 저장

---

## 3. 주요 기능

### 3.1 QA 빌드 점검

코드 리뷰부터 버그 수정까지 자동화된 품질 관리 프로세스입니다.

**프로세스 개요:**
```
1. 빌드 테스트 → 2. 코드 리뷰 → 3. 이슈 수정 → 4. 결과 보고
```

**상세 가이드:** [.claude/QA_Guide.md](.claude/QA_Guide.md)

#### 이슈 수정 방식 (하이브리드)

```
1차 시도: 서브 에이전트 병렬 처리 (빠른 수정)
    ├─ issue-fixer #1
    ├─ issue-fixer #2
    └─ issue-fixer #3
         ↓
    실패한 이슈 수집
         ↓
2차 시도: Ralph Loop 순차 재시도 (깊이 있는 수정)
```

- **1차 시도**: 모든 이슈를 서브 에이전트로 병렬 처리
- **2차 시도**: 실패한 이슈만 Ralph Loop로 반복 수정

### 3.2 Ralph Loop

반복적 개선을 통해 복잡한 작업을 완료하는 자동화 루프입니다.

**사용 예시:**
```
/ralph-loop "버그 수정: 토큰 갱신 로직 오류

단계:
1. 버그 재현
2. 근본 원인 파악
3. 수정 구현
4. 회귀 테스트 작성
5. 수정 동작 확인
6. 새로운 문제 발생 여부 확인

완료되면 <promise>FIXED</promise>를 출력하세요." --max-iterations 10 --completion-promise "FIXED"
```

**상세 가이드:** [.claude/rules/ralph-loop.md](.claude/rules/ralph-loop.md)

### 3.3 Claude-Gemini 협업 워크플로우

기획(Gemini)과 구현(Claude)을 분리하여 품질 높은 코드 작성을 목표로 합니다.

**워크플로우:**
```
Gemini (Planner/Architect)     Claude (Developer/Actualizer)
        │                              │
        ├─ 요구사항 분석 ──────────────→│
        ├─ 아키텍처 설계 ──────────────→│
        │                              ├─ 코드 구현
        │                              ├─ 테스트 작성
        │←──────────────── 리뷰 요청 ──┤
        ├─ 코드 리뷰 ─────────────────→│
        │                              ├─ 피드백 반영
```

**상세 가이드:** `.agent/workflows/claude-gemini-cowork.md`

---

## 4. 서브 에이전트

특정 작업을 처리하도록 설계된 전문화된 에이전트입니다.

| 에이전트 | 파일 위치 | 용도 |
|----------|----------|------|
| game-designer | [.claude/agents/game-designer.md](.claude/agents/game-designer.md) | 가이드 기반 상세 사양 작성 (병렬) |
| code-reviewer | [.claude/agents/code-reviewer.md](.claude/agents/code-reviewer.md) | 코드 품질/보안/성능 리뷰 |
| issue-fixer | [.claude/agents/issue-fixer.md](.claude/agents/issue-fixer.md) | 개별 이슈 자동 수정 |

---

## 5. 스킬

에이전트가 호출할 수 있는 개별 기능입니다.

| 스킬 | 파일 위치 | 용도 |
|------|----------|------|
| creative-director | [.claude/skills/creative-director/](.claude/skills/creative-director/) | Steam 태그 기반 게임 컨셉 제안 (Phase 1) + 가이드 리뷰 (Phase 3) |
| game-design-lead | [.claude/skills/game-design-lead/](.claude/skills/game-design-lead/) | 가이드 작성 (Phase 2) / 서브 에이전트 디스패치 (Phase 4) / 사양 리뷰 (Phase 5) |
| game-implementer | [.claude/skills/game-implementer/](.claude/skills/game-implementer/) | 사양 기반 Vite + TypeScript 게임 구현 (Phase 6). frontend-design 스킬의 미학 원칙 적용 |
| frontend-design | [.claude/skills/frontend-design/](.claude/skills/frontend-design/) | 프론트엔드 UI 디자인 |
| subagent-creator | [.claude/skills/subagent-creator/](.claude/skills/subagent-creator/) | 새 서브 에이전트 생성 |
| ralph-loop | 플러그인 | 반복적 개선 루프 |

---

## 6. 프로젝트 규칙

AI 에이전트가 따라야 할 규칙입니다.

| 규칙 | 파일 위치 | 설명 |
|------|----------|------|
| 코드 스타일 | [.claude/rules/code-style.md](.claude/rules/code-style.md) | 언어별 코드 스타일, 네이밍 컨벤션 |
| 보안 | [.claude/rules/security.md](.claude/rules/security.md) | 민감 정보 처리, Git 보안 규칙 |
| Ralph Loop | [.claude/rules/ralph-loop.md](.claude/rules/ralph-loop.md) | Ralph Loop 사용 지침 |

---

## 7. 디렉토리 구조

```
.
├── CLAUDE.md                    # Claude Code 전역 지침
├── README.md                    # 이 파일
├── package.json                 # 프로젝트 설정
├── tsconfig.json                # TypeScript 설정
├── .env.example                 # 환경 변수 템플릿
├── src/
│   ├── server.ts                # Webhook 서버 (n8n Cloud → 로컬)
│   ├── pipeline.ts              # 파이프라인 오케스트레이터
│   ├── tags.ts                  # Steam 태그 랜덤 선택
│   └── invoke-claude.ts         # Claude Code CLI 래퍼
├── data/
│   └── steam-tags.json          # Steam 게임 태그 목록 (170+)
├── n8n/
│   └── steam-tag-mixer-workflow.json  # n8n 워크플로우 (import용)
├── outputs/                     # 생성된 게임 프로젝트 (일별)
│   └── YYYY-MM-DD_tag1_tag2/
├── .claude/
│   ├── QA_Guide.md              # QA 빌드 점검 가이드
│   ├── agents/                  # 서브 에이전트 정의
│   │   ├── game-designer.md     # 가이드 기반 상세 사양 작성
│   │   ├── code-reviewer.md
│   │   └── issue-fixer.md
│   ├── rules/                   # 프로젝트 규칙
│   │   ├── code-style.md
│   │   ├── security.md
│   │   └── ralph-loop.md
│   ├── skills/                  # 스킬 정의
│   │   ├── creative-director/   # Phase 1: 게임 컨셉 제안 / Phase 3: 가이드 리뷰
│   │   ├── game-design-lead/    # Phase 2,4,5: 가이드 작성, 디스패치, 사양 리뷰
│   │   ├── game-implementer/    # Phase 6: 사양 기반 게임 구현
│   │   ├── frontend-design/
│   │   └── subagent-creator/
│   └── issues/                  # 코드 리뷰 이슈 (임시)
└── .agent/
    └── workflows/               # 협업 워크플로우
        └── claude-gemini-cowork.md
```

---

## 8. 아키텍처 참고

### n8n Cloud 제약사항

n8n Cloud에서는 보안상 `Execute Command` 노드가 제한됩니다. 따라서 Claude Code CLI를 직접 실행할 수 없고, **로컬 Webhook 서버**를 통한 간접 호출 구조를 사용합니다.

```
[n8n Cloud]                      [로컬 머신]
 Schedule Trigger (9시)           Webhook Server (:3847)
  → Code Node (태그 선택)          │
  → HTTP Request ──────────────▶ POST /webhook/run
                                   → Claude Code 실행
                                   → 게임 생성 → outputs/
```

### 파이프라인 6단계 구조

```
Pre: 파이프라인 에셋 복사 + CLAUDE.md 생성
  처리: SteamTagMixer의 .claude/skills/, .claude/agents/ → 게임 출력 디렉토리로 복사
  복사 대상: creative-director, game-design-lead, game-implementer, frontend-design 스킬 + game-designer 에이전트
  추가: 게임 레포용 CLAUDE.md 자동 생성 (프로젝트 구조, 스킬 참조, 작업 지침)
  목적: Claude Code가 cwd에서 스킬/에이전트 정의와 프로젝트 지침을 참조할 수 있도록 사전 배치

Phase 1: Creative Director (creative-director 스킬)
  입력: Steam 태그 목록
  출력: proposal.md (게임 제안서)

Post-Phase 1: GitHub Repository 생성
  처리: proposal.md에서 게임 제목 추출 → slugify → git init → gh repo create --public
  출력: 게임별 독립 Public GitHub 레포지토리 (초기 커밋: 에셋 + proposal.md)
  참고: 이름 충돌 시 날짜 접미사 자동 추가. createRepo=false로 비활성화 가능.

Phase 2: Game Design Lead - 가이드 작성 (game-design-lead 스킬, 모드 1) → commit
  입력: proposal.md
  출력: specs/design-plan.md, specs/guide-*.md

Phase 3: Creative Director - 가이드 리뷰 (creative-director 스킬, 리뷰 모드) → commit
  입력: proposal.md + specs/guide-*.md
  처리: 핵심 경험 보존, 태그 반영, 게임 루프 왜곡 여부 등 6가지 관점 점검
  출력: specs/review-guides.md (+ 가이드 파일 직접 수정)

Phase 4: Game Design Lead - 서브 에이전트 디스패치 (game-design-lead 스킬, 모드 2) → commit
  입력: 리뷰 반영된 guide-*.md
  처리: game-designer 서브 에이전트 병렬 호출
  출력: specs/spec-*.md

  ┌─ game-designer #1 → spec-core-mechanics.md
  ├─ game-designer #2 → spec-game-loop.md
  ├─ game-designer #3 → spec-controls.md
  └─ game-designer #4 → spec-ui.md
     (게임에 따라 3~7개 병렬 실행)

Phase 5: Game Design Lead - 사양 리뷰 (game-design-lead 스킬, 모드 3) → commit
  입력: guide-*.md + spec-*.md
  처리: 사양 간 일관성, 인터페이스 호환, 수치 정합성 등 점검
  출력: specs/review-specs.md (+ spec 파일 직접 수정)

Phase 6: Game Implementer (game-implementer 스킬 + frontend-design 스킬) → commit + push
  입력: proposal.md + specs/spec-*.md + specs/review-specs.md (리뷰 반영 완료)
  처리: 사양 통합 분석 → 아키텍처 설계 → 순차 구현 (타입 → 메카닉 → 루프 → 렌더링 → UI)
  검증: ralph-wiggum 플러그인으로 반복 검증 (빌드 + 사양 준수 + 런타임, 최대 10회)
  완료: <promise>IMPLEMENTATION COMPLETE</promise> 신호로 이터레이션 종료
  출력: Vite + TypeScript 프로젝트 (플레이 가능, 빌드 에러 0개)
```

**Git 히스토리 구조:**
```
feat: Phase 1 - game proposal & pipeline assets    ← 초기 커밋 + 레포 생성
docs: Phase 2 - design guides
docs: Phase 3 - guide review & revisions
docs: Phase 4 - detailed specs
docs: Phase 5 - spec review & revisions
feat: Phase 6 - game implementation                ← 최종 push
```

### 사전 요구사항

- **GitHub CLI (`gh`)**: 레포 자동 생성에 필요. `gh auth login`으로 인증 완료 상태여야 합니다.
- **Git**: 로컬 머신에 설치 필요.
- **jq**: ralph-wiggum 플러그인의 Stop hook에서 JSON 파싱에 사용. `winget install jqlang.jq` 또는 패키지 매니저로 설치.
- **ralph-wiggum 플러그인**: `claude plugin install ralph-wiggum`으로 설치. Phase 6 이터레이션 검증에 사용.

---

## 9. AI 어시스턴트 지침

### 언어

- **기본 언어**: 한국어
- **기술 용어**: 정확성을 위해 영어 허용

### 핵심 원칙

1. **컨텍스트 인식**: 작업 전 현재 상태 확인
2. **사용자 의도 우선**: 모호한 요청은 질문으로 명확화
3. **안전 우선**: 파일 작업과 명령 실행 검증
4. **아티팩트 활용**: 복잡한 작업은 계획 문서 생성

---

## 10. 문서 이력

- 2026-02-05: 게임 레포용 CLAUDE.md 자동 생성 추가
- 2026-02-05: ralph-wiggum 플러그인 통합, Phase 6 반복 검증 (빌드·사양·런타임, 최대 10회 이터레이션)
- 2026-02-05: game-implementer 스킬 상세 정의, frontend-design 스킬 연동, Phase 6 프롬프트 업데이트
- 2026-02-05: 레포 생성 시점을 Phase 1 직후로 이동, 각 Phase별 커밋 구조 도입
- 2026-02-04: 게임별 GitHub 레포지토리 자동 생성 기능 추가
- 2026-02-04: 6단계 파이프라인 구조 확립 (CD 가이드 리뷰 + DL 사양 리뷰 추가)
- 2026-02-04: Steam Tag Mixer 파이프라인 구축 (n8n + Webhook + Claude Code)
- 2026-01-19: 하이브리드 이슈 수정 방식 도입, Ralph Loop 지침 추가
- 2025-12-22: QA 가이드 개선, 이슈 즉시 파일 생성 방식 도입
- 2025-12-20: 서브 에이전트 및 스킬 시스템 구축
- 초기: 레포지토리 생성
