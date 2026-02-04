import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface SteamTag {
  id: number;
  name: string;
}

interface TagData {
  meta: { description: string; source: string; lastUpdated: string; totalCount: number };
  tags: SteamTag[];
}

/**
 * Steam 태그 목록을 로드한다.
 */
export function loadTags(): SteamTag[] {
  const filePath = resolve(__dirname, '..', 'data', 'steam-tags.json');
  const raw = readFileSync(filePath, 'utf-8');
  const data: TagData = JSON.parse(raw);
  return data.tags;
}

/**
 * min~max 사이의 랜덤 정수를 반환한다. (양 끝 포함)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 배열에서 중복 없이 n개의 요소를 무작위로 선택한다. (Fisher-Yates 셔플 부분 적용)
 */
function sampleWithoutReplacement<T>(array: T[], n: number): T[] {
  const copy = [...array];
  const result: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = randomInt(0, copy.length - 1);
    result.push(copy[idx]);
    copy[idx] = copy[copy.length - 1];
    copy.pop();
  }
  return result;
}

export interface TagSelection {
  count: number;
  tags: SteamTag[];
  tagNames: string[];
}

/**
 * Steam 태그에서 랜덤으로 N개를 선택한다.
 * @param minCount 최소 태그 수 (기본 2)
 * @param maxCount 최대 태그 수 (기본 5)
 */
export function selectRandomTags(minCount = 2, maxCount = 5): TagSelection {
  const allTags = loadTags();
  const count = randomInt(minCount, maxCount);
  const selected = sampleWithoutReplacement(allTags, count);

  return {
    count,
    tags: selected,
    tagNames: selected.map((t) => t.name),
  };
}

// 직접 실행 시 태그 선택 결과 출력
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const result = selectRandomTags();
  console.log(JSON.stringify(result, null, 2));
}
