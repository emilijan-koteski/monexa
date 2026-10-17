# Monexa MCP tools

Generated from the tool registry in `src/tools` by `npm run docs`. `npm run check` fails when this file is out of date.

## Tools

| Tool | Title | Access | REST endpoints | Since |
| --- | --- | --- | --- | --- |
| `get_profile` | Get profile | read | `GET /api/v1/users/me`<br>`GET /api/v1/settings` | 2.0.0 |
| `list_categories` | List categories | read | `GET /api/v1/categories` | 2.0.0 |
| `list_payment_methods` | List payment methods | read | `GET /api/v1/payment-methods` | 2.0.0 |
| `list_records` | List records | read | `GET /api/v1/records`<br>`GET /api/v1/categories`<br>`GET /api/v1/payment-methods` | 2.0.0 |
| `get_record` | Get record | read | `GET /api/v1/records/:id` | 2.0.0 |
| `get_spending_summary` | Get spending summary | read | `GET /api/v1/categories/statistics` | 2.0.0 |
| `list_recurring_expenses` | List recurring expenses | read | `GET /api/v1/recurring-expenses` | 2.0.0 |
| `list_trend_reports` | List trend reports | read | `GET /api/v1/trend-reports` | 2.0.0 |
| `get_trend_report_data` | Get trend report data | read | `GET /api/v1/trend-reports/:id/monthly-data`<br>`GET /api/v1/trend-reports/:id/monthly-details` | 2.0.0 |
| `create_record` | Create record | write | `POST /api/v1/records`<br>`GET /api/v1/settings`<br>`GET /api/v1/records`<br>`GET /api/v1/payment-methods` | 2.0.0 |
| `update_record` | Update record | write | `PATCH /api/v1/records/:id` | 2.0.0 |
| `delete_record` | Delete record | write | `DELETE /api/v1/records/:id` | 2.0.0 |
| `create_category` | Create category | write | `POST /api/v1/categories` | 2.0.0 |
| `update_category` | Update category | write | `PATCH /api/v1/categories/:id` | 2.0.0 |
| `delete_category` | Delete category | write | `DELETE /api/v1/categories/:id` | 2.0.0 |
| `create_payment_method` | Create payment method | write | `POST /api/v1/payment-methods` | 2.0.0 |
| `update_payment_method` | Rename payment method | write | `PATCH /api/v1/payment-methods/:id` | 2.0.0 |
| `delete_payment_method` | Delete payment method | write | `DELETE /api/v1/payment-methods/:id` | 2.0.0 |
| `create_recurring_expense` | Create recurring expense | write | `POST /api/v1/recurring-expenses` | 2.0.0 |
| `update_recurring_expense` | Update recurring expense | write | `PATCH /api/v1/recurring-expenses/:id` | 2.0.0 |
| `delete_recurring_expense` | Delete recurring expense | write | `DELETE /api/v1/recurring-expenses/:id` | 2.0.0 |
| `update_settings` | Update settings | write | `PATCH /api/v1/settings` | 2.0.0 |

## Intentionally not exposed

| Route | Reason |
| --- | --- |
| `GET /.well-known/oauth-authorization-server` | OAuth protocol endpoint used by apps to connect, not a user action. |
| `GET /api/v1/access-tokens` | Account security; only available in the Monexa app. |
| `POST /api/v1/access-tokens` | Account security; only available in the Monexa app. |
| `DELETE /api/v1/access-tokens/:id` | Account security; only available in the Monexa app. |
| `DELETE /api/v1/auth/accounts` | Account security; only available in the Monexa app. |
| `POST /api/v1/auth/change-password` | Account security; only available in the Monexa app. |
| `POST /api/v1/auth/forgot-password` | Sign-in and session management of the Monexa app; connected apps authenticate with OAuth. |
| `POST /api/v1/auth/login` | Sign-in and session management of the Monexa app; connected apps authenticate with OAuth. |
| `POST /api/v1/auth/logout` | Sign-in and session management of the Monexa app; connected apps authenticate with OAuth. |
| `POST /api/v1/auth/register` | Sign-in and session management of the Monexa app; connected apps authenticate with OAuth. |
| `POST /api/v1/auth/reset-password` | Sign-in and session management of the Monexa app; connected apps authenticate with OAuth. |
| `POST /api/v1/auth/sessions/revoke` | Sign-in and session management of the Monexa app; connected apps authenticate with OAuth. |
| `POST /api/v1/auth/tokens/renew` | Sign-in and session management of the Monexa app; connected apps authenticate with OAuth. |
| `GET /api/v1/categories/:id` | list_categories returns the same data. |
| `GET /api/v1/health` | Infrastructure health check. |
| `GET /api/v1/health/restricted` | Infrastructure health check. |
| `GET /api/v1/legal-documents` | Legal documents are reviewed and accepted in the Monexa app. |
| `POST /api/v1/legal-documents/:id/accept` | Legal documents are reviewed and accepted in the Monexa app. |
| `POST /api/v1/legal-documents/hash/compute` | Integrity tooling for publishing legal documents; not user data. |
| `POST /api/v1/legal-documents/hash/verify` | Integrity tooling for publishing legal documents; not user data. |
| `GET /api/v1/legal-documents/pending` | Legal documents are reviewed and accepted in the Monexa app. |
| `GET /api/v1/oauth/authorizations/:id` | OAuth consent screen; only the user may approve or deny an app in the Monexa app. |
| `POST /api/v1/oauth/authorizations/:id/approve` | OAuth consent screen; only the user may approve or deny an app in the Monexa app. |
| `POST /api/v1/oauth/authorizations/:id/deny` | OAuth consent screen; only the user may approve or deny an app in the Monexa app. |
| `GET /api/v1/oauth/grants` | Account security; only available in the Monexa app. |
| `DELETE /api/v1/oauth/grants/:id` | Account security; only available in the Monexa app. |
| `GET /api/v1/payment-methods/:id` | list_payment_methods returns the same data. |
| `GET /api/v1/records/descriptions/suggestions` | UI autocomplete helper. |
| `GET /api/v1/records/summary` | get_spending_summary covers totals. |
| `GET /api/v1/recurring-expenses/:id` | list_recurring_expenses returns the same data. |
| `POST /api/v1/trend-reports` | Creating and editing trend reports is planned for a minor release. |
| `DELETE /api/v1/trend-reports/:id` | Creating and editing trend reports is planned for a minor release. |
| `GET /api/v1/trend-reports/:id` | list_trend_reports returns the same data. |
| `PATCH /api/v1/trend-reports/:id` | Creating and editing trend reports is planned for a minor release. |
| `PATCH /api/v1/users` | Profile changes are made in the Monexa app. |
| `GET /api/v1/users/data/export` | Data export produces a downloadable file in the Monexa app. |
| `GET /healthz` | Infrastructure health check. |
| `GET /oauth/authorize` | OAuth protocol endpoint used by apps to connect, not a user action. |
| `POST /oauth/register` | OAuth protocol endpoint used by apps to connect, not a user action. |
| `POST /oauth/revoke` | OAuth protocol endpoint used by apps to connect, not a user action. |
| `POST /oauth/token` | OAuth protocol endpoint used by apps to connect, not a user action. |
