// 在页面加载时检查草稿
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkForDrafts);
} else {
  checkForDrafts();
}

async function checkForDrafts() {
  // 跳过敏感页面
  const unsafeDomains = ['bank', 'login', 'paypal', 'password'];
  if (unsafeDomains.some(d => location.hostname.includes(d))) return;

  const { drafts = {} } = await chrome.storage.local.get('drafts');
  const currentDomain = location.hostname;
  
  // 查找当前域名的草稿
  const domainDrafts = Object.values(drafts).filter(d => 
    new URL(d.url).hostname === currentDomain
  );

  if (domainDrafts.length > 0) {
    showRestorePrompt(domainDrafts);
  }
}

function showRestorePrompt(drafts) {
  // 创建提示框
  const prompt = document.createElement('div');
  prompt.innerHTML = `
    <div style="position:fixed;bottom:20px;right:20px;background:#4a6fa5;color:white;padding:12px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.2);z-index:9999999">
      <strong>📝 检测到未提交草稿</strong> (${drafts.length}条)<br>
      <button id="restore-btn" style="margin-top:8px;background:#2c3e50;border:none;color:white;padding:4px 8px;border-radius:4px;cursor:pointer">恢复最后草稿</button>
      <button id="dismiss-btn" style="margin-left:8px;background:transparent;border:1px solid white;color:white;padding:4px 8px;border-radius:4px;cursor:pointer">忽略</button>
    </div>
  `;
  
  document.body.appendChild(prompt);
  
  // 恢复逻辑
  document.getElementById('restore-btn').addEventListener('click', () => {
    const latest = drafts.sort((a,b) => b.timestamp - a.timestamp)[0];
    chrome.storage.local.get('drafts', ({ drafts }) => {
      Object.keys(drafts).find(key => 
        drafts[key].url === latest.url && 
        drafts[key].content === latest.content
      );
      // 发送恢复请求到内容脚本
      window.postMessage({ 
        type: 'RESTORE_DRAFT', 
        content: latest.content,
        isRichText: latest.isRichText
      }, '*');
      prompt.remove();
    });
  });
  
  // 关闭提示
  document.getElementById('dismiss-btn').addEventListener('click', () => {
    prompt.remove();
  });
}

// 监听恢复请求
window.addEventListener('message', (e) => {
  if (e.data?.type === 'RESTORE_DRAFT') {
    // 查找可恢复的输入区域
    const target = document.querySelector('textarea, [contenteditable]');
    if (target) {
      if (e.data.isRichText) {
        target.innerHTML = e.data.content;
      } else {
        target.value = e.data.content;
      }
      target.focus();
    }
  }
});