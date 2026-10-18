import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VERDICTS } from '../api/types';
import { VerdictMark } from './VerdictMark';
import { MockApi } from '../api/mockApi';
import { GatekeeperProvider } from '../store/useGatekeeperStore';
import { VerdictCard } from './VerdictCard';

describe('verdict labels and icons', () => {
  it('renders a distinct plain-language label and icon for all six verdicts', () => {
    const rendered = VERDICTS.map((verdict) => renderToStaticMarkup(<VerdictMark verdict={verdict} />));
    const labels = rendered.map((markup) => markup.match(/<span>(.*?)<\/span>/)?.[1]);
    const icons = rendered.map((markup) => markup.match(/class="lucide lucide-([^\s"]+)/)?.[1]);

    expect(labels).toEqual([
      'Blocked',
      'Approval needed',
      'Reason is stale',
      'History shown, see evidence',
      'Nothing recorded covers this. Not safe.',
      'Target not found',
    ]);
    expect(new Set(icons).size).toBe(6);
    expect(icons.every(Boolean)).toBe(true);
  });

  it('renders UNKNOWN_TARGET as a verdict card with a clear label', async () => {
    const result = await new MockApi().check({ target: 'file:missing.ts', action: 'delete', depth: 6 });
    const markup = renderToStaticMarkup(<GatekeeperProvider><VerdictCard result={result} ripple={0} onDecisionClick={() => undefined} /></GatekeeperProvider>);
    expect(markup).toContain('UNKNOWN_TARGET');
    expect(markup).toContain('Target not found');
    expect(markup).toContain('This target name does not resolve');
  });
});
