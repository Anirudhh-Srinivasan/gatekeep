import { describe, expect, it } from 'vitest';
import { ApiError, mapApiError } from './client';

describe('FastAPI error mapping', () => {
  it('maps structured detail code and message', () => {
    const error = mapApiError({ detail: { code: 'UNKNOWN_TARGET', message: 'target is not present' } }, 422);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'UNKNOWN_TARGET', message: 'target is not present', status: 422 });
  });

  it('maps plain detail and malformed bodies to useful fallbacks', () => {
    expect(mapApiError({ detail: 'Invalid request' }, 400)).toMatchObject({ code: 'HTTP_400', message: 'Invalid request' });
    expect(mapApiError(undefined, 503)).toMatchObject({ code: 'HTTP_503', message: 'Gatekeeper API returned 503' });
  });
});
