// ============================================
// Universal Draft Saver - 恢复提示脚本
// 功能：在页面加载时显示草稿恢复提示
// ============================================

// 防止重复初始化
let isPromptInitialized = false;

/**
 * 检查当前页面是否有可恢复的草稿
 */
async function checkForDrafts() {
  // 防止重复执行
  if (isPromptInitialized) return;
  isPromptInitialized = true;

  try {
    // 安全检查：跳过敏感页面
    const sensitiveDomains = [
      'bank', 'banking', 'paypal', 'payment', 'checkout',
      'login', 'signin', 'signup', 'register', 'password',
      'alipay', '支付宝', 'wechat', '微信支付'
    ];

    const hostname = window.location.hostname.toLowerCase();
    const isSensitivePage = sensitiveDomains.some(domain => hostname.includes(domain));

    if (isSensitivePage) {
      console.log('[RestorePrompt] 跳过敏感页面');
      return;
    }

    // 通过background script获取当前域名的草稿
    chrome.runtime.sendMessage({
      type: 'GET_DRAFTS_BY_DOMAIN',
      url: window.location.href
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[RestorePrompt] 获取草稿失败:', chrome.runtime.lastError);
        return;
      }

      if (response && response.success && response.drafts.length > 0) {
        // 等待页面完全加载后再显示提示
        if (document.readyState === 'complete') {
          showRestorePrompt(response.drafts);
        } else {
          window.addEventListener('load', () => showRestorePrompt(response.drafts));
        }
      }
    });

  } catch (error) {
    console.error('[RestorePrompt] 检查草稿异常:', error);
  }
}

/**
 * 显示恢复提示框
 * @param {Array} drafts - 草稿列表
 */
