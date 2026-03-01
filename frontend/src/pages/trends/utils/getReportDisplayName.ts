import type { TrendReport } from '../../../types/models';

export function getReportDisplayName(report: TrendReport): string {
  if (report.title) return report.title;
  return report.categories.map(c => c.name).join(', ');
}
