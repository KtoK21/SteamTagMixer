# Steam Tag Mixer - 작업 진행 기록

> 마지막 업데이트: 2026-02-05

## 목표

매일 특정 시각에 n8n Cloud가 트리거 → Steam 태그 랜덤 선택 → 로컬 서버 호출 → 6단계 AI 파이프라인으로 웹 게임 프로토타입 자동 생성 → GitHub 레포 공유

```
n8n Cloud (Schedule Trigger, 매일 09:00)
  → Code 노드: Steam 태그 2~5개 랜덤 선택
  → HTTP Request: POST /webhook/run
  → Cloudflare Tunnel
  → 로컬 Express 서버 (:3847)
  → 파이프라인 (6 Phase + ralph-wiggum 이터레이션)
  → GitHub Public 레포 자동 생성 + push
```

---

## 완료된 작업

### 1. 파이프라인 코드 (100%)

| 파일 | 설명 |
|------|------|
| `src/pipeline.ts` (739줄) | 6단계 파이프라인 오케스트레이터 |
| `src/invoke-claude.ts` | Claude Code CLI 래퍼 (`claude -p`) |
| `src/server.ts` | Express webhook 서버 (POST /webhook/run, GET /status, GET /health) |
| `src/tags.ts` | Steam 태그 170+개 목록 + 랜덤 선택 |

### 2. 스킬 & 에이전트 정의 (100%)

| 스킬/에이전트 | 위치 |
|--------------|------|
| creative-director | `.claude/skills/creative-director/SKILL.md` |
| game-design-lead | `.claude/skills/game-design-lead/SKILL.md` |
| game-implementer | `.claude/skills/game-implementer/SKILL.md` |
| frontend-design | `.claude/skills/frontend-design/SKILL.md` |
| game-designer (서브 에이전트) | `.claude/agents/game-designer.md` |

### 3. 파이프라인 기능 (100%)

- [x] 6단계 파이프라인 (CD → DL가이드 → CD리뷰 → DL디스패치 → DL리뷰 → 구현)
- [x] 게임 레포용 CLAUDE.md 자동 생성 (`generateGameClaudeMd()`)
- [x] GitHub 레포 자동 생성 (Post-Phase 1, `gh repo create --public`)
- [x] ralph-wiggum 플러그인 통합 (Phase 6 반복 검증, 최대 10회)
- [x] 각 Phase별 git commit 구조
- [x] n8n 워크플로우 JSON 템플릿 (`n8n/steam-tag-mixer-workflow.json`)

### 4. 환경 설정 (완료)

- [x] `.env` 생성: PORT, WEBHOOK_SECRET, ANTHROPIC_API_KEY, N8N_HOST, N8N_API_KEY
- [x] `.env.example` 업데이트 (n8n 변수 포함)
- [x] GitHub CLI 설치 (`gh` v2.86.0) + `gh auth login` (KtoK21 계정)
- [x] cloudflared 설치 (winget, v2025.8.1) — 아직 터널 설정은 안 함
- [x] 초기 커밋 + push (commit: `76b0801`, 16 files, 4391 insertions)

---

## 남은 작업 (n8n Cloud 연동)

### 작업 1: `src/n8n-api.ts` — n8n Cloud REST API 클라이언트

n8n Cloud REST API를 호출하는 TypeScript 모듈.

```typescript
// 필요한 함수:
createWorkflow(workflow)    // POST /api/v1/workflows
updateWorkflow(id, data)    // PUT /api/v1/workflows/{id}
activateWorkflow(id)        // POST /api/v1/workflows/{id}/activate
deactivateWorkflow(id)      // POST /api/v1/workflows/{id}/deactivate
getWorkflows()              // GET /api/v1/workflows

// 인증: X-N8N-API-KEY 헤더
// 베이스 URL: N8N_HOST + /api/v1
```

환경 변수: `N8N_HOST`, `N8N_API_KEY` (`.env`에 설정 완료)

### 작업 2: `src/setup-n8n.ts` — 워크플로우 배포 스크립트 (1회 실행)

