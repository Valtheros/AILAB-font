import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import DatasetPage from '@/app/dataset/page';
import { translate } from '@/lib/i18n';

vi.mock('@/components/MainLayout', () => ({ MainLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/components/language-provider', () => ({ useLanguage: () => ({ language: 'th', t: (key: string) => translate('th', key) }) }));

class MockUpload extends EventTarget {}
class MockRequest extends EventTarget {
  static request: MockRequest;
  upload = new MockUpload();
  status = 200;
  responseText = '';
  constructor() { super(); MockRequest.request = this; }
  open() {}
  send() {}
  abort() {}
}

beforeEach(() => {
  vi.stubGlobal('XMLHttpRequest', MockRequest);
  vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
    if (input.endsWith('/api/datasets/import')) {
      return { ok: true, text: async () => JSON.stringify({ dataset_name: 'pictures-v2', tasks: [] }), body: init?.body };
    }
    return { ok: true, json: async () => ({ datasets: [{ id: 'old', name: 'pictures-v1', collectionId: 'collection-1', collectionName: 'pictures', version: 1, images: 1, classes: [], formats: [], tasks: [], createdAt: '', size: '1 KB' }] }) };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('a matching dataset is offered as a new version and submitted explicitly', async () => {
  render(<DatasetPage />);
  await screen.findByText('pictures · v1');
  const input = document.querySelector('input[type="file"]');
  if (!input) throw new Error('File input missing');
  fireEvent.change(input, { target: { files: [new File(['zip'], 'pictures.zip')] } });
  act(() => {
    MockRequest.request.responseText = JSON.stringify({ dataset_name: 'pictures', uploadToken: 'token', profile: {
      source_format: 'coco', canonical_task: 'detection', normalized_formats: [], image_count: 1, classes: [],
    } });
    MockRequest.request.dispatchEvent(new Event('load'));
    MockRequest.request.dispatchEvent(new Event('loadend'));
  });
  const choice = await screen.findByLabelText('บันทึกเป็น') as HTMLSelectElement;
  expect(choice.value).toBe('collection-1');
  fireEvent.click(screen.getByRole('button', { name: 'Import dataset' }));
  await waitFor(() => {
    const calls = vi.mocked(fetch).mock.calls;
    const request = calls.find(([url]) => String(url).endsWith('/api/datasets/import'));
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({ uploadToken: 'token', collectionId: 'collection-1' });
  });
});
