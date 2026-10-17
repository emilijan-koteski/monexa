import type { RouteKey } from "./definition.js";

export interface ExcludedRoute {
  route: RouteKey;
  reason: string;
}

const OAUTH_PROTOCOL = "OAuth protocol endpoint used by apps to connect, not a user action.";
const APP_AUTHENTICATION = "Sign-in and session management of the Monexa app; connected apps authenticate with OAuth.";
const ACCOUNT_SECURITY = "Account security; only available in the Monexa app.";
const CONSENT = "OAuth consent screen; only the user may approve or deny an app in the Monexa app.";
const LEGAL_DOCUMENTS = "Legal documents are reviewed and accepted in the Monexa app.";
const LEGAL_DOCUMENT_HASHING = "Integrity tooling for publishing legal documents; not user data.";
const INFRASTRUCTURE = "Infrastructure health check.";
const TREND_REPORT_EDITING = "Creating and editing trend reports is planned for a minor release.";

export const excludedRoutes: readonly ExcludedRoute[] = [
  { route: "GET /.well-known/oauth-authorization-server", reason: OAUTH_PROTOCOL },
  { route: "GET /api/v1/access-tokens", reason: ACCOUNT_SECURITY },
  { route: "POST /api/v1/access-tokens", reason: ACCOUNT_SECURITY },
  { route: "DELETE /api/v1/access-tokens/:id", reason: ACCOUNT_SECURITY },
  { route: "DELETE /api/v1/auth/accounts", reason: ACCOUNT_SECURITY },
  { route: "POST /api/v1/auth/change-password", reason: ACCOUNT_SECURITY },
  { route: "POST /api/v1/auth/forgot-password", reason: APP_AUTHENTICATION },
  { route: "POST /api/v1/auth/login", reason: APP_AUTHENTICATION },
  { route: "POST /api/v1/auth/logout", reason: APP_AUTHENTICATION },
  { route: "POST /api/v1/auth/register", reason: APP_AUTHENTICATION },
  { route: "POST /api/v1/auth/reset-password", reason: APP_AUTHENTICATION },
  { route: "POST /api/v1/auth/sessions/revoke", reason: APP_AUTHENTICATION },
  { route: "POST /api/v1/auth/tokens/renew", reason: APP_AUTHENTICATION },
  { route: "GET /api/v1/categories/:id", reason: "list_categories returns the same data." },
  { route: "GET /api/v1/health", reason: INFRASTRUCTURE },
  { route: "GET /api/v1/health/restricted", reason: INFRASTRUCTURE },
  { route: "GET /api/v1/legal-documents", reason: LEGAL_DOCUMENTS },
  { route: "POST /api/v1/legal-documents/:id/accept", reason: LEGAL_DOCUMENTS },
  { route: "POST /api/v1/legal-documents/hash/compute", reason: LEGAL_DOCUMENT_HASHING },
  { route: "POST /api/v1/legal-documents/hash/verify", reason: LEGAL_DOCUMENT_HASHING },
  { route: "GET /api/v1/legal-documents/pending", reason: LEGAL_DOCUMENTS },
  { route: "GET /api/v1/oauth/authorizations/:id", reason: CONSENT },
  { route: "POST /api/v1/oauth/authorizations/:id/approve", reason: CONSENT },
  { route: "POST /api/v1/oauth/authorizations/:id/deny", reason: CONSENT },
  { route: "GET /api/v1/oauth/grants", reason: ACCOUNT_SECURITY },
  { route: "DELETE /api/v1/oauth/grants/:id", reason: ACCOUNT_SECURITY },
  { route: "GET /api/v1/payment-methods/:id", reason: "list_payment_methods returns the same data." },
  { route: "GET /api/v1/records/descriptions/suggestions", reason: "UI autocomplete helper." },
  { route: "GET /api/v1/records/summary", reason: "get_spending_summary covers totals." },
  { route: "GET /api/v1/recurring-expenses/:id", reason: "list_recurring_expenses returns the same data." },
  { route: "POST /api/v1/trend-reports", reason: TREND_REPORT_EDITING },
  { route: "DELETE /api/v1/trend-reports/:id", reason: TREND_REPORT_EDITING },
  { route: "GET /api/v1/trend-reports/:id", reason: "list_trend_reports returns the same data." },
  { route: "PATCH /api/v1/trend-reports/:id", reason: TREND_REPORT_EDITING },
  { route: "PATCH /api/v1/users", reason: "Profile changes are made in the Monexa app." },
  { route: "GET /api/v1/users/data/export", reason: "Data export produces a downloadable file in the Monexa app." },
  { route: "GET /healthz", reason: INFRASTRUCTURE },
  { route: "GET /oauth/authorize", reason: OAUTH_PROTOCOL },
  { route: "POST /oauth/register", reason: OAUTH_PROTOCOL },
  { route: "POST /oauth/revoke", reason: OAUTH_PROTOCOL },
  { route: "POST /oauth/token", reason: OAUTH_PROTOCOL },
];
