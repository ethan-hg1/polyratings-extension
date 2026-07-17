import { ensureFreshProfessors } from './lib/cache.js';

const ext = globalThis.browser ?? globalThis.chrome;

const ALARM_NAME = 'polyratings-refresh';
const ALARM_PERIOD_MINUTES = 24 * 60;

async function refresh() {
  try {
    await ensureFreshProfessors(ext);
  } catch (err) {
    console.error('[polyratings] cache refresh failed', err);
  }
}

ext.runtime.onInstalled.addListener(() => {
  refresh();
  ext.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
});

ext.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) refresh();
});
