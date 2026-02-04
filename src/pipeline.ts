import { mkdirSync, existsSync, writeFileSync, readFileSync, copyFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { selectRandomTags, type TagSelection } from './tags.js';
import { invokeClaude } from './invoke-claude.js';

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const OUTPUTS_DIR = resolve(PROJECT_ROOT, 'outputs');

export interface PipelineConfig {
  /** 최소 태그 수 (기본 2) */
  minTags?: number;
  /** 최대 태그 수 (기본 5) */
  maxTags?: number;
  /** 외부에서 전달된 태그 (n8n에서 선택한 경우). 없으면 자체 랜덤 선택 */
  preSelectedTags?: string[];
  /** GitHub 레포지토리 자동 생성 여부 (기본 true) */
  createRepo?: boolean;
}

interface PhaseResult {
  success: boolean;
  error?: string;
}

export interface PipelineResult {
  success: boolean;
  date: string;
  tags: TagSelection;
  outputDir: string;
  phases: {
    creativeDirector?: PhaseResult;
    designLeadGuides?: PhaseResult;
    cdReview?: PhaseResult;
    designLeadDispatch?: PhaseResult;
    dlReview?: PhaseResult;
    implement?: PhaseResult;
  };
  repoUrl?: string;
  error?: string;
}

/**
 * 오늘 날짜 기반의 출력 디렉토리 경로를 생성한다.
 * 형식: outputs/YYYY-MM-DD_tag1-tag2-tag3
 */
function createOutputDir(tags: string[]): string {
  const date = new Date().toISOString().split('T')[0];
  const slug = tags
    .map((t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
    .join('_');
  const dirName = `${date}_${slug}`;
  const outputDir = resolve(OUTPUTS_DIR, dirName);

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  return outputDir;
}

/**
 * proposal.md에서 게임 제목을 추출한다.
 * 첫 번째 H1 헤딩(# Title)을 파싱한다.
 */
function extractGameTitle(outputDir: string): string {
  const proposalPath = resolve(outputDir, 'proposal.md');
  if (!existsSync(proposalPath)) return 'untitled-game';
  const content = readFileSync(proposalPath, 'utf-8');
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'untitled-game';
}

/**
 * 게임 제목을 GitHub 레포지토리 이름으로 변환한다.
 * 소문자, 하이픈 구분, 특수문자 제거.
 */
function slugifyForRepo(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'untitled-game';
}

/**
 * 파이프라인 에셋(스킬 정의, 에이전트 정의)을 출력 디렉토리에 복사한다.
 * 게임 레포에 "이 게임이 어떤 프로세스로 만들어졌는지"가 함께 기록된다.
 */
function copyPipelineAssets(outputDir: string): void {
  const skillsToCopy = [
    'creative-director',
    'game-design-lead',
    'game-implementer',
    'frontend-design',
  ];
  const agentsToCopy = [
    'game-designer',
  ];

  // 스킬 복사: .claude/skills/{name}/ 내 모든 파일 (SKILL.md, LICENSE.txt 등)
  const skillFiles = ['SKILL.md', 'LICENSE.txt'];
  for (const skill of skillsToCopy) {
    const srcDir = resolve(PROJECT_ROOT, '.claude', 'skills', skill);
    if (!existsSync(srcDir)) continue;
    const destDir = resolve(outputDir, '.claude', 'skills', skill);
    mkdirSync(destDir, { recursive: true });
    for (const file of skillFiles) {
      const src = resolve(srcDir, file);
      if (existsSync(src)) {
        copyFileSync(src, resolve(destDir, file));
      }
    }
  }

  // 에이전트 복사: .claude/agents/{name}.md
  for (const agent of agentsToCopy) {
    const src = resolve(PROJECT_ROOT, '.claude', 'agents', `${agent}.md`);
    if (!existsSync(src)) continue;
    const destDir = resolve(outputDir, '.claude', 'agents');
    mkdirSync(destDir, { recursive: true });
    copyFileSync(src, resolve(destDir, `${agent}.md`));
  }

  console.log('[Pipeline] 파이프라인 에셋 복사 완료 (.claude/skills/, .claude/agents/)');
}

/**
 * 게임 레포용 CLAUDE.md를 생성한다.
 *
 * Claude Code가 게임 프로젝트의 cwd에서 실행될 때
 * 프로젝트 구조, 사용 가능한 스킬, 작업 지침을 인식할 수 있도록 한다.
 */
function generateGameClaudeMd(outputDir: string, tagNames: string[], date: string): void {
  const content = [
    `# Steam Tag Mixer 게임 프로젝트`,
    ``,
    `이 프로젝트는 **Steam Tag Mixer** 파이프라인에 의해 자동 생성된 웹 게임 프로토타입입니다.`,
    ``,
    `## 프로젝트 정보`,
    ``,
    `- **기술 스택**: Vite + TypeScript`,
    `- **선택된 태그**: ${tagNames.join(', ')}`,
    `- **생성일**: ${date}`,
    ``,
    `## 언어`,
    ``,
    `- **기본 언어**: 한국어`,
    `- **기술 용어**: 정확성을 위해 영어 허용`,
    ``,
    `## 프로젝트 구조`,
    ``,
    '```',
    `.`,
    `├── src/              # 게임 소스 코드`,
    `│   ├── main.ts       # 진입점`,
    `│   ├── types.ts      # 타입 정의`,
    `│   └── constants.ts  # 수치 상수`,
    `├── specs/            # 게임 사양 문서`,
    `│   ├── spec-*.md     # 상세 사양`,
    `│   ├── guide-*.md    # 설계 가이드`,
    `│   └── review-*.md   # 리뷰 결과`,
    `├── proposal.md       # 게임 제안서`,
    `├── index.html        # HTML 진입점`,
    `├── package.json      # 의존성`,
    `└── tsconfig.json     # TypeScript 설정`,
    '```',
    ``,
    `## 스킬 참조`,
    ``,
    `이 프로젝트에는 다음 스킬/에이전트 정의가 포함되어 있습니다:`,
    ``,
    `| 스킬 | 위치 | 용도 |`,
    `|------|------|------|`,
    `| game-implementer | .claude/skills/game-implementer/ | 사양 기반 게임 구현 (Phase A~I) |`,
    `| frontend-design | .claude/skills/frontend-design/ | UI 미학 원칙 |`,
    `| creative-director | .claude/skills/creative-director/ | 게임 컨셉 (참고용) |`,
    `| game-design-lead | .claude/skills/game-design-lead/ | 사양 설계 프로세스 (참고용) |`,
    `| game-designer | .claude/agents/game-designer.md | 상세 사양 작성 서브 에이전트 (참고용) |`,
    ``,
    `## 작업 지침`,
    ``,
    `1. \`specs/\` 디렉토리의 사양 문서가 이 게임의 설계 원천입니다`,
    `2. \`proposal.md\`가 게임의 핵심 컨셉과 경험을 정의합니다`,
    `3. 코드 수정 시 \`npx tsc --noEmit\` + \`npm run build\`로 빌드 확인`,
    `4. 사양 문서(\`specs/\`)와 \`proposal.md\`는 수정하지 마세요`,
    `5. 게임 실행: \`npm run dev\``,
    ``,
  ].join('\n');

  writeFileSync(resolve(outputDir, 'CLAUDE.md'), content);
  console.log('[Pipeline] 게임 레포용 CLAUDE.md 생성 완료');
}

/**
 * 게임 레포지토리를 초기화한다.
 *
 * Phase 1 완료 후 호출되어 다음을 수행한다:
 * 1. .gitignore 생성
 * 2. git init → add → commit (초기 커밋: 에셋 + proposal.md)
 * 3. gh repo create로 Public 레포 생성
 * 4. 이름 충돌 시 날짜 접미사를 붙여 재시도
 */
async function initGameRepo(
  outputDir: string,
  repoName: string,
  date: string,
): Promise<{ success: boolean; repoUrl?: string; error?: string }> {
  try {
    // .gitignore 생성 (없는 경우 기본값)
    const gitignorePath = resolve(outputDir, '.gitignore');
    if (!existsSync(gitignorePath)) {
      writeFileSync(gitignorePath, [
        'node_modules/',
        'dist/',
        '.env',
        '.env.*',
        '!.env.example',
        '.DS_Store',
        'Thumbs.db',
      ].join('\n'));
    }

    // git init + add + commit (Phase 1 결과물 포함)
    await execFileAsync('git', ['init'], { cwd: outputDir, shell: true });
    await execFileAsync('git', ['add', '.'], { cwd: outputDir, shell: true });
    await execFileAsync(
      'git',
      ['commit', '-m', 'feat: Phase 1 - game proposal & pipeline assets'],
      { cwd: outputDir, shell: true },
    );

    // gh repo create (public, source 지정, push)
    let finalName = repoName;
    try {
      await execFileAsync(
        'gh',
        ['repo', 'create', finalName, '--public', '--source', '.', '--push'],
        { cwd: outputDir, shell: true },
      );
    } catch {
      // 이름 충돌 시 날짜 접미사로 재시도
      finalName = `${repoName}-${date}`;
      console.log(`[Pipeline] 레포 이름 충돌. 재시도: ${finalName}`);
      await execFileAsync(
        'gh',
        ['repo', 'create', finalName, '--public', '--source', '.', '--push'],
        { cwd: outputDir, shell: true },
      );
    }

    // gh에서 생성된 레포 URL 조회
    const { stdout } = await execFileAsync(
      'gh',
      ['repo', 'view', '--json', 'url', '-q', '.url'],
      { cwd: outputDir, shell: true },
    );
    const repoUrl = stdout.trim();

    return { success: true, repoUrl };
  } catch (err: unknown) {
    const error = err as Error;
    return { success: false, error: error.message };
  }
}

/**
 * 특정 Phase의 결과물을 게임 레포에 커밋한다.
 *
 * 변경된 파일만 커밋하므로, 변경 사항이 없으면 커밋을 건너뛴다.
 */
async function commitPhase(
  outputDir: string,
  phaseName: string,
  message: string,
): Promise<void> {
  try {
    await execFileAsync('git', ['add', '.'], { cwd: outputDir, shell: true });

    // 변경 사항 존재 여부 확인 (없으면 커밋 스킵)
    const { stdout } = await execFileAsync(
      'git',
      ['status', '--porcelain'],
      { cwd: outputDir, shell: true },
    );
    if (!stdout.trim()) {
      console.log(`[Pipeline] ${phaseName}: 변경 사항 없음, 커밋 스킵`);
      return;
    }

    await execFileAsync(
      'git',
      ['commit', '-m', message],
      { cwd: outputDir, shell: true },
    );
    console.log(`[Pipeline] ${phaseName}: 커밋 완료`);
  } catch (err: unknown) {
    console.warn(`[Pipeline] ${phaseName}: 커밋 실패 (파이프라인은 계속): ${(err as Error).message}`);
  }
}

/**
 * 게임 레포의 모든 커밋을 원격에 푸시한다.
 */
async function pushRepo(outputDir: string): Promise<void> {
  try {
    await execFileAsync('git', ['push'], { cwd: outputDir, shell: true });
    console.log('[Pipeline] 원격 레포에 푸시 완료');
  } catch (err: unknown) {
    console.warn(`[Pipeline] 푸시 실패 (게임은 정상 생성됨): ${(err as Error).message}`);
  }
}

/**
 * Phase 1: Creative Director
 *
 * Steam 태그 조합으로부터 게임 컨셉을 도출하고 proposal.md를 생성한다.
 * creative-director 스킬의 지침에 따라 플레이어 경험 중심의 게임 제안서를 작성한다.
 */
function buildCreativeDirectorPrompt(tags: string[], outputDir: string): string {
  return [
    `당신은 creative-director 스킬이 로드된 상태입니다.`,
    `다음 Steam 태그 조합을 기반으로 독창적인 웹 게임 프로토타입을 제안하세요.`,
    ``,
    `## 선택된 태그`,
    tags.map((t) => `- ${t}`).join('\n'),
    ``,
    `## 지시사항`,
    `1. creative-director 스킬의 사고 프로세스(태그 해석 → 시너지 발견 → 핵심 경험 정의 → 게임 루프 구상)를 따르세요.`,
    `2. 스킬에서 정의한 proposal.md 템플릿의 모든 섹션을 빠짐없이 작성하세요.`,
    `3. 출력 파일: ${outputDir}/proposal.md`,
    `4. 모든 태그가 게임플레이에 실질적으로 반영되어야 합니다.`,
    `5. 15분 안에 핵심 루프를 체험할 수 있어야 합니다.`,
    `6. Vite + TypeScript + Canvas/DOM으로 구현 가능해야 합니다.`,
  ].join('\n');
}

/**
 * Phase 2: Game Design Lead - 가이드 작성 모드
 *
 * proposal.md를 읽고 구현에 필요한 사양 항목을 식별하여 가이드 문서를 생성한다.
 * 이 단계에서는 서브 에이전트를 호출하지 않는다.
 */
function buildDesignLeadGuidesPrompt(tags: string[], outputDir: string): string {
  return [
    `당신은 game-design-lead 스킬의 **모드 1: 가이드 작성**으로 동작합니다.`,
    `게임 제안서를 분석하고 사양 가이드 문서를 작성하세요. 서브 에이전트는 호출하지 마세요.`,
    ``,
    `## 선택된 태그`,
    tags.map((t) => `- ${t}`).join('\n'),
    ``,
    `## 입력 파일`,
    `- 게임 제안서: ${outputDir}/proposal.md`,
    ``,
    `## 지시사항`,
    `1. proposal.md를 읽고 분석하세요.`,
    `2. game-design-lead 스킬의 "모드 1: 가이드 작성" 절차를 따르세요.`,
    `3. ${outputDir}/specs/ 디렉토리에 design-plan.md와 각 guide-*.md 파일을 생성하세요.`,
    `4. **서브 에이전트를 호출하지 마세요.** 가이드 문서 작성까지만 수행합니다.`,
  ].join('\n');
}

/**
 * Phase 3: Creative Director - 가이드 리뷰
 *
 * proposal을 작성한 Creative Director 관점에서,
 * 가이드 문서들이 의도한 게임 경험을 담아낼 수 있는지 점검한다.
 */
function buildCdReviewPrompt(outputDir: string): string {
  return [
    `당신은 creative-director 스킬의 **리뷰 모드**로 동작합니다.`,
    `본인이 작성한 게임 제안서를 기준으로, Game Design Lead가 작성한 가이드 문서들을 점검하세요.`,
    ``,
    `## 입력 파일`,
    `- 게임 제안서 (본인 작성): ${outputDir}/proposal.md`,
    `- 사양 계획: ${outputDir}/specs/design-plan.md`,
    `- 가이드 문서: ${outputDir}/specs/guide-*.md (모든 파일)`,
    ``,
    `## 지시사항`,
    `1. proposal.md를 읽어 핵심 경험, 태그 반영, 게임 루프, 메카닉을 재확인하세요.`,
    `2. design-plan.md를 읽어 사양 항목 선정이 적절한지 확인하세요.`,
    `3. 각 guide-*.md를 creative-director 스킬의 "리뷰 모드" 6가지 관점에서 점검하세요.`,
    `4. 문제가 발견되면 가이드 파일을 직접 수정하세요.`,
    `5. 리뷰 결과를 ${outputDir}/specs/review-guides.md에 기록하세요.`,
  ].join('\n');
}

/**
 * Phase 4: Game Design Lead - 서브 에이전트 디스패치 모드
 *
 * 리뷰를 통과한 가이드 문서들을 기반으로 game-designer 서브 에이전트를 병렬 호출한다.
 */
function buildDesignLeadDispatchPrompt(outputDir: string): string {
  return [
    `당신은 game-design-lead 스킬의 **모드 2: 서브 에이전트 디스패치**로 동작합니다.`,
    `리뷰를 거친 가이드 문서를 기반으로 game-designer 서브 에이전트를 병렬 호출하세요.`,
    ``,
    `## 입력 파일`,
    `- 게임 제안서: ${outputDir}/proposal.md`,
    `- 리뷰 결과: ${outputDir}/specs/review-guides.md`,
    `- 가이드 문서: ${outputDir}/specs/guide-*.md (리뷰 후 수정 반영된 상태)`,
    ``,
    `## 지시사항`,
    `1. review-guides.md를 읽어 Creative Director의 수정 사항을 확인하세요.`,
    `2. specs/ 디렉토리의 모든 guide-*.md 파일을 확인하세요.`,
    `3. 각 가이드에 대해 game-designer 서브 에이전트를 Task 도구로 **병렬** 호출하세요.`,
    `4. 각 서브 에이전트 호출 시 다음 정보를 프롬프트에 포함하세요:`,
    `   - 게임 제안서 경로: ${outputDir}/proposal.md`,
    `   - 가이드 문서 경로: ${outputDir}/specs/guide-{항목}.md`,
    `   - 출력 파일 경로: ${outputDir}/specs/spec-{항목}.md`,
    `5. 서브 에이전트 완료 후 spec-*.md 파일들이 생성되었는지 확인하세요.`,
  ].join('\n');
}

/**
 * Phase 5: Game Design Lead - 사양 리뷰 모드
 *
 * game-designer가 작성한 모든 spec 파일의 일관성과 완성도를 점검한다.
 */
function buildDlReviewPrompt(outputDir: string): string {
  return [
    `당신은 game-design-lead 스킬의 **모드 3: 사양 리뷰**로 동작합니다.`,
    `game-designer 서브 에이전트가 작성한 사양 문서들의 일관성과 구현 가능성을 점검하세요.`,
    ``,
    `## 입력 파일`,
    `- 게임 제안서: ${outputDir}/proposal.md`,
    `- 가이드 문서: ${outputDir}/specs/guide-*.md`,
    `- 사양 문서: ${outputDir}/specs/spec-*.md (모든 파일)`,
    ``,
    `## 지시사항`,
    `1. 모든 spec-*.md 파일을 읽으세요.`,
    `2. game-design-lead 스킬의 "모드 3: 사양 리뷰" 6가지 관점에서 점검하세요.`,
    `3. 특히 사양 간 타입/인터페이스 일관성과 수치 정합성을 중점 확인하세요.`,
    `4. 문제가 발견되면 spec 파일을 직접 수정하세요.`,
    `5. 리뷰 결과를 ${outputDir}/specs/review-specs.md에 기록하세요.`,
  ].join('\n');
}

/**
 * Phase 6: Game Implementer (ralph-wiggum 이터레이션 포함)
 *
 * 사양 문서들을 기반으로 플레이 가능한 Vite + TypeScript 웹 게임을 구현한다.
 * game-implementer 스킬의 구현 절차(Phase A~I)를 따른다.
 *
 * ralph-wiggum 플러그인이 stop hook을 통해 자동으로 이터레이션한다:
 * 1. 구현 완료 후 `npx tsc --noEmit` + `npm run build` 실행
 * 2. 각 spec-*.md의 핵심 요구사항이 코드에 반영되었는지 검증
 * 3. 모든 검증 통과 시 <promise>IMPLEMENTATION COMPLETE</promise> 출력
 * 4. 실패 시 stop hook이 같은 프롬프트로 재실행 (최대 maxIterations회)
 */
function buildImplementPrompt(tags: string[], outputDir: string): string {
  return [
    `당신은 game-implementer 스킬이 로드된 상태입니다.`,
    `사양 문서들을 기반으로 플레이 가능한 Vite + TypeScript 웹 게임을 구현하세요.`,
    ``,
    `## 선택된 태그`,
    tags.map((t) => `- ${t}`).join('\n'),
    ``,
    `## 입력 파일`,
    `- 게임 제안서: ${outputDir}/proposal.md`,
    `- 사양 리뷰: ${outputDir}/specs/review-specs.md`,
    `- 사양 문서: ${outputDir}/specs/spec-*.md (모든 spec 파일)`,
    ``,
    `## 지시사항`,
    `1. game-implementer 스킬의 구현 절차(Phase A~I)를 순서대로 따르세요.`,
    `2. Phase A에서 모든 사양 파일을 먼저 읽고, 전체 아키텍처를 설계하세요.`,
    `3. Phase G(UI/HUD)에서는 frontend-design 스킬의 미학 원칙을 적용하세요.`,
    `4. spec에 정의된 수치, 타입, 상태 전이를 정확히 반영하세요.`,
    `5. 이전 Phase의 산출물(proposal.md, specs/, meta.json, .claude/)을 수정하지 마세요.`,
    `6. 모든 작업을 이 디렉토리(${outputDir}) 내에서 수행하세요.`,
    ``,
    `## 검증 (반드시 수행)`,
    ``,
    `구현을 마친 후 아래 검증을 모두 수행하세요:`,
    ``,
    `### 1단계: 빌드 검증`,
    `\`\`\`bash`,
    `npx tsc --noEmit`,
    `npm run build`,
    `\`\`\``,
    `두 명령 모두 에러 0개가 되어야 합니다. 에러가 있으면 수정하세요.`,
    ``,
    `### 2단계: 사양 준수 검증`,
    `각 spec-*.md 파일을 다시 읽고, 핵심 요구사항이 코드에 반영되었는지 하나씩 확인하세요:`,
    `- 각 spec의 **데이터 구조**(TypeScript 인터페이스)가 types.ts에 정의되어 있는가?`,
    `- 각 spec의 **수치 파라미터**가 constants.ts에 정확히 반영되어 있는가?`,
    `- 각 spec의 **상태 전이**가 코드에 구현되어 있는가?`,
    `- 각 spec의 **동작 흐름**이 코드에 구현되어 있는가?`,
    `- 각 spec의 **엣지 케이스 처리**가 포함되어 있는가?`,
    ``,
    `### 3단계: 완료 신호`,
    `**빌드 에러 0개 + 모든 사양 준수가 확인되었을 때만** 아래를 출력하세요:`,
    ``,
    `<promise>IMPLEMENTATION COMPLETE</promise>`,
    ``,
    `이 문장은 반드시 사실일 때만 출력하세요. 거짓으로 출력하지 마세요.`,
    `검증에 실패한 항목이 있으면, promise를 출력하지 말고 문제를 수정하세요.`,
  ].join('\n');
}

/** Phase 6 이터레이션에 사용할 최대 반복 횟수 */
const PHASE6_MAX_ITERATIONS = 10;

/** Phase 6 이터레이션 전체에 사용할 프로세스 타임아웃 (밀리초). 이터레이션 수 × 15분. */
const PHASE6_TIMEOUT = PHASE6_MAX_ITERATIONS * 15 * 60 * 1000;

/**
 * ralph-wiggum의 ralph-loop 상태 파일을 생성한다.
 *
 * 이 파일이 존재하면, ralph-wiggum 플러그인의 stop hook이
 * Claude 세션 종료를 차단하고 같은 프롬프트로 재실행한다.
 * <promise>COMPLETION_PROMISE</promise>가 출력되거나 maxIterations에 도달하면 종료.
 */
function createRalphLoopState(
  outputDir: string,
  prompt: string,
  maxIterations: number,
  completionPromise: string,
): void {
  const stateDir = resolve(outputDir, '.claude');
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }
  const statePath = resolve(stateDir, 'ralph-loop.local.md');
  const content = [
    '---',
    'active: true',
    'iteration: 1',
    `max_iterations: ${maxIterations}`,
    `completion_promise: "${completionPromise}"`,
    `started_at: "${new Date().toISOString()}"`,
    '---',
    '',
    prompt,
  ].join('\n');
  writeFileSync(statePath, content);
  console.log(`[Pipeline] ralph-loop 상태 파일 생성 (max ${maxIterations}회, promise: "${completionPromise}")`);
}

/**
 * ralph-loop 상태 파일을 정리한다.
 * 정상 종료 시 stop hook이 삭제하지만, 비정상 종료 시 잔여 파일을 제거한다.
 */
function cleanupRalphLoopState(outputDir: string): void {
  const statePath = resolve(outputDir, '.claude', 'ralph-loop.local.md');
  if (existsSync(statePath)) {
    const content = readFileSync(statePath, 'utf-8');
    const iterMatch = content.match(/^iteration:\s*(\d+)/m);
    const iteration = iterMatch ? iterMatch[1] : '?';
    console.log(`[Pipeline] ralph-loop 상태 파일 정리 (마지막 iteration: ${iteration})`);
    // 삭제하지 않음 — stop hook이 정상 종료 시 이미 삭제.
    // 비정상 종료(타임아웃 등)에만 잔여하며, 다음 실행에 영향 없도록 삭제.
    try {
      unlinkSync(statePath);
    } catch {
      // 무시
    }
  }
}

/**
 * 전체 파이프라인을 실행한다.
 *
 * Pre:     파이프라인 에셋 복사 (.claude/skills/, .claude/agents/)
 * Phase 1: Creative Director → proposal.md
 * Post-1:  GitHub 레포 생성 (git init → gh repo create → push)
 * Phase 2: Game Design Lead (가이드 작성) → guide-*.md → commit
 * Phase 3: Creative Director (리뷰) → review-guides.md + 가이드 수정 → commit
 * Phase 4: Game Design Lead (디스패치) → Game Designer(병렬) → spec-*.md → commit
 * Phase 5: Game Design Lead (사양 리뷰) → review-specs.md + spec 수정 → commit
 * Phase 6: Game Implementer → Vite + TypeScript 프로젝트 (ralph-loop 이터레이션) → commit + push
 */
export async function runPipeline(config: PipelineConfig = {}): Promise<PipelineResult> {
  const { minTags = 2, maxTags = 5, preSelectedTags } = config;
  let shouldCreateRepo = config.createRepo ?? true;
  const date = new Date().toISOString().split('T')[0];
  const result: PipelineResult = {
    success: false,
    date,
    tags: { count: 0, tags: [], tagNames: [] },
    outputDir: '',
    phases: {},
  };

  // Step 1: 태그 선택
  let tags: TagSelection;
  if (preSelectedTags && preSelectedTags.length > 0) {
    tags = {
      count: preSelectedTags.length,
      tags: preSelectedTags.map((name, i) => ({ id: i, name })),
      tagNames: preSelectedTags,
    };
  } else {
    tags = selectRandomTags(minTags, maxTags);
  }
  result.tags = tags;
  console.log(`[Pipeline] 선택된 태그 (${tags.count}개): ${tags.tagNames.join(', ')}`);

  // Step 2: 출력 디렉토리 생성
  const outputDir = createOutputDir(tags.tagNames);
  result.outputDir = outputDir;
  console.log(`[Pipeline] 출력 디렉토리: ${outputDir}`);

  // specs 디렉토리 생성
  const specsDir = resolve(outputDir, 'specs');
  if (!existsSync(specsDir)) {
    mkdirSync(specsDir, { recursive: true });
  }

  // 메타데이터 저장
  const meta: Record<string, unknown> = {
    date,
    tags: tags.tagNames,
    startedAt: new Date().toISOString(),
    phases: {
      creativeDirector: false,
      designLeadGuides: false,
      cdReview: false,
      designLeadDispatch: false,
      dlReview: false,
      implement: false,
    },
  };
  const metaPath = resolve(outputDir, 'meta.json');
  const saveMeta = () => writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  saveMeta();

  const phases = meta.phases as Record<string, boolean>;

  // Pre-Phase: 파이프라인 에셋 복사 (스킬/에이전트 정의) + CLAUDE.md 생성
  // Claude Code가 cwd의 .claude/ 디렉토리에서 스킬 정의를 참조할 수 있도록 먼저 복사한다.
  copyPipelineAssets(outputDir);
  generateGameClaudeMd(outputDir, tags.tagNames, date);

  // Phase 1: Creative Director → proposal.md
  console.log('[Pipeline] Phase 1: Creative Director 시작...');
  const cdPrompt = buildCreativeDirectorPrompt(tags.tagNames, outputDir);
  const cdResult = await invokeClaude({ prompt: cdPrompt, cwd: outputDir, maxTurns: 15 });

  result.phases.creativeDirector = { success: cdResult.success, error: cdResult.error };
  if (!cdResult.success) {
    result.error = `Phase 1 (Creative Director) 실패: ${cdResult.error}`;
    return result;
  }
  phases.creativeDirector = true;
  saveMeta();
  console.log('[Pipeline] Phase 1: Creative Director 완료 → proposal.md');

  // Post-Phase 1: GitHub 레포 생성 (게임 제목 기반)
  if (shouldCreateRepo) {
    console.log('[Pipeline] GitHub 레포지토리 생성 시작...');
    const gameTitle = extractGameTitle(outputDir);
    const repoName = slugifyForRepo(gameTitle);
    console.log(`[Pipeline] 게임 제목: "${gameTitle}" → 레포 이름: "${repoName}"`);

    const repoResult = await initGameRepo(outputDir, repoName, date);
    if (repoResult.success) {
      result.repoUrl = repoResult.repoUrl;
      meta.repoUrl = repoResult.repoUrl;
      saveMeta();
      console.log(`[Pipeline] GitHub 레포 생성 완료: ${repoResult.repoUrl}`);
    } else {
      // 레포 생성 실패 시 이후 커밋/푸시를 건너뛰고 로컬에서만 계속 진행
      console.warn(`[Pipeline] GitHub 레포 생성 실패 (로컬에서 계속 진행): ${repoResult.error}`);
      shouldCreateRepo = false;
    }
  }

  // Phase 2: Game Design Lead (가이드 작성) → design-plan.md, guide-*.md
  console.log('[Pipeline] Phase 2: Game Design Lead (가이드 작성) 시작...');
  const dlGuidesPrompt = buildDesignLeadGuidesPrompt(tags.tagNames, outputDir);
  const dlGuidesResult = await invokeClaude({ prompt: dlGuidesPrompt, cwd: outputDir, maxTurns: 20 });

  result.phases.designLeadGuides = { success: dlGuidesResult.success, error: dlGuidesResult.error };
  if (!dlGuidesResult.success) {
    result.error = `Phase 2 (Design Lead 가이드 작성) 실패: ${dlGuidesResult.error}`;
    return result;
  }
  phases.designLeadGuides = true;
  saveMeta();
  console.log('[Pipeline] Phase 2: Game Design Lead 완료 → specs/guide-*.md');

  if (shouldCreateRepo) {
    await commitPhase(outputDir, 'Phase 2', 'docs: Phase 2 - design guides');
  }

  // Phase 3: Creative Director (리뷰) → review-guides.md
  console.log('[Pipeline] Phase 3: Creative Director (가이드 리뷰) 시작...');
  const cdReviewPrompt = buildCdReviewPrompt(outputDir);
  const cdReviewResult = await invokeClaude({ prompt: cdReviewPrompt, cwd: outputDir, maxTurns: 15 });

  result.phases.cdReview = { success: cdReviewResult.success, error: cdReviewResult.error };
  if (!cdReviewResult.success) {
    result.error = `Phase 3 (CD 가이드 리뷰) 실패: ${cdReviewResult.error}`;
    return result;
  }
  phases.cdReview = true;
  saveMeta();
  console.log('[Pipeline] Phase 3: Creative Director 리뷰 완료 → specs/review-guides.md');

  if (shouldCreateRepo) {
    await commitPhase(outputDir, 'Phase 3', 'docs: Phase 3 - guide review & revisions');
  }

  // Phase 4: Game Design Lead (디스패치) → game-designer 병렬 호출 → spec-*.md
  console.log('[Pipeline] Phase 4: Game Design Lead (서브 에이전트 디스패치) 시작...');
  const dlDispatchPrompt = buildDesignLeadDispatchPrompt(outputDir);
  const dlDispatchResult = await invokeClaude({ prompt: dlDispatchPrompt, cwd: outputDir, maxTurns: 30 });

  result.phases.designLeadDispatch = { success: dlDispatchResult.success, error: dlDispatchResult.error };
  if (!dlDispatchResult.success) {
    result.error = `Phase 4 (Design Lead 디스패치) 실패: ${dlDispatchResult.error}`;
    return result;
  }
  phases.designLeadDispatch = true;
  saveMeta();
  console.log('[Pipeline] Phase 4: Game Design Lead 디스패치 완료 → specs/spec-*.md');

  if (shouldCreateRepo) {
    await commitPhase(outputDir, 'Phase 4', 'docs: Phase 4 - detailed specs');
  }

  // Phase 5: Game Design Lead (사양 리뷰) → review-specs.md
  console.log('[Pipeline] Phase 5: Game Design Lead (사양 리뷰) 시작...');
  const dlReviewPrompt = buildDlReviewPrompt(outputDir);
  const dlReviewResult = await invokeClaude({ prompt: dlReviewPrompt, cwd: outputDir, maxTurns: 20 });

  result.phases.dlReview = { success: dlReviewResult.success, error: dlReviewResult.error };
  if (!dlReviewResult.success) {
    result.error = `Phase 5 (Design Lead 사양 리뷰) 실패: ${dlReviewResult.error}`;
    return result;
  }
  phases.dlReview = true;
  saveMeta();
  console.log('[Pipeline] Phase 5: Game Design Lead 사양 리뷰 완료 → specs/review-specs.md');

  if (shouldCreateRepo) {
    await commitPhase(outputDir, 'Phase 5', 'docs: Phase 5 - spec review & revisions');
  }

  // Phase 6: Game Implementer → Vite + TypeScript 프로젝트 (ralph-wiggum 이터레이션)
  console.log('[Pipeline] Phase 6: Game Implementer 시작 (ralph-loop, max %d iterations)...', PHASE6_MAX_ITERATIONS);
  const implPrompt = buildImplementPrompt(tags.tagNames, outputDir);

  // ralph-loop 상태 파일 생성 → stop hook이 이터레이션 자동 관리
  createRalphLoopState(outputDir, implPrompt, PHASE6_MAX_ITERATIONS, 'IMPLEMENTATION COMPLETE');

  const implResult = await invokeClaude({
    prompt: implPrompt,
    cwd: outputDir,
    maxTurns: 50,
    timeout: PHASE6_TIMEOUT,
  });

  // 비정상 종료 시 잔여 상태 파일 정리
  cleanupRalphLoopState(outputDir);

  result.phases.implement = { success: implResult.success, error: implResult.error };
  if (!implResult.success) {
    result.error = `Phase 6 (Implementer) 실패: ${implResult.error}`;
    return result;
  }
  phases.implement = true;
  console.log('[Pipeline] Phase 6: Game Implementer 완료');

  if (shouldCreateRepo) {
    await commitPhase(outputDir, 'Phase 6', 'feat: Phase 6 - game implementation');
    await pushRepo(outputDir);
  }

  // 완료 메타데이터 업데이트
  meta.completedAt = new Date().toISOString();
  meta.success = true;
  saveMeta();

  result.success = true;
  return result;
}

// 직접 실행 시 파이프라인 실행
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain) {
  runPipeline()
    .then((r) => {
      console.log('\n[Pipeline] 결과:');
      console.log(JSON.stringify({
        success: r.success,
        date: r.date,
        tags: r.tags.tagNames,
        outputDir: r.outputDir,
        phases: r.phases,
        repoUrl: r.repoUrl,
        error: r.error,
      }, null, 2));
    })
    .catch((err) => {
      console.error('[Pipeline] 치명적 오류:', err);
      process.exit(1);
    });
}
