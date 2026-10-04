import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { ModelTestDialog } from '@/components/tasks/model-test-dialog';

type SelectorProps = ComponentProps<typeof import('@/components/tasks/execution-selector').ExecutionSelector>;
vi.mock('@/components/language-provider', () => ({ useLanguage: () => ({ language: 'en', t: (key: string) => key }) }));
vi.mock('@/lib/api', () => ({ apiBaseUrl: () => '' }));
vi.mock('@/components/tasks/execution-selector', () => ({
  ExecutionSelector: ({ value, onChange, disabled }: SelectorProps) => <select aria-label="Device" value={value.mode} disabled={disabled} onChange={(e) => onChange({ mode: e.target.value as 'auto' | 'cpu' })}>
    <option value="auto">Auto GPU</option><option value="cpu">CPU</option>
  </select>,
}));

const fetchMock = vi.fn<typeof fetch>();
const response = (body: unknown) => new Response(JSON.stringify(body));
function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
}
const oldJob = { id: 'previous-job', status: 'cancelled', requestedExecution: { mode: 'auto' } };
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('URL', class extends URL { static createObjectURL = () => 'blob:new-image'; static revokeObjectURL = vi.fn(); });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('late history restores the job but does not replace a user-selected device', async () => {
  const pending = deferred();
  fetchMock.mockReturnValueOnce(pending.promise).mockResolvedValue(response(oldJob));
  render(<ModelTestDialog open onOpenChange={() => {}} runSlug="run" />);
  fireEvent.change(screen.getByLabelText('Device'), { target: { value: 'cpu' } });
  await act(async () => { pending.resolve(response({ job: oldJob })); });
  expect((screen.getByLabelText('Device') as HTMLSelectElement).value).toBe('cpu');
  expect(screen.getByAltText('preview').getAttribute('src')).toContain('previous-job/input');
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
});

test('untouched device selection is restored normally', async () => {
  const cpuJob = { ...oldJob, requestedExecution: { mode: 'cpu' } };
  fetchMock.mockResolvedValueOnce(response({ job: cpuJob })).mockResolvedValue(response(cpuJob));
  render(<ModelTestDialog open onOpenChange={() => {}} runSlug="run" />);
  await waitFor(() => expect((screen.getByLabelText('Device') as HTMLSelectElement).value).toBe('cpu'));
});

test('choosing a new image rejects delayed history entirely', async () => {
  const pending = deferred();
  fetchMock.mockReturnValueOnce(pending.promise);
  render(<ModelTestDialog open onOpenChange={() => {}} runSlug="run" />);
  fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [new File(['image'], 'new.png', { type: 'image/png' })] } });
  fireEvent.change(screen.getByLabelText('Device'), { target: { value: 'cpu' } });
  await act(async () => { pending.resolve(response({ job: oldJob })); });
  expect(screen.getByAltText('new.png').getAttribute('src')).toBe('blob:new-image');
  expect((screen.getByLabelText('Device') as HTMLSelectElement).value).toBe('cpu');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('reopening resets the edit guard and restores that run device', async () => {
  fetchMock.mockResolvedValueOnce(response({ job: null }));
  const view = render(<ModelTestDialog open onOpenChange={() => {}} runSlug="run" />);
  await act(async () => {});
  fireEvent.change(screen.getByLabelText('Device'), { target: { value: 'cpu' } });
  view.rerender(<ModelTestDialog open={false} onOpenChange={() => {}} runSlug="run" />);
  fetchMock.mockResolvedValueOnce(response({ job: oldJob })).mockResolvedValue(response(oldJob));
  view.rerender(<ModelTestDialog open onOpenChange={() => {}} runSlug="run" />);
  await waitFor(() => expect((screen.getByLabelText('Device') as HTMLSelectElement).value).toBe('auto'));
});
