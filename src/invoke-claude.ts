import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface ClaudeInvokeOptions {
  /** Claude Code에 전달할 프롬프트 */
  prompt: string;
  /** 작업 디렉토리 (생성된 게임 프로젝트 경로) */
  cwd: string;
  /** 최대 에이전트 턴 수 (기본 30) */
  maxTurns?: number;
  /** 사용할 모델 (기본: 설정에 따름) */
  model?: string;
  /** 프로세스 타임아웃 (밀리초, 기본 10분) */
  timeout?: number;
}

export interface ClaudeInvokeResult {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * Claude Code CLI를 비대화형 모드로 실행한다.
 *
 * claude -p "<prompt>" --output-format json --max-turns <n>
 */
export async function invokeClaude(options: ClaudeInvokeOptions): Promise<ClaudeInvokeResult> {
  const { prompt, cwd, maxTurns = 30, model, timeout = 10 * 60 * 1000 } = options;

  const args = [
    '-p', prompt,
    '--output-format', 'json',
    '--max-turns', String(maxTurns),
  ];

  if (model) {
    args.push('--model', model);
  }

  try {
    const { stdout, stderr } = await execFileAsync('claude', args, {
      cwd,
      maxBuffer: 50 * 1024 * 1024, // 50MB (이터레이션 시 출력 증가)
      timeout,
      shell: true,
    });

    return {
      success: true,
      output: stdout,
      error: stderr || undefined,
    };
  } catch (err: unknown) {
    const error = err as Error & { stdout?: string; stderr?: string };
    return {
      success: false,
      output: error.stdout ?? '',
      error: error.message,
    };
  }
}