- `n8n/steam-tag-mixer-workflow.json` 읽기
- 워크플로우의 `$env.WEBHOOK_URL`, `$env.WEBHOOK_SECRET`을 실제 값으로 치환
- n8n API로 워크플로우 생성
- 생성된 workflow ID를 `.env`에 `N8N_WORKFLOW_ID`로 저장
- `npm run setup:n8n`으로 실행

### 작업 3: `src/start.ts` — 통합 스타터 (서버 + 터널 + n8n 동기화)

하나의 프로세스에서 모두 관리:

1. Express 서버 시작 (port 3847)
2. `cloudflared tunnel --url http://localhost:3847` 실행 → Quick Tunnel URL 파싱
3. n8n API로 워크플로우의 HTTP Request 노드 URL을 터널 URL로 업데이트
4. 워크플로우 활성화
5. Graceful shutdown 처리

Quick Tunnel은 재시작마다 URL이 바뀌므로, 시작 시 자동으로 n8n 워크플로우를 업데이트하는 구조.

### 작업 4: PM2 상시 실행 구성

- `ecosystem.config.cjs` 생성 (PM2 설정)
- `npm install -g pm2`
- `pm2 start ecosystem.config.cjs`
- `pm2 save && pm2 startup`으로 부팅 시 자동 시작

### 작업 5: `package.json` 스크립트 추가

```json
{
  "setup:n8n": "tsx src/setup-n8n.ts",
  "start:all": "tsx src/start.ts"
}
```

### 작업 6: E2E 파이프라인 테스트

- API 500 에러로 중단됨 (Anthropic API 서버 불안정)
- API 안정화 후 재시도: `npm run pipeline`
- 태그 예시: Hand-Drawn, Board Game (이전 시도에서 선택됨)

### 작업 7: README.md 업데이트

n8n Cloud 연동 섹션 추가:
- 셋업 방법 (`npm run setup:n8n`)
- 실행 방법 (`npm run start:all` 또는 PM2)
- 환경 변수 설명 (N8N_HOST, N8N_API_KEY, N8N_WORKFLOW_ID)

### 작업 8 (낮은 우선순위): invoke-claude.ts DEP0190 경고 수정

`shell: true` → `shell: false` 전환. Node.js DEP0190 경고 해결.

---

## 환경 요구사항 (다른 컴퓨터에서 이어할 때)

```bash
# 1. 레포 클론
git clone https://github.com/KtoK21/SteamTagMixer.git
cd SteamTagMixer

# 2. 의존성 설치
npm install

# 3. .env 파일 생성 (.env.example 참고)
cp .env.example .env
# PORT, WEBHOOK_SECRET, ANTHROPIC_API_KEY, N8N_HOST, N8N_API_KEY 설정

# 4. 도구 설치
gh auth login                    # GitHub CLI 인증
winget install Cloudflare.cloudflared  # 터널
npm install -g pm2               # 프로세스 매니저 (선택)

# 5. 빌드 확인
npx tsc --noEmit
```

---

## 주요 파일 구조

```
SteamTagMixer/
├── src/
│   ├── pipeline.ts       # 6단계 파이프라인 오케스트레이터
│   ├── server.ts         # Express webhook 서버
│   ├── invoke-claude.ts  # Claude Code CLI 래퍼
│   ├── tags.ts           # Steam 태그 목록 + 랜덤 선택
│   ├── n8n-api.ts        # [미구현] n8n Cloud REST API 클라이언트
│   ├── setup-n8n.ts      # [미구현] 워크플로우 배포 스크립트
│   └── start.ts          # [미구현] 통합 스타터
├── n8n/
│   └── steam-tag-mixer-workflow.json  # n8n 워크플로우 템플릿
├── .claude/
│   ├── skills/           # 스킬 정의 (4개)
│   ├── agents/           # 서브 에이전트 (1개)
│   └── rules/            # 코드 스타일, 보안, ralph-loop 규칙
├── .env                  # 환경 변수 (gitignore)
├── .env.example          # 환경 변수 템플릿
├── CLAUDE.md             # 에이전트 전역 지침
├── README.md             # 프로젝트 문서
└── PROGRESS.md           # 이 파일
```