function showRestorePrompt(drafts) {
  // 避免重复创建
  if (document.getElementById('universal-draft-restore-prompt')) return;

  // 确保body已加载
  if (!document.body) {
    setTimeout(() => showRestorePrompt(drafts), 100);
    return;
  }

  // 获取最新的草稿
  const latestDraft = drafts.sort((a, b) => b.timestamp - a.timestamp)[0];

  // 创建提示框容器
  const promptContainer = document.createElement('div');
  promptContainer.id = 'universal-draft-restore-prompt';
  promptContainer.setAttribute('role', 'dialog');
  promptContainer.setAttribute('aria-labelledby', 'draft-prompt-title');
  promptContainer.setAttribute('aria-describedby', 'draft-prompt-desc');

  // 样式设置（遵循WCAG无障碍标准）
  Object.assign(promptContainer.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    maxWidth: '360px',
    backgroundColor: '#ffffff',
    border: '2px solid #3498db',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    padding: '16px',
    zIndex: '2147483647', // 最大z-index
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
    fontSize: '14px',
    lineHeight: '1.5',
    color: '#2c3e50',
    animation: 'slideInFromBottom 0.3s ease-out'
  });

  // 添加动画样式
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInFromBottom {
      from {
        transform: translateY(100px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    #universal-draft-restore-prompt button:focus {
      outline: 3px solid #3498db;
      outline-offset: 2px;
    }

    #universal-draft-restore-prompt button:hover {
      filter: brightness(1.1);
      transform: translateY(-1px);
    }

    #universal-draft-restore-prompt button:active {
      transform: translateY(0);
    }
  `;
  document.head.appendChild(style);

  // 构建提示内容
  const timeAgo = formatTimeAgo(latestDraft.timestamp);
  const previewText = getPlainText(latestDraft.content).substring(0, 80);

  promptContainer.innerHTML = `
    <div style="margin-bottom: 12px;">
      <h3 id="draft-prompt-title" style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #2c3e50;">
        📝 检测到未提交的草稿
      </h3>
      <p id="draft-prompt-desc" style="margin: 0 0 8px 0; font-size: 13px; color: #7f8c8d;">
        保存于 ${timeAgo}
      </p>
      <div style="background: #f8f9fa; padding: 8px; border-radius: 6px; font-size: 12px; color: #555; max-height: 60px; overflow: hidden; text-overflow: ellipsis;">
        ${escapeHtml(previewText)}...
      </div>
    </div>

    <div style="display: flex; gap: 8px;">
      <button
        id="draft-restore-btn"
        type="button"
        aria-label="恢复最后保存的草稿"
        style="
          flex: 1;
          padding: 10px 16px;
          background: #3498db;
          color: white;
          border: none;
          borderRadius: 6px;
          fontSize: 14px;
          fontWeight: 600;
          cursor: pointer;
          transition: all 0.2s;
        ">
        恢复草稿
      </button>

      <button
        id="draft-dismiss-btn"
        type="button"
        aria-label="忽略草稿提示"
        style="
          flex: 1;
          padding: 10px 16px;
          background: #95a5a6;
          color: white;
          border: none;
          borderRadius: 6px;
          fontSize: 14px;
          fontWeight: 500;
          cursor: pointer;
          transition: all 0.2s;
        ">
        忽略
      </button>
    </div>

    ${drafts.length > 1 ? `
      <div style="margin-top: 8px; text-align: center; font-size: 12px; color: #95a5a6;">
        还有 ${drafts.length - 1} 条草稿，<a href="#" id="open-sidebar-link" style="color: #3498db; text-decoration: none;">在侧边栏查看</a>
      </div>
    ` : ''}
  `;

  document.body.appendChild(promptContainer);

  // 绑定恢复按钮事件
  const restoreBtn = document.getElementById('draft-restore-btn');
  if (restoreBtn) {
    restoreBtn.addEventListener('click', () => {
      restoreDraft(latestDraft);
      promptContainer.remove();
    });
  }

  // 绑定忽略按钮事件
  const dismissBtn = document.getElementById('draft-dismiss-btn');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      promptContainer.style.animation = 'slideInFromBottom 0.3s ease-out reverse';
      setTimeout(() => promptContainer.remove(), 300);
    });
  }

  // 绑定侧边栏链接
  const sidebarLink = document.getElementById('open-sidebar-link');
  if (sidebarLink) {
    sidebarLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
      promptContainer.remove();
    });
  }

  // 键盘导航支持（ESC关闭，Enter恢复）
  promptContainer.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dismissBtn?.click();
    } else if (e.key === 'Enter' && document.activeElement === restoreBtn) {
      restoreBtn?.click();
    }
  });

  // 自动聚焦到恢复按钮（无障碍）
  restoreBtn?.focus();

  // 10秒后自动淡出（可选）
  setTimeout(() => {
    if (promptContainer.parentElement) {
      promptContainer.style.opacity = '0.7';
    }
  }, 10000);
}

/**
 * 恢复草稿到页面输入框
 * @param {Object} draft - 草稿对象
 */
function restoreDraft(draft) {
  try {
    // 根据草稿的元数据查找对应元素
    let targetElement = null;

    // 优先根据元素ID或name查找
    if (draft.metadata) {
      if (draft.metadata.elementId) {
        targetElement = document.getElementById(draft.metadata.elementId);
      } else if (draft.metadata.elementName) {
        const candidates = document.getElementsByName(draft.metadata.elementName);
        if (candidates.length > 0) {
          targetElement = candidates[0];
        }
      }
    }

    // 如果没找到，使用智能匹配
    if (!targetElement) {
      targetElement = findBestInputElement(draft.elementType);
    }

    if (!targetElement) {
      alert('未找到可恢复的输入框，请手动打开侧边栏恢复');
      return;
    }

    // 根据元素类型恢复内容
    const elementType = draft.elementType || (draft.isRichText ? 'contenteditable' : 'textarea');

    if (elementType === 'contenteditable' && targetElement.isContentEditable) {
      targetElement.innerHTML = draft.content;
    } else if (elementType === 'textarea' && targetElement.tagName === 'TEXTAREA') {
      targetElement.value = draft.content;
    } else if (elementType.startsWith('input-')) {
      const inputType = elementType.replace('input-', '');

      if (inputType === 'checkbox') {
        targetElement.checked = draft.metadata?.checked || draft.content === 'checked';
      } else if (inputType === 'radio') {
        targetElement.checked = draft.metadata?.checked || draft.content.startsWith('checked:');
      } else {
        // 其他input类型（text, email, url等）
        targetElement.value = draft.content;
      }
    } else if (elementType === 'select' && targetElement.tagName === 'SELECT') {
      try {
        const selectedOptions = JSON.parse(draft.content);
        if (selectedOptions && selectedOptions.length > 0) {
          // 恢复选中状态
          Array.from(targetElement.options).forEach(option => {
            option.selected = selectedOptions.some(sel => sel.value === option.value);
          });
        }
      } catch (e) {
        console.error('[RestorePrompt] 恢复select失败:', e);
      }
    } else {
      // 类型不匹配时尝试纯文本恢复
      const plainText = getPlainText(draft.content);
      if (targetElement.tagName === 'TEXTAREA' || targetElement.tagName === 'INPUT') {
        targetElement.value = plainText;
      } else if (targetElement.isContentEditable) {
        targetElement.textContent = plainText;
      }
    }

    // 触发事件（某些应用需要）
    targetElement.dispatchEvent(new Event('input', { bubbles: true }));
    targetElement.dispatchEvent(new Event('change', { bubbles: true }));

    // 聚焦并滚动到视图
    targetElement.focus();
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // 添加高亮效果
    highlightElement(targetElement);

    // 更新草稿访问时间
    chrome.runtime.sendMessage({
      type: 'UPDATE_DRAFT_ACCESS',
      draftKey: draft.key
    });

    console.log('[RestorePrompt] 草稿已恢复');

  } catch (error) {
    console.error('[RestorePrompt] 恢复失败:', error);
    alert('恢复草稿时出错，请稍后重试');
  }
}

/**
 * 查找最佳输入元素
 * 优先级：匹配类型 > 高度>150px的textarea > contenteditable > 普通textarea > input > select
 * @param {string} preferredType - 首选元素类型（可选）
 * @returns {HTMLElement|null}
 */
function findBestInputElement(preferredType) {
  const textareas = Array.from(document.querySelectorAll('textarea'));
  const editables = Array.from(document.querySelectorAll('[contenteditable="true"]'));
  const inputs = Array.from(document.querySelectorAll('input'));
  const selects = Array.from(document.querySelectorAll('select'));

  // 过滤掉隐藏元素和密码字段
  const visibleTextareas = textareas.filter(el =>
    el.offsetParent !== null &&
    el.style.display !== 'none'
  );

  const visibleEditables = editables.filter(el =>
    el.offsetParent !== null &&
    el.style.display !== 'none'
  );

  const visibleInputs = inputs.filter(el =>
    el.offsetParent !== null &&
    el.style.display !== 'none' &&
    el.type !== 'password' &&
    el.type !== 'hidden' &&
    el.type !== 'submit' &&
    el.type !== 'button'
  );

  const visibleSelects = selects.filter(el =>
    el.offsetParent !== null &&
    el.style.display !== 'none'
  );

  // 如果指定了首选类型，优先查找匹配类型的元素
  if (preferredType) {
    if (preferredType === 'contenteditable' && visibleEditables.length > 0) {
      return visibleEditables[0];
    } else if (preferredType === 'textarea' && visibleTextareas.length > 0) {
      return visibleTextareas[0];
    } else if (preferredType.startsWith('input-')) {
      const inputType = preferredType.replace('input-', '');
      const matchingInput = visibleInputs.find(el => el.type === inputType);
      if (matchingInput) return matchingInput;
    } else if (preferredType === 'select' && visibleSelects.length > 0) {
      return visibleSelects[0];
    }
  }

  // 默认优先级排序
  // 优先级1：高度>150px的textarea
  const largeTextarea = visibleTextareas.find(el => el.offsetHeight > 150);
  if (largeTextarea) return largeTextarea;

  // 优先级2：第一个可见的contenteditable
  if (visibleEditables.length > 0) return visibleEditables[0];

  // 优先级3：第一个可见的textarea
  if (visibleTextareas.length > 0) return visibleTextareas[0];

  // 优先级4：第一个可见的文本input
  const textInput = visibleInputs.find(el =>
    el.type === 'text' || el.type === 'email' || el.type === 'url' || el.type === 'tel'
  );
  if (textInput) return textInput;

  // 优先级5：第一个可见的input
  if (visibleInputs.length > 0) return visibleInputs[0];

  // 优先级6：第一个可见的select
  if (visibleSelects.length > 0) return visibleSelects[0];

  return null;
}

/**
 * 高亮元素（视觉反馈）
 * @param {HTMLElement} element
 */
function highlightElement(element) {
  const originalBoxShadow = element.style.boxShadow;
  const originalTransition = element.style.transition;

  element.style.transition = 'box-shadow 0.3s ease';
  element.style.boxShadow = '0 0 0 3px rgba(52, 152, 219, 0.5)';

  setTimeout(() => {
    element.style.boxShadow = originalBoxShadow;
    element.style.transition = originalTransition;
  }, 2000);
}

/**
 * 格式化时间为易读格式
 * @param {number} timestamp - 时间戳
 * @returns {string}
 */
function formatTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;

  return new Date(timestamp).toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * 从HTML中提取纯文本
 * @param {string} html
 * @returns {string}
 */
function getPlainText(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

/**
 * HTML转义（防止XSS）
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 初始化：等待DOM加载完成
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkForDrafts);
} else {
  // DOM已加载，延迟执行避免阻塞页面渲染
  setTimeout(checkForDrafts, 500);
}

console.log('[RestorePrompt] 草稿恢复提示已就绪');
