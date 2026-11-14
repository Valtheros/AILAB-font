import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Images } from 'lucide-react';
import { LoadingState } from '@/components/workspace/loading-state';

afterEach(cleanup);

test('keeps progress indeterminate until the total is known', () => {
  render(<LoadingState icon={Images} title="Preparing images" progress={{ current: 0, total: 0, unit: 'images' }} />);
  expect(screen.getByRole('status').textContent).toContain('Preparing images');
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBeNull();
  expect(screen.queryByText(/0 \/ 0/)).toBeNull();
});

test('shows accessible progress and skipped images when available', () => {
  render(<LoadingState icon={Images} title="Preparing images" progress={{ current: 25, total: 100, unit: 'images', skipped: 2, skippedLabel: 'Skipped' }} />);
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('25');
  expect(screen.getByText('25 / 100 images')).toBeTruthy();
  expect(screen.getByText('Skipped: 2')).toBeTruthy();
});

test('clamps progress to the valid range', () => {
  render(<LoadingState icon={Images} title="Preparing images" progress={{ current: 150, total: 100, unit: 'images' }} />);
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  expect(screen.getByText('100 / 100 images')).toBeTruthy();
});
