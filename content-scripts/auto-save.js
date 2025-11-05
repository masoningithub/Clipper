// 智能识别可保存区域
function shouldSaveElement(el) {
  // 排除密码/搜索框
  if (el.type === 'password' || el.getAttribute('type') === 'search') return false;
  
  // 优先匹配富文本编辑器
  if (el.isContentEditable) return true;
  
  // 匹配长文本输入区域
  return (
    el.tagName === 'TEXTAREA' ||
    el.scrollHeight > 150 || 
    el.placeholder?.toLowerCase().includes('comment') ||
    el.name?.match(/body|content|message|description/i)
  );
}

// 防抖函数
function debounce(func, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

// 保存逻辑
const saveDraft = debounce(async (el) => {
  const content = el.isContentEditable ? el.innerHTML : el.value;
  if (!content.trim()) return;

  const draft = {
    url: window.location.href,
    content,
    timestamp: Date.now(),
    title: document.title.substring(0, 60),
    isRichText: el.isContentEditable
  };

  const { drafts = {} } = await chrome.storage.local.get('drafts');
  const key = `${window.location.hostname}_${el.id || Date.now()}`;
  drafts[key] = draft;
  
  await chrome.storage.local.set({ drafts });
}, 3000);

// 监听输入
document.addEventListener('input', (e) => {
  const el = e.target;
  if (shouldSaveElement(el)) {
    saveDraft(el);
  }
});

// 页面卸载时强制保存
window.addEventListener('beforeunload', async () => {
  document.querySelectorAll('textarea, [contenteditable]').forEach(el => {
    if (shouldSaveElement(el)) {
      const content = el.isContentEditable ? el.innerHTML : el.value;
      if (content.trim()) saveDraft(el); // 不等待异步
    }
  });
});