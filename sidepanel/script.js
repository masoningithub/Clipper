// ============================================
// Universal Draft Saver - 侧边栏脚本
// 功能：草稿管理、搜索、排序、恢复、删除
// ============================================

// 全局状态管理
let allDrafts = [];
let filteredDrafts = [];
let currentSortMode = 'time-desc';

/**
 * 初始化侧边栏
 */
async function initialize() {
  try {
    // 加载草稿数据
    await loadDrafts();

    // 绑定事件监听器
    bindEventListeners();

    // 监听存储变化（实时更新）
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.drafts) {
        loadDrafts();
      }
    });

    console.log('[Sidebar] 侧边栏初始化完成');
  } catch (error) {
    console.error('[Sidebar] 初始化失败:', error);
    showError('初始化失败，请刷新页面重试');
  }
}

/**
 * 从存储加载所有草稿
 * 性能优化：一次性加载，减少存储访问
 */
async function loadDrafts() {
  try {
    const { drafts = {} } = await chrome.storage.local.get('drafts');

    // 转换为数组格式，便于操作
    allDrafts = Object.entries(drafts).map(([key, draft]) => ({
      key,
      ...draft
    }));

    // 应用当前排序和过滤
    applyFiltersAndSort();

    // 渲染列表
    renderDraftsList();

  } catch (error) {
    console.error('[Sidebar] 加载草稿失败:', error);
    showError('加载草稿失败，请检查存储权限');
  }
}

/**
 * 应用搜索过滤和排序
 */
function applyFiltersAndSort() {
  const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';

  // 过滤
  filteredDrafts = allDrafts.filter(draft => {
    if (!searchTerm) return true;

    const searchableText = [
      draft.title,
      draft.domain,
      getPlainText(draft.content),
      draft.url
    ].join(' ').toLowerCase();

    return searchableText.includes(searchTerm);
  });

  // 排序
  sortDrafts(currentSortMode);
}

/**
 * 排序草稿
 * @param {string} mode - 排序模式
 */
function sortDrafts(mode) {
  currentSortMode = mode;

  switch (mode) {
    case 'time-desc':
      // 最新保存在前
      filteredDrafts.sort((a, b) => b.timestamp - a.timestamp);
      break;

    case 'time-asc':
      // 最早保存在前
      filteredDrafts.sort((a, b) => a.timestamp - b.timestamp);
      break;

    case 'domain':
      // 按域名字母顺序
      filteredDrafts.sort((a, b) => {
        const domainA = (a.domain || '').toLowerCase();
        const domainB = (b.domain || '').toLowerCase();
        return domainA.localeCompare(domainB);
      });
      break;

    default:
      filteredDrafts.sort((a, b) => b.timestamp - a.timestamp);
  }
}

/**
 * 渲染草稿列表
 * 性能优化：使用DocumentFragment减少DOM操作
 */
function renderDraftsList() {
  const listContainer = document.getElementById('drafts-list');

  if (!listContainer) return;

  // 清空现有内容
  listContainer.innerHTML = '';

  // 空状态
  if (filteredDrafts.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty';
    emptyState.setAttribute('role', 'status');
    emptyState.textContent = allDrafts.length === 0
      ? '暂无草稿\n开始输入内容会自动保存'
      : '未找到匹配的草稿';
    listContainer.appendChild(emptyState);
    return;
  }

  // 使用DocumentFragment提高性能
  const fragment = document.createDocumentFragment();

  filteredDrafts.forEach((draft, index) => {
    const draftElement = createDraftElement(draft, index);
    fragment.appendChild(draftElement);
  });

  listContainer.appendChild(fragment);

  // 更新ARIA标签
  listContainer.setAttribute('aria-label', `草稿列表，共${filteredDrafts.length}条`);
}

/**
 * 创建单个草稿元素
 * @param {Object} draft - 草稿对象
 * @param {number} index - 索引
 * @returns {HTMLElement}
 */
function createDraftElement(draft, index) {
  const item = document.createElement('div');
  item.className = 'draft-item';
  item.setAttribute('role', 'listitem');
  item.setAttribute('data-draft-key', draft.key);

  // 提取纯文本预览
  const previewText = getPlainText(draft.content).substring(0, 150);
  const formattedTime = formatDateTime(draft.timestamp);
  const draftType = draft.isRichText ? '富文本' : '纯文本';

  item.innerHTML = `
    <div class="draft-title" title="${escapeHtml(draft.title)}">
      ${escapeHtml(draft.title || '无标题')}
    </div>

    <div class="draft-domain" title="${escapeHtml(draft.url)}">
      ${escapeHtml(draft.domain || new URL(draft.url).hostname)}
    </div>

    <div class="draft-preview" title="点击恢复按钮可恢复此草稿">
      ${escapeHtml(previewText)}${previewText.length >= 150 ? '...' : ''}
    </div>

    <div class="draft-meta">
      <span class="draft-time" title="保存时间">${formattedTime}</span>
      <span class="draft-type ${draft.isRichText ? 'rich-text' : ''}" title="内容类型">
        ${draftType}
      </span>
    </div>

    <div class="draft-actions">
      <button
        class="btn btn-primary restore-btn"
        type="button"
        data-draft-key="${draft.key}"
        aria-label="恢复草稿: ${escapeHtml(draft.title)}"
      >
        <span aria-hidden="true">↩️</span>
        恢复
      </button>

      <button
        class="btn btn-secondary view-btn"
        type="button"
        data-draft-key="${draft.key}"
        aria-label="查看完整内容"
      >
        <span aria-hidden="true">👁️</span>
        查看
      </button>

      <button
        class="btn btn-danger delete-btn"
        type="button"
        data-draft-key="${draft.key}"
        aria-label="删除草稿: ${escapeHtml(draft.title)}"
      >
        <span aria-hidden="true">🗑️</span>
        删除
      </button>
    </div>
  `;

  // 绑定按钮事件
  const restoreBtn = item.querySelector('.restore-btn');
  const viewBtn = item.querySelector('.view-btn');
  const deleteBtn = item.querySelector('.delete-btn');

  restoreBtn?.addEventListener('click', () => handleRestore(draft));
  viewBtn?.addEventListener('click', () => handleView(draft));
  deleteBtn?.addEventListener('click', () => handleDelete(draft.key, draft.title));

  return item;
}

/**
 * 处理恢复草稿
 * @param {Object} draft - 草稿对象
 */
async function handleRestore(draft) {
  try {
    // 获取当前活动标签页
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!activeTab || !activeTab.id) {
      showError('无法获取当前标签页，请确保有打开的网页');
      return;
    }

    // 注入恢复脚本
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: restoreContentToPage,
      args: [draft.content, draft.isRichText]
    });

    // 更新访问时间
    await chrome.runtime.sendMessage({
      type: 'UPDATE_DRAFT_ACCESS',
      draftKey: draft.key
    });

    // 显示成功消息
    showSuccess('草稿已恢复到页面');

    // 可选：关闭侧边栏（根据用户偏好）
    // window.close();

  } catch (error) {
    console.error('[Sidebar] 恢复失败:', error);

    if (error.message.includes('Cannot access')) {
      showError('无法在此页面恢复草稿（Chrome内部页面限制）');
    } else {
      showError('恢复草稿失败，请重试');
    }
  }
}

/**
 * 在页面中恢复内容（注入函数）
 * @param {string} content - 内容
 * @param {boolean} isRichText - 是否富文本
 */
