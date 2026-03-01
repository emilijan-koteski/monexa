export interface ComparisonResult {
  percentage: number | null;
  direction: 'up' | 'down' | 'flat';
  sentiment: 'good' | 'bad' | 'neutral';
}
