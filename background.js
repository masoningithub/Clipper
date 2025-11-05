// ============================================
// Universal Draft Saver - Service Worker
// 功能：定时清理过期草稿（30天未访问）
// ============================================

// 性能优化：使用chrome.alarms替代setInterval避免后台持续运行
chrome.alarms.create('cleanExpiredDrafts', {
  periodInMinutes: 1440 // 每24小时执行一次
});

// 监听定时任务
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanExpiredDrafts') {
    cleanExpiredDrafts();
  }
});

// 扩展安装或更新时立即清理一次
chrome.runtime.onInstalled.addListener(() => {
  cleanExpiredDrafts();
});

/**
 * 清理超过30天未访问的草稿
 * 性能优化：批量处理避免多次存储写入
 */
async function cleanExpiredDrafts() {
  try {
    const { drafts = {} } = await chrome.storage.local.get('drafts');
    const now = Date.now();
    const EXPIRY_MILLISECONDS = 30 * 24 * 60 * 60 * 1000; // 30天

    let hasChanges = false;
    const draftEntries = Object.entries(drafts);

    // 性能优化：使用forEach而非filter+map减少数组遍历次数
    draftEntries.forEach(([key, draft]) => {
      // 使用lastAccessed时间戳，如果不存在则使用创建时间
      const lastAccessTime = draft.lastAccessed || draft.timestamp;

      if (now - lastAccessTime > EXPIRY_MILLISECONDS) {
        delete drafts[key];
        hasChanges = true;
      }
    });

    // 只有在确实删除了内容时才写入存储
    if (hasChanges) {
      await chrome.storage.local.set({ drafts });
      console.log(`[Draft Cleaner] 已清理过期草稿，剩余: ${Object.keys(drafts).length} 条`);
    }
  } catch (error) {
    console.error('[Draft Cleaner] 清理失败:', error);
  }
}

/**
 * 跨页面消息通信处理
 * 用于恢复草稿时更新lastAccessed时间戳
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 获取指定域名的所有草稿
  if (request.type === 'GET_DRAFTS_BY_DOMAIN') {
    handleGetDraftsByDomain(request, sendResponse);
    return true; // 异步响应必须返回true
  }

  // 更新草稿的访问时间
  if (request.type === 'UPDATE_DRAFT_ACCESS') {
    handleUpdateDraftAccess(request, sendResponse);
    return true;
  }

  // 保存草稿（从content script调用）
  if (request.type === 'SAVE_DRAFT') {
    handleSaveDraft(request, sendResponse);
    return true;
  }
});

/**
 * 获取指定域名的草稿列表
 */
async function handleGetDraftsByDomain(request, sendResponse) {
  try {
    const { drafts = {} } = await chrome.storage.local.get('drafts');
    const requestHostname = new URL(request.url).hostname;

    // 性能优化：直接filter而不是先转换再filter
    const matchedDrafts = Object.entries(drafts)
      .filter(([_, draft]) => {
        try {
          return new URL(draft.url).hostname === requestHostname;
        } catch {
          return false; // 忽略无效URL
        }
      })
      .map(([key, draft]) => ({ key, ...draft }))
      .sort((a, b) => b.timestamp - a.timestamp); // 按时间倒序

    sendResponse({ success: true, drafts: matchedDrafts });
  } catch (error) {
    console.error('[Background] 获取草稿失败:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 更新草稿访问时间
 */
async function handleUpdateDraftAccess(request, sendResponse) {
  try {
    const { drafts = {} } = await chrome.storage.local.get('drafts');

    if (drafts[request.draftKey]) {
      drafts[request.draftKey].lastAccessed = Date.now();
      await chrome.storage.local.set({ drafts });
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: '草稿不存在' });
    }
  } catch (error) {
    console.error('[Background] 更新访问时间失败:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 保存草稿（从content script接收）
 * 性能优化：在service worker中统一处理存储，减少content script的存储权限依赖
 */
async function handleSaveDraft(request, sendResponse) {
  try {
    const { drafts = {} } = await chrome.storage.local.get('drafts');
    drafts[request.draftKey] = request.draft;
    await chrome.storage.local.set({ drafts });
    sendResponse({ success: true });
  } catch (error) {
    console.error('[Background] 保存草稿失败:', error);
    sendResponse({ success: false, error: error.message });
  }
}
