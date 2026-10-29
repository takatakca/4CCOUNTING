// 4CCOUNTING hooks: Food Hub's platform orders are kept for the "platform sales" section (Clover payments are read live).
import type { AppHooks } from '../hooks';
import { recordPlatformOrder } from './books';

export const hooks: AppHooks = {
  async onSuiteEvent(e) {
    if (e.type === 'order.created' || e.type === 'order.status_changed') await recordPlatformOrder(e.data?.order);
  },
};
