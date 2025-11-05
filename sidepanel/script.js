// 加载草稿列表
async function loadDrafts() {
  const { drafts = {} } = await chrome.storage.local.get('drafts');
  const draftsList = document.getElementById('drafts-list');
  
  if (Object.keys(drafts).length === 0) {
    draftsList.innerHTML = '<p class="empty">暂无草稿，开始输入内容会自动保存</p>';
    return;
  }

  // 按时间倒序排列
  const sortedDrafts = Object.entries(drafts)
    .sort(([,a], [,b]) => b.timestamp - a.timestamp)
    .map(([key, draft]) => ({ key, ...draft }));

  draftsList.innerHTML = sortedDrafts.map(draft => `
    <div class="draft-item" data-key="${draft.key}">
      <div class="draft-title">${draft.title || '无标题'}</div>
      <div class="draft-url">${new URL(draft.url).hostname}</div>
      <div class="draft-content">${draft.content}</div>
      <div class="draft-time">${new Date(draft.timestamp).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })}</div>
      <div class="actions">
        <button class="action-btn restore-btn" data-key="${draft.key}">恢复</button>
        <button class="action-btn delete-btn" data-key="${draft.key}">删除</button>
      </div>
    </div>
  `).join('');

  // 绑定按钮事件
  document.querySelectorAll('.restore-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const key = e.target.dataset.key;
      const { drafts } = await chrome.storage.local.get('drafts');
      const draft = drafts[key];
      
      // 发送恢复指令到当前标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (content, isRichText) => {
          const target = document.querySelector('textarea, [contenteditable]');
          if (target) {
            if (isRichText) {
              target.innerHTML = content;
            } else {
              target.value = content;
            }
            target.focus();
            window.postMessage({ type: 'RESTORE_COMPLETED' }, '*');
          }
        },
        args: [draft.content, draft.isRichText]
      });
      
      // 关闭侧边栏
      window.close();
    });
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const key = e.target.dataset.key;
      const { drafts } = await chrome.storage.local.get('drafts');
      delete drafts[key];
      await chrome.storage.local.set({ drafts });
      loadDrafts(); // 刷新列表
    });
  });
}

// 清空所有草稿
document.getElementById('clear-all').addEventListener('click', async () => {
  if (confirm('确定清空所有草稿？此操作不可恢复')) {
    await chrome.storage.local.set({ drafts: {} });
    loadDrafts();
  }
});

// 初始化
document.addEventListener('DOMContentLoaded', loadDrafts);