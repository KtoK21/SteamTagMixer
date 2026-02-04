<!-- [.claude/README.md] Claude Code 설정 디렉토리 구조 및 각 파일 역할 설명 -->

# .claude 디렉토리 구조

이 디렉토리는 Claude Code 에이전트의 설정과 확장 기능을 정의합니다.

## 파일 및 디렉토리 설명

| 경로 | 설명 |
|------|------|
| `settings.json` | Claude Code 도구 권한, 환경 변수, 보안 정책 설정 |
| `rules/code-style.md` | 언어별 코드 스타일, 네이밍 컨벤션, 주석 규칙 정의 |
| `rules/security.md` | 민감 정보 처리, Git 보안, 코드 보안 규칙 정의 |
| `agents/` | 서브 에이전트 정의 (code-reviewer, issue-fixer 등) |
| `skills/` | 스킬 정의 (frontend-design, subagent-creator 등) |
| `QA_Guide.md` | QA 가이드라인 |
