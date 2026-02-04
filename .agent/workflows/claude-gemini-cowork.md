---
description: Gemini & Claude Code 협업 구현 워크플로우
---

이 워크플로우는 사용자의 요구사항을 바탕으로 기획-리뷰-구현-검수를 자동화합니다.

## 역할 분담
- **Gemini (Architect/Reviewer):** 요구사항 문서화(Specs) 및 최종 구현 코드 검수
- **Claude Code (Developer/Actualizer):** 파일 시스템 분석, 사양서 기술 검토 및 실제 코드 작성

## 작동 프로세스
1. **[Planning]** Gemini가 유저 요청을 분석하여 현재 workspace의 최상위 폴더 하위의 Documents 폴더에`{요청한 작업 요약} 사양.md` 초안을 작성한다.
2. **[Technical Review]** Claude Code는 해당 문서를 읽고 현재 프로젝트 구조와의 정합성을 확인한 뒤 수정 제안을 한다.
3. **[Consensus Loop]** - Gemini와 Claude Code가 사양에 대해 서로 피드백을 주고받는다.
   - 양쪽 에이전트가 "CONFIRMED" 상태가 될 때까지 사양 문서를 업데이트한다.
4. **[Implementation]** 사양이 확정되면 Claude Code가 실제 소스 코드를 프로젝트에 생성하거나 수정한다.
5. **[Final Review]** 구현이 완료되면 Gemini가 코드를 읽어 사양서와 일치하는지 최종 검수 리포트를 제출한다.

## 주의 사항
- 모든 사양 협의는 마크다운 문서(`{요청한 작업 요약} 사양.md`)를 기준으로 진행한다.
- 무한 루프 방지를 위해 협의 과정은 최대 3회로 제한하며, 3회 초과 시 사용자에게 개입을 요청한다.
- 마크다운 문서는 한글로 작성한다. 전문 용어나 코드에서 사용 중인 용어 및 변수명은 영어를 사용한다.