function restoreContentToPage(content, isRichText) {
  try {
    // 查找最佳输入元素
    const textareas = Array.from(document.querySelectorAll('textarea'));
    const editables = Array.from(document.querySelectorAll('[contenteditable="true"]'));

    const visibleTextareas = textareas.filter(el =>
      el.offsetParent !== null &&
      el.style.display !== 'none' &&
      el.type !== 'password'
    );

    const visibleEditables = editables.filter(el =>
      el.offsetParent !== null &&
      el.style.display !== 'none'
    );

    // 优先级匹配
    let targetElement = null;

    if (isRichText && visibleEditables.length > 0) {
      targetElement = visibleEditables[0];
    } else if (!isRichText && visibleTextareas.length > 0) {
      targetElement = visibleTextareas.find(el => el.offsetHeight > 150) || visibleTextareas[0];
    } else {
      // 类型不匹配时选择任意可用元素
      targetElement = visibleEditables[0] || visibleTextareas[0];
    }

    if (!targetElement) {
      alert('未找到可恢复的输入框');
      return;
    }

    // 恢复内容
    if (targetElement.isContentEditable) {
      targetElement.innerHTML = content;
    } else {
      // 如果是富文本内容但目标是textarea，转换为纯文本
      if (isRichText) {
        const temp = document.createElement('div');
        temp.innerHTML = content;
        targetElement.value = temp.textContent || temp.innerText;
      } else {
        targetElement.value = content;
      }
    }

    // 触发事件
    targetElement.dispatchEvent(new Event('input', { bubbles: true }));
    targetElement.dispatchEvent(new Event('change', { bubbles: true }));

    // 聚焦并高亮
    targetElement.focus();
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // 添加视觉反馈
    const originalBoxShadow = targetElement.style.boxShadow;
    targetElement.style.transition = 'box-shadow 0.3s';
    targetElement.style.boxShadow = '0 0 0 4px rgba(39, 174, 96, 0.5)';

    setTimeout(() => {
      targetElement.style.boxShadow = originalBoxShadow;
    }, 2000);

  } catch (error) {
    console.error('恢复内容失败:', error);
    alert('恢复失败: ' + error.message);
  }
}

/**
 * 处理查看完整内容
 * @param {Object} draft - 草稿对象
 */
function handleView(draft) {
  const dialog = createViewDialog(draft);
  document.body.appendChild(dialog);

  // 聚焦到关闭按钮
  const closeBtn = dialog.querySelector('.dialog-close');
  closeBtn?.focus();
}

/**
 * 创建查看对话框
 * @param {Object} draft - 草稿对象
 * @returns {HTMLElement}
 */
function createViewDialog(draft) {
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'view-dialog-title');

  const plainText = getPlainText(draft.content);

  overlay.innerHTML = `
    <div class="dialog-content" style="max-width: 600px; max-height: 80vh; overflow: auto;">
      <h2 id="view-dialog-title" class="dialog-title">${escapeHtml(draft.title || '无标题')}</h2>

      <div style="margin-bottom: 12px; font-size: 12px; color: var(--color-gray-500);">
        <div>🌐 ${escapeHtml(draft.domain)}</div>
        <div>🕒 ${formatDateTime(draft.timestamp)}</div>
        <div>📝 ${draft.isRichText ? '富文本' : '纯文本'}</div>
      </div>

      <div style="
        background: var(--color-gray-100);
        padding: 12px;
        border-radius: 6px;
        max-height: 400px;
        overflow-y: auto;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 13px;
        line-height: 1.6;
      ">
        ${escapeHtml(plainText)}
      </div>

      <div class="dialog-actions" style="margin-top: 16px;">
        <button class="btn btn-primary dialog-restore" type="button">恢复此草稿</button>
        <button class="btn btn-secondary dialog-close" type="button">关闭</button>
      </div>
    </div>
  `;

  // 绑定事件
  const restoreBtn = overlay.querySelector('.dialog-restore');
  const closeBtn = overlay.querySelector('.dialog-close');

  restoreBtn?.addEventListener('click', () => {
    overlay.remove();
    handleRestore(draft);
  });

  closeBtn?.addEventListener('click', () => overlay.remove());

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  // ESC键关闭
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') overlay.remove();
  });

  return overlay;
}

/**
 * 处理删除草稿
 * @param {string} draftKey - 草稿key
 * @param {string} title - 草稿标题
 */
async function handleDelete(draftKey, title) {
  const confirmed = await showConfirmDialog(
    '确认删除',
    `确定要删除草稿"${title || '无标题'}"吗？\n此操作不可恢复。`
  );

  if (!confirmed) return;

  try {
    const { drafts = {} } = await chrome.storage.local.get('drafts');
    delete drafts[draftKey];
    await chrome.storage.local.set({ drafts });

    showSuccess('草稿已删除');
    await loadDrafts();

  } catch (error) {
    console.error('[Sidebar] 删除失败:', error);
    showError('删除失败，请重试');
  }
}

/**
 * 处理清空所有草稿
 */
