import { expect, test } from 'vitest';
import { computeMessage, executionReadiness, initialComputeAvailability, type ComputeAvailability } from '@/lib/compute';

test('device readiness distinguishes offline workers, busy GPUs, CPU and coordinator failure', () => {
  const gpu = { uuid: 'gpu-1', name: 'GPU', totalMb: 12000, freeMb: 10000, status: 'ready', utilization: 0, temperature: 30, draining: false };
  const state: ComputeAvailability = { status: 'ready', devices: [gpu], cpuAvailable: true, coordinatorAvailable: true };
  expect(executionReadiness({ mode: 'auto' }, initialComputeAvailability)).toBe('loading');
  expect(executionReadiness({ mode: 'auto' }, state)).toBe('ready');
  expect(executionReadiness({ mode: 'gpu', gpuUuid: 'gpu-1' }, { ...state, devices: [{ ...gpu, status: 'busy' }] })).toBe('busy');
  expect(executionReadiness({ mode: 'gpu', gpuUuid: 'missing' }, state)).toBe('offline');
  expect(executionReadiness({ mode: 'cpu' }, { ...state, cpuAvailable: false })).toBe('offline');
  expect(executionReadiness({ mode: 'cpu' }, { ...state, coordinatorAvailable: false })).toBe('offline');
  expect(executionReadiness({ mode: 'auto' }, { ...state, status: 'error' })).toBe('unavailable');
});

test('invalid batch errors explain the limits in both languages', () => {
  expect(computeMessage('INVALID_BATCH', true)).toContain('ชุดภาพหรือ ZIP ไม่ถูกต้อง');
  expect(computeMessage('INVALID_BATCH', false)).toContain('100 images');
});
