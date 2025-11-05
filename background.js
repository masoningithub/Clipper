// 自动清理过期草稿 (每天执行)
chrome.alarms.create('cleanDrafts', { periodInMinutes: 1440 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanDrafts') cleanExpiredDrafts();
});

// 初始化时清理
chrome.runtime.onInstalled.addListener(() => cleanExpiredDrafts());

async function cleanExpiredDrafts() {
  const { drafts = {} } = await chrome.storage.local.get('drafts');
  const now = Date.now();
  const EXPIRY_DAYS = 30;
  
  Object.entries(drafts).forEach(([key, draft]) => {
    if (now - draft.timestamp > EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
      delete drafts[key];
    }
  });
  
  await chrome.storage.local.set({ drafts });
}

// 跨页面恢复草稿通信
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_DRAFTS_BY_URL') {
    chrome.storage.local.get('drafts', ({ drafts = {} }) => {
      const matches = Object.values(drafts).filter(d => 
        new URL(d.url).hostname === new URL(request.url).hostname
      );
      sendResponse(matches);
    });
    return true; // 异步响应
  }
});