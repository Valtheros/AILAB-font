import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import DatasetPage from '@/app/dataset/page';
import { translate } from '@/lib/i18n';

vi.mock('@/components/MainLayout', () => ({ MainLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/components/language-provider', () => ({ useLanguage: () => ({ t: (key: string) => translate('th', key) }) }));

class MockUpload extends EventTarget {}
class MockRequest extends EventTarget {
  static requests: MockRequest[] = [];
  upload = new MockUpload();
  readyState = 0;
  status = 0;
  responseText = '';
  aborted = false;
  constructor() { super(); MockRequest.requests.push(this); }
  open() {}
  send() {}
  abort() {
    this.aborted = true;
    this.dispatchEvent(new Event('abort'));
    this.dispatchEvent(new Event('loadend'));
  }
  failNetwork() {
    this.dispatchEvent(new Event('error'));
    this.dispatchEvent(new Event('loadend'));
  }
}

beforeEach(() => {
  MockRequest.requests = [];
  vi.stubGlobal('XMLHttpRequest', MockRequest);
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ datasets: [] }) })));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

function selectZip(file = new File(['zip'], 'dataset.zip', { type: 'application/zip' })) {
  const input = document.querySelector('input[type="file"]');
  if (!input) throw new Error('File input missing');
  fireEvent.change(input, { target: { files: [file] } });
}

test('reports a proxy 413 and allows a new file to be selected', async () => {
  render(<DatasetPage />);
  selectZip();
  const request = MockRequest.requests[0];
  act(() => { request.status = 413; request.readyState = 2; request.dispatchEvent(new Event('readystatechange')); });
  expect(await screen.findByText(/ไฟล์มีขนาดเกินขีดจำกัดการอัปโหลด/)).toBeTruthy();
  expect(request.aborted).toBe(true);
  expect(screen.getByRole('button', { name: 'เลือกไฟล์ ZIP อีกครั้ง' })).toBeTruthy();
  selectZip();
  expect(MockRequest.requests).toHaveLength(2);
});

test('explains a dropped connection and rejects files above the application limit before upload', async () => {
  render(<DatasetPage />);
  selectZip();
  act(() => MockRequest.requests[0].failNetwork());
  expect(await screen.findByText(/การเชื่อมต่อระหว่างอัปโหลดขัดข้อง/)).toBeTruthy();
  const largeFile = new File(['zip'], 'large.zip');
  Object.defineProperty(largeFile, 'size', { value: 2 * 1024 ** 3 + 1 });
  selectZip(largeFile);
  expect(screen.getByText(/ไฟล์ ZIP มีขนาดเกิน 2 GiB/)).toBeTruthy();
  expect(MockRequest.requests).toHaveLength(1);
});

test('stops a stalled transfer, but resets the timer when progress is made', async () => {
  render(<DatasetPage />);
  await waitFor(() => expect(screen.queryByText('Loading datasets...')).toBeNull());
  vi.useFakeTimers();
  selectZip();
  const request = MockRequest.requests[0];
  act(() => { vi.advanceTimersByTime(40_000); });
  act(() => request.upload.dispatchEvent(new ProgressEvent('progress', { lengthComputable: true, loaded: 1, total: 10 })));
  act(() => { vi.advanceTimersByTime(40_000); });
  expect(request.aborted).toBe(false);
  act(() => request.upload.dispatchEvent(new ProgressEvent('progress', { lengthComputable: true, loaded: 1, total: 10 })));
  act(() => { vi.advanceTimersByTime(20_000); });
  expect(request.aborted).toBe(true);
  vi.useRealTimers();
  expect(await screen.findByText(/ไม่มีความคืบหน้าเป็นเวลา 60 วินาที/)).toBeTruthy();
});

test('allows a long inspection after upload and shows the import preview on success', async () => {
  render(<DatasetPage />);
  await waitFor(() => expect(screen.queryByText('Loading datasets...')).toBeNull());
  vi.useFakeTimers();
  selectZip();
  const request = MockRequest.requests[0];
  act(() => request.upload.dispatchEvent(new Event('load')));
  act(() => { vi.advanceTimersByTime(120_000); });
  expect(request.aborted).toBe(false);
  act(() => {
    request.status = 200;
    request.responseText = JSON.stringify({ dataset_name: 'test-dataset', uploadToken: 'test-token', profile: {
      source_format: 'coco', canonical_task: 'detection', normalized_formats: [], image_count: 1, classes: ['item'],
    } });
    request.dispatchEvent(new Event('load'));
    request.dispatchEvent(new Event('loadend'));
  });
  vi.useRealTimers();
  expect(await screen.findByRole('button', { name: 'Import dataset' })).toBeTruthy();
});

test('allows cancellation during upload and does not start a second upload on drop', async () => {
  const { container } = render(<DatasetPage />);
  selectZip();
  const request = MockRequest.requests[0];
  const dropZone = container.querySelector('.border-dashed');
  if (!dropZone) throw new Error('Drop zone missing');
  fireEvent.drop(dropZone, { dataTransfer: { files: [new File(['zip'], 'other.zip')] } });
  expect(MockRequest.requests).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'ยกเลิกการอัปโหลด' }));
  await waitFor(() => expect(screen.getByText(/ยกเลิกการอัปโหลดแล้ว/)).toBeTruthy());
  expect(request.aborted).toBe(true);
});

test('handles a 413 HTML response even when no header event was observed', async () => {
  render(<DatasetPage />);
  selectZip();
  const request = MockRequest.requests[0];
  act(() => {
    request.status = 413;
    request.responseText = '<html>Request Entity Too Large</html>';
    request.dispatchEvent(new Event('load'));
    request.dispatchEvent(new Event('loadend'));
  });
  expect(await screen.findByText(/ไฟล์มีขนาดเกินขีดจำกัดการอัปโหลด/)).toBeTruthy();
});
