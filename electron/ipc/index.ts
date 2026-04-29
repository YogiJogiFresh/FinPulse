import { registerAccountHandlers } from './accounts';
import { registerBudgetHandlers } from './budget';
import { registerDebtHandlers } from './debts';
import { registerIncomeHandlers } from './income';
import { registerSettingsHandlers } from './settings';
import { registerHistoryHandlers } from './history';
import { registerPropertyHandlers } from './properties';

export function registerAllHandlers(): void {
  registerAccountHandlers();
  registerBudgetHandlers();
  registerDebtHandlers();
  registerIncomeHandlers();
  registerSettingsHandlers();
  registerHistoryHandlers();
  registerPropertyHandlers();
}
