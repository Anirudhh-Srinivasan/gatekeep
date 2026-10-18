import type { GraphResponse, LoadBearingItem } from '../api/types';

export function filterLoadBearingItems(items: LoadBearingItem[], graph: GraphResponse | null): LoadBearingItem[] {
  const dependentDecisionIds = new Set(
    (graph?.edges ?? [])
      .filter((edge) => edge.type === 'DEPENDS_ON')
      .map((edge) => edge.target),
  );
  return items.filter((item) => item.score > 0 && dependentDecisionIds.has(item.id));
}
