import express from 'express';
import { runPipeline, type PipelineConfig, type PipelineResult } from './pipeline.js';

const PORT = parseInt(process.env.PORT ?? '3847', 10);
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? '';

const app = express();
app.use(express.json());

/**
 * Webhook 인증 미들웨어.
 * WEBHOOK_SECRET 환경 변수가 설정된 경우, Authorization 헤더를 검증한다.
 */
function authMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  if (!WEBHOOK_SECRET) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

app.use(authMiddleware);

// 현재 실행 중인 파이프라인 추적
let isRunning = false;
let lastResult: PipelineResult | null = null;

/**
 * POST /webhook/run
 *
 * n8n Cloud에서 호출하는 메인 엔드포인트.
 * 파이프라인을 시작하고 즉시 202 응답을 반환한다. (비동기 실행)
 *
 * Body (선택적):
 *   { "tags": ["Roguelike", "Cooking", "Pixel Graphics"], "minTags": 2, "maxTags": 5 }
 */
app.post('/webhook/run', (req, res) => {
  if (isRunning) {
    res.status(409).json({
      error: 'Pipeline already running',
      lastResult: lastResult ? { date: lastResult.date, tags: lastResult.tags.tagNames } : null,
    });
    return;
  }

  const body = req.body as { tags?: string[]; minTags?: number; maxTags?: number; createRepo?: boolean };

  const config: PipelineConfig = {
    minTags: body.minTags ?? 2,
    maxTags: body.maxTags ?? 5,
    preSelectedTags: body.tags,
    createRepo: body.createRepo ?? true,
  };

  isRunning = true;
  console.log(`[Server] 파이프라인 시작 요청 수신: ${JSON.stringify(body)}`);

  // 비동기로 파이프라인 실행 (요청에 대한 응답은 즉시 반환)
  runPipeline(config)
    .then((result) => {
      lastResult = result;
      console.log(`[Server] 파이프라인 완료: success=${result.success}`);
    })
    .catch((err) => {
      console.error('[Server] 파이프라인 오류:', err);
      lastResult = {
        success: false,
        date: new Date().toISOString().split('T')[0],
        tags: { count: 0, tags: [], tagNames: [] },
        outputDir: '',
        phases: {},
        error: String(err),
      };
    })
    .finally(() => {
      isRunning = false;
    });

  res.status(202).json({
    message: 'Pipeline started',
    tags: config.preSelectedTags ?? 'random',
  });
});

/**
 * GET /status
 *
 * 현재 파이프라인 상태를 반환한다.
 */
app.get('/status', (_req, res) => {
  res.json({
    isRunning,
    lastResult: lastResult
      ? {
          success: lastResult.success,
          date: lastResult.date,
          tags: lastResult.tags.tagNames,
          outputDir: lastResult.outputDir,
          repoUrl: lastResult.repoUrl,
          error: lastResult.error,
        }
      : null,
  });
});

/**
 * GET /health
 *
 * 헬스 체크 엔드포인트.
 */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[Server] Steam Tag Mixer webhook server running on port ${PORT}`);
  console.log(`[Server] POST /webhook/run  - 파이프라인 실행`);
  console.log(`[Server] GET  /status       - 상태 확인`);
  console.log(`[Server] GET  /health       - 헬스 체크`);
});
