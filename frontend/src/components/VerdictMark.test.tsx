import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VERDICTS } from '../api/types';
import { VerdictMark } from './VerdictMark';

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
});
