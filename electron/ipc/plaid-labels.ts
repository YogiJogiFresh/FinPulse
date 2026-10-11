export function formatPlaidTransactionBank(
  institutionName: string,
  accountName: string
): string {
  const institution = institutionName.trim() || 'Plaid';
  const account = accountName.trim();
  return account ? `${institution} (${account})` : institution;
}