async function handleClearAll() {
  if (allDrafts.length === 0) {
    showError('没有可清空的草稿');
    return;
  }

  const confirmed = await showConfirmDialog(
    '确认清空',
    `确定要清空所有 ${allDrafts.length} 条草稿吗？\n此操作不可恢复！`
  );

  if (!confirmed) return;

  try {
    await chrome.storage.local.set({ drafts: {} });
    showSuccess('已清空所有草稿');
    await loadDrafts();

  } catch (error) {
    console.error('[Sidebar] 清空失败:', error);
    showError('清空失败，请重试');
  }
}

/**
 * 导出草稿为JSON
 */
async function handleExport() {
  try {
    if (allDrafts.length === 0) {
      showError('没有可导出的草稿');
      return;
    }

    const exportData = {
      version: '1.0',
      exportTime: new Date().toISOString(),
      draftsCount: allDrafts.length,
      drafts: allDrafts
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `drafts-backup-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
    showSuccess('草稿已导出');

  } catch (error) {
    console.error('[Sidebar] 导出失败:', error);
    showError('导出失败，请重试');
  }
}

/**
 * 绑定所有事件监听器
 */
function bindEventListeners() {
  // 搜索输入
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      applyFiltersAndSort();
      renderDraftsList();
    }, 300));
  }

  // 排序选择
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSortMode = e.target.value;
      applyFiltersAndSort();
      renderDraftsList();
    });
  }

  // 清空所有按钮
  const clearAllBtn = document.getElementById('clear-all-btn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', handleClearAll);
  }

  // 导出按钮
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', handleExport);
  }
}

/**
 * 显示确认对话框
 * @param {string} title - 标题
 * @param {string} message - 消息
 * @returns {Promise<boolean>}
 */
function showConfirmDialog(title, message) {
  return new Promise((resolve) => {
    const dialog = document.getElementById('confirm-dialog');
    const titleEl = document.getElementById('dialog-title');
    const messageEl = document.getElementById('dialog-message');
    const confirmBtn = document.getElementById('dialog-confirm');
    const cancelBtn = document.getElementById('dialog-cancel');

    if (!dialog) {
      resolve(window.confirm(message));
      return;
    }

    titleEl.textContent = title;
    messageEl.textContent = message;
    dialog.style.display = 'flex';

    const cleanup = () => {
      dialog.style.display = 'none';
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
    };

    const onConfirm = () => {
      cleanup();
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);

    // ESC键取消
    const onKeydown = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', onKeydown);
        onCancel();
      }
    };
    document.addEventListener('keydown', onKeydown);

    // 聚焦到取消按钮（更安全）
    cancelBtn.focus();
  });
}

/**
 * 显示成功消息
 * @param {string} message
 */
function showSuccess(message) {
  showToast(message, 'success');
}

/**
 * 显示错误消息
 * @param {string} message
 */
function showError(message) {
  showToast(message, 'error');
}

/**
 * 显示提示消息
 * @param {string} message
 * @param {string} type - success/error/info
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  const colors = {
    success: '#27ae60',
    error: '#e74c3c',
    info: '#3498db'
  };

  Object.assign(toast.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '12px 20px',
    background: colors[type] || colors.info,
    color: 'white',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    zIndex: '10000',
    fontSize: '14px',
    fontWeight: '500',
    maxWidth: '300px',
    animation: 'slideInFromRight 0.3s ease'
  });

  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100px)';
    toast.style.transition = 'all 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * 防抖函数
 * @param {Function} func
 * @param {number} delay
 * @returns {Function}
 */
function debounce(func, delay) {
  let timeoutId;
  return function debounced(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * 格式化日期时间
 * @param {number} timestamp
 * @returns {string}
 */
function formatDateTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  // 1分钟内
  if (diff < 60000) return '刚刚';

  // 1小时内
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}分钟前`;
  }

  // 24小时内
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}小时前`;
  }

  // 7天内
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}天前`;
  }

  // 完整日期
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * 从HTML提取纯文本
 * @param {string} html
 * @returns {string}
 */
function getPlainText(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

/**
 * HTML转义
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

console.log('[Sidebar] 侧边栏脚本已加载');
