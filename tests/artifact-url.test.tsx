import { expect, test } from 'vitest';
import { artifactDownloadUrl } from '@/lib/api';

test('log artifacts use the authenticated query route while other artifacts keep their path', () => {
  expect(artifactDownloadUrl('/api/backend', 'my-run', 'logs/train.log')).toBe('/api/backend/api/runs/my-run/files?path=logs%2Ftrain.log');
  expect(artifactDownloadUrl('/api/backend', 'my-run', 'best.pt')).toBe('/api/backend/api/runs/my-run/files/best.pt');
});
