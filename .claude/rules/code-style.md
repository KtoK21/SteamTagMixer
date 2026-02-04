<!-- [.claude/rules/code-style.md] 언어별 코드 스타일, 네이밍 컨벤션, 주석 규칙 정의 -->

# 코드 스타일 규칙

이 파일은 프로젝트 전반에 적용되는 코드 스타일 규칙을 정의합니다.

## 일반 원칙

- **가독성 우선**: 코드는 작성하는 것보다 읽는 경우가 더 많습니다. 명확하고 읽기 쉬운 코드를 작성하십시오.
- **일관성 유지**: 기존 코드베이스의 스타일을 따르십시오.
- **단순함 추구**: 불필요한 복잡성을 피하십시오.

## 언어별 스타일 가이드

### Python

- PEP 8 스타일 가이드 준수
- 들여쓰기: 4 spaces
- 최대 줄 길이: 88자 (Black 기본값)
- Type hints 사용 권장
- Docstring: Google 스타일

### JavaScript/TypeScript

- ESLint + Prettier 설정 준수
- 들여쓰기: 2 spaces
- 세미콜론: 사용
- 따옴표: 작은따옴표 ('') 선호
- 화살표 함수 선호

### 마크다운

- 헤더에 ATX 스타일 사용 (`#`)
- 목록은 하이픈 (`-`) 사용
- 코드 블록에 언어 명시

## 네이밍 컨벤션

| 대상 | 스타일 | 예시 |
|------|--------|------|
| 변수/함수 | camelCase | `getUserName` |
| 클래스 | PascalCase | `UserService` |
| 상수 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| 파일명 | kebab-case | `user-service.ts` |
| 디렉토리 | kebab-case | `user-management/` |

## 주석 규칙

- 코드가 "무엇을" 하는지보다 "왜" 그렇게 하는지 설명
- TODO 주석 형식: `// TODO(작성자): 설명`
- 불필요한 주석 지양 (코드 자체가 문서가 되도록)
