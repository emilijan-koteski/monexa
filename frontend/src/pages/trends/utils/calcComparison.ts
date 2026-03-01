import { CategoryType } from '../../../enums/CategoryType';
import { type ComparisonResult } from '../types/ComparisonResult';

export function calcComparison(selectedAmount: number, comparisonAmount: number, activeType: CategoryType): ComparisonResult {
  if (comparisonAmount === 0) {
    return { percentage: null, direction: 'flat', sentiment: 'neutral' };
  }

  const raw = ((selectedAmount - comparisonAmount) / Math.abs(comparisonAmount)) * 100;
  const direction = raw > 0 ? 'up' : raw < 0 ? 'down' : 'flat';

  let sentiment: 'good' | 'bad' | 'neutral';
  if (direction === 'flat') {
    sentiment = 'neutral';
  } else if (activeType === CategoryType.EXPENSE) {
    sentiment = direction === 'up' ? 'bad' : 'good';
  } else {
    sentiment = direction === 'up' ? 'good' : 'bad';
  }

  return { percentage: Math.abs(raw), direction, sentiment };
}
