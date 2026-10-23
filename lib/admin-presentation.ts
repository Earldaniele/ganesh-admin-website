/** Keep diagnostic details in server responses/logs, and show useful next steps in the interface. */
export function adminMessage(message: string): string {
  if (/Conflicting copy controls:/i.test(message)) return "The same website text was edited in two places. Use matching text before saving.";
  if (/MariaDB|MySQL|XAMPP|\bmigration\b|environment variable|PUBLIC_[A-Z_]+|CMS_[A-Z_]+|\bSQL\b|ECONN|\bER_[A-Z_]+|database|CMS is not configured/i.test(message)) return "The website service is unavailable. Please try again or contact your administrator. Your open edits are still here.";
  if (/secret|preview ticket|revalidation|audience|signature/i.test(message)) return "The website preview could not connect. Please try again or contact your administrator.";
  if (/Invalid .*\b(ID|version)\b/i.test(message)) return "This item could not be opened. Refresh the page and try again.";
  return message;
}
