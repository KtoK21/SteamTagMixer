# AI 게임 프로토타입 템플릿

AI 에이전트를 활용하여 **빠르게 게임 프로토타입을 제작**할 수 있는 템플릿 레포지토리입니다.

Claude Code와 Gemini를 활용한 자동화된 개발 워크플로우, 코드 리뷰, 버그 수정 프로세스를 제공합니다.

---

## 1. 목적

이 레포지토리의 주요 목표:

1. **빠른 프로토타이핑**: AI 에이전트를 활용하여 게임 아이디어를 빠르게 구현
2. **자동화된 QA**: 코드 리뷰, 이슈 발견, 버그 수정을 자동화
3. **협업 워크플로우**: Gemini(기획)와 Claude(구현)의 역할 분담을 통한 효율적인 개발

---

## 2. 주요 기능

### 2.1 QA 빌드 점검

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

### 2.2 Ralph Loop

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

### 2.3 Claude-Gemini 협업 워크플로우

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

## 3. 서브 에이전트

특정 작업을 처리하도록 설계된 전문화된 에이전트입니다.

| 에이전트 | 파일 위치 | 용도 |
|----------|----------|------|
| code-reviewer | [.claude/agents/code-reviewer.md](.claude/agents/code-reviewer.md) | 코드 품질/보안/성능 리뷰 |
| issue-fixer | [.claude/agents/issue-fixer.md](.claude/agents/issue-fixer.md) | 개별 이슈 자동 수정 |

---

## 4. 스킬

에이전트가 호출할 수 있는 개별 기능입니다.

| 스킬 | 파일 위치 | 용도 |
|------|----------|------|
| frontend-design | [.claude/skills/frontend-design/](.claude/skills/frontend-design/) | 프론트엔드 UI 디자인 |
| subagent-creator | [.claude/skills/subagent-creator/](.claude/skills/subagent-creator/) | 새 서브 에이전트 생성 |
| ralph-loop | 플러그인 | 반복적 개선 루프 |

---

## 5. 프로젝트 규칙

AI 에이전트가 따라야 할 규칙입니다.

| 규칙 | 파일 위치 | 설명 |
|------|----------|------|
| 코드 스타일 | [.claude/rules/code-style.md](.claude/rules/code-style.md) | 언어별 코드 스타일, 네이밍 컨벤션 |
| 보안 | [.claude/rules/security.md](.claude/rules/security.md) | 민감 정보 처리, Git 보안 규칙 |
| Ralph Loop | [.claude/rules/ralph-loop.md](.claude/rules/ralph-loop.md) | Ralph Loop 사용 지침 |

---

## 6. 디렉토리 구조

```
.
├── CLAUDE.md                    # Claude Code 전역 지침
├── README.md                    # 이 파일
├── .claude/
│   ├── QA_Guide.md              # QA 빌드 점검 가이드
│   ├── agents/                  # 서브 에이전트 정의
│   │   ├── code-reviewer.md
│   │   └── issue-fixer.md
│   ├── rules/                   # 프로젝트 규칙
│   │   ├── code-style.md
│   │   ├── security.md
│   │   └── ralph-loop.md
│   ├── skills/                  # 스킬 정의
│   │   ├── frontend-design/
│   │   └── subagent-creator/
│   └── issues/                  # 코드 리뷰 이슈 (임시)
└── .agent/
    └── workflows/               # 협업 워크플로우
        └── claude-gemini-cowork.md
```

---

## 7. 빠른 시작

### 코드 리뷰 및 버그 수정

1. **코드 리뷰 요청**
   ```
   코드 리뷰해줘
   ```

2. **수정할 이슈 선택**
   ```
   1, 3, 5번 이슈 수정해줘
   ```
   또는
   ```
   Critical 전부 수정해줘
   ```

3. **결과 확인**
   - 수정된 이슈는 자동으로 이슈 파일 삭제
   - 실패한 이슈는 실패 보고서와 함께 보존

### Ralph Loop 사용

```
/ralph-loop "[작업 설명]. 완료되면 <promise>DONE</promise>을 출력하세요." --max-iterations 10 --completion-promise "DONE"
```

### Ralph Loop 취소

```
/cancel-ralph
```

---

## 8. AI 어시스턴트 지침

### 언어

- **기본 언어**: 한국어
- **기술 용어**: 정확성을 위해 영어 허용

### 핵심 원칙

1. **컨텍스트 인식**: 작업 전 현재 상태 확인
2. **사용자 의도 우선**: 모호한 요청은 질문으로 명확화
3. **안전 우선**: 파일 작업과 명령 실행 검증
4. **아티팩트 활용**: 복잡한 작업은 계획 문서 생성

---

## 9. 문서 이력

- 2026-01-19: 하이브리드 이슈 수정 방식 도입, Ralph Loop 지침 추가
- 2025-12-22: QA 가이드 개선, 이슈 즉시 파일 생성 방식 도입
- 2025-12-20: 서브 에이전트 및 스킬 시스템 구축
- 초기: 레포지토리 생성
