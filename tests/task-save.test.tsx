import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ComponentProps, ReactNode } from 'react';
import { defaultConfig, type TrainingTask } from '@/lib/trainingConfig';
import TaskDetailPage from '@/app/tasks/[taskId]/page';

type ConfigurationProps = ComponentProps<typeof import('@/components/tasks/task-configuration').TaskConfiguration>;
const state = vi.hoisted(() => ({ taskId: 'draft-id', configuration: null as ConfigurationProps | null, push: vi.fn() }));
vi.mock('next/navigation', () => ({ useParams: () => ({ taskId: state.taskId }), useRouter: () => ({ push: state.push }) }));
vi.mock('@/components/MainLayout', () => ({ MainLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/language-provider', () => ({ useLanguage: () => ({ language: 'en', t: (key: string) => key }) }));
vi.mock('@/components/tasks/task-run', () => ({ TaskRun: () => <div>Run</div> }));
vi.mock('@/lib/api', () => ({ apiBaseUrl: () => '' }));
vi.mock('@/components/tasks/task-configuration', () => ({
  TaskConfiguration: (props: ConfigurationProps) => {
    state.configuration = props;
    return <div>
      <input aria-label="Epochs" value={props.config.epochs} onChange={(e) => props.onChange({ ...props.config, epochs: Number(e.target.value) })} />
      <span data-testid="save-state">{props.saveState}</span>
      <button onClick={() => void props.onSave().catch(() => undefined)} disabled={props.saveState === 'saving'}>Save</button>
    </div>;
  },
}));

const draft: TrainingTask = { ...defaultConfig, id: 'draft-id', status: 'draft', displayName: 'Example', epochs: 10 };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
}
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  state.taskId = 'draft-id';
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

test('edits during Save stay unsaved and cannot train until the latest values are saved', async () => {
  const pending = deferred();
  fetchMock.mockResolvedValueOnce(response(draft)).mockReturnValueOnce(pending.promise);
  render(<TaskDetailPage />);
  await screen.findByLabelText('Epochs');
  fireEvent.click(screen.getByText('Save'));
  fireEvent.change(screen.getByLabelText('Epochs'), { target: { value: '20' } });
  expect(screen.getByTestId('save-state').textContent).toBe('saving');
  await act(async () => { pending.resolve(response(draft)); });
  expect(screen.getByTestId('save-state').textContent).toBe('unsaved');
  expect((screen.getByLabelText('Epochs') as HTMLInputElement).value).toBe('20');
  const leave = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(leave);
  expect(leave.defaultPrevented).toBe(true);
  await act(async () => { state.configuration!.onTrain(); });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  fetchMock.mockResolvedValueOnce(response({ ...draft, epochs: 20 }));
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => expect(screen.getByTestId('save-state').textContent).toBe('saved'));
  expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body)).epochs).toBe(20);
  fetchMock.mockResolvedValueOnce(response({})).mockResolvedValueOnce(response({ ...draft, status: 'queued' }));
  await act(async () => { state.configuration!.onTrain(); });
  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/start'))).toBe(true);
});

test('overlapping saves create only one new draft and do not navigate away from newer edits', async () => {
  state.taskId = 'new';
  const create = deferred();
  const patch = deferred();
  fetchMock.mockReturnValueOnce(create.promise).mockReturnValueOnce(patch.promise);
  const replace = vi.spyOn(window.history, 'replaceState');
  render(<TaskDetailPage />);
  let saving!: Promise<void>;
  act(() => { saving = state.configuration!.onSave(); void state.configuration!.onSave(); });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText('Epochs'), { target: { value: '20' } });
  await act(async () => { create.resolve(response({ id: 'draft-id' })); });
  await act(async () => { patch.resolve(response(draft)); await saving; });
  expect(screen.getByTestId('save-state').textContent).toBe('unsaved');
  expect(replace).not.toHaveBeenCalled();
  fetchMock.mockResolvedValueOnce(response({ ...draft, epochs: 20 }));
  await act(async () => { await state.configuration!.onSave(); });
  expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  expect(replace.mock.calls[0].slice(1)).toEqual(['', '/tasks/draft-id']);
});

test('failed saves retain the unsaved warning', async () => {
  fetchMock.mockResolvedValueOnce(response(draft)).mockResolvedValueOnce(response({ detail: 'Unavailable' }, 503));
  render(<TaskDetailPage />);
  await screen.findByLabelText('Epochs');
  fireEvent.change(screen.getByLabelText('Epochs'), { target: { value: '20' } });
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => expect(screen.getByTestId('save-state').textContent).toBe('error'));
  const leave = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(leave);
  expect(leave.defaultPrevented).toBe(true);
});

test('leaving a draft aborts its pending response', async () => {
  const pending = deferred();
  fetchMock.mockResolvedValueOnce(response(draft)).mockReturnValueOnce(pending.promise);
  const view = render(<TaskDetailPage />);
  await screen.findByLabelText('Epochs');
  fireEvent.click(screen.getByText('Save'));
  const signal = fetchMock.mock.calls[1][1]?.signal;
  view.unmount();
  expect(signal?.aborted).toBe(true);
  await act(async () => { pending.resolve(response(draft)); });
});
