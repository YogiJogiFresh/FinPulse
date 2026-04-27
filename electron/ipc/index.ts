import { registerAccountHandlers } from './accounts';
import { registerTransactionHandlers } from './transactions';
import { registerBudgetHandlers } from './budget';
import { registerDebtHandlers } from './debts';
import { registerIncomeHandlers } from './income';
import { registerSettingsHandlers } from './settings';
import { registerHistoryHandlers } from './history';
import { registerPropertyHandlers } from './properties';

export function registerAllHandlers(): void {
  registerAccountHandlers();
  registerTransactionHandlers();
  registerBudgetHandlers();
  registerDebtHandlers();
  registerIncomeHandlers();
  registerSettingsHandlers();
  registerHistoryHandlers();
  registerPropertyHandlers();
}
