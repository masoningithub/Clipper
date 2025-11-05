// ============================================
// Universal Draft Saver - 自动保存脚本
// 功能：智能识别并自动保存草稿内容
// ============================================

// 性能优化：使用WeakMap避免内存泄漏，存储元素相关数据
const elementDataMap = new WeakMap();

/**
 * 智能判断元素是否应该保存
 * @param {HTMLElement} el - 目标元素
 * @returns {boolean} 是否应该保存
 */
function shouldSaveElement(el) {
  if (!el || !el.tagName) return false;

  // 排除规则1：密码字段（多种检测方式）
  const isPasswordField =
    el.type === 'password' ||
    el.getAttribute('type') === 'password' ||
    el.autocomplete === 'current-password' ||
    el.autocomplete === 'new-password' ||
    /password|passwd|pwd/i.test(el.name || '') ||
    /password|passwd|pwd/i.test(el.id || '');

  if (isPasswordField) return false;

  // 排除规则2：搜索框（通过多种启发式规则）
  const isSearchBox =
    el.getAttribute('type') === 'search' ||
    el.getAttribute('role') === 'searchbox' ||
    /search|搜索|query/i.test(el.placeholder || '') ||
    /search|搜索/i.test(el.name || '') ||
    /search|搜索/i.test(el.getAttribute('aria-label') || '');

  if (isSearchBox) return false;

  // 排除规则3：隐藏元素
  if (el.offsetParent === null || el.style.display === 'none') return false;

  // 包含规则1：contenteditable富文本编辑器
  if (el.isContentEditable && el.getAttribute('contenteditable') === 'true') {
    return true;
  }

  // 包含规则2：textarea文本域
  if (el.tagName === 'TEXTAREA') {
    // 性能优化：缓存计算的样式，避免重复getComputedStyle
    let cachedData = elementDataMap.get(el);
    if (!cachedData) {
      const computedStyle = window.getComputedStyle(el);
      const height = parseInt(computedStyle.height, 10) || el.offsetHeight;
      cachedData = { height };
      elementDataMap.set(el, cachedData);
    }

    // 优先级1：高度超过150px的文本域
    if (cachedData.height > 150) return true;

    // 优先级2：通过name/placeholder判断为内容输入框
    const contentPatterns = /body|content|message|description|comment|text|post|reply|note|memo|备注|内容|评论|留言/i;
    if (contentPatterns.test(el.name || '') || contentPatterns.test(el.placeholder || '')) {
      return true;
    }
  }

  return false;
}

/**
 * 防抖函数 - 性能优化，减少频繁保存
 * @param {Function} func - 要防抖的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
function debounce(func, delay) {
  let timeoutId;
  return function debounced(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * 生成唯一的草稿Key
 * @param {HTMLElement} el - 目标元素
 * @returns {string} 草稿key
 */
function generateDraftKey(el) {
  // 优先使用ID，否则使用name，最后使用位置索引
  const hostname = window.location.hostname;
  const identifier = el.id || el.name || `pos_${Array.from(document.querySelectorAll('textarea, [contenteditable]')).indexOf(el)}`;
  return `${hostname}_${identifier}`;
}

/**
 * 保存草稿核心逻辑
 * @param {HTMLElement} el - 目标元素
 */
async function saveDraft(el) {
  try {
    // 安全检查：确保元素仍在DOM中
    if (!el || !el.isConnected) return;

    // 获取内容（根据元素类型）
    const isRichText = el.isContentEditable;
    const content = isRichText ? el.innerHTML : el.value;

    // 空内容检查
    const trimmedContent = isRichText
      ? el.textContent?.trim()
      : content?.trim();

    if (!trimmedContent || trimmedContent.length < 10) return; // 至少10个字符才保存

    // 构建草稿数据对象
    const draft = {
      url: window.location.href,
      content: content,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      title: document.title.substring(0, 60) || '无标题',
      isRichText: isRichText,
      domain: window.location.hostname,
      // 可选：添加元数据用于未来功能扩展
      metadata: {
        elementTag: el.tagName.toLowerCase(),
        elementId: el.id || null,
        elementName: el.name || null
      }
    };

    // 可选功能：使用Web Crypto API加密敏感内容
    // if (window.crypto && window.crypto.subtle) {
    //   draft.content = await encryptContent(content);
    //   draft.encrypted = true;
    // }

    const draftKey = generateDraftKey(el);

    // 性能优化：通过background script统一处理存储
    chrome.runtime.sendMessage({
      type: 'SAVE_DRAFT',
      draftKey: draftKey,
      draft: draft
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[AutoSave] 保存失败:', chrome.runtime.lastError);
      } else if (response && response.success) {
        console.log(`[AutoSave] 已保存草稿: ${draftKey}`);

        // 添加视觉反馈（可选）
        showSaveIndicator(el);
      }
    });

  } catch (error) {
    console.error('[AutoSave] 保存异常:', error);
  }
}

/**
 * 显示保存指示器（短暂的视觉反馈）
 * @param {HTMLElement} el - 目标元素
 */
function showSaveIndicator(el) {
  // 避免重复添加指示器
  const existingIndicator = el.parentElement?.querySelector('.draft-save-indicator');
  if (existingIndicator) return;

  const indicator = document.createElement('div');
  indicator.className = 'draft-save-indicator';
  indicator.textContent = '✓ 已自动保存';
  indicator.setAttribute('role', 'status');
  indicator.setAttribute('aria-live', 'polite');

  // 样式
  Object.assign(indicator.style, {
    position: 'absolute',
    top: '-25px',
    right: '10px',
    padding: '4px 8px',
    background: '#27ae60',
    color: 'white',
    fontSize: '12px',
    borderRadius: '4px',
    zIndex: '10000',
    opacity: '0',
    transition: 'opacity 0.3s',
    pointerEvents: 'none'
  });

  // 确保父元素有定位上下文
  const parent = el.parentElement;
  if (parent && window.getComputedStyle(parent).position === 'static') {
    parent.style.position = 'relative';
  }

  parent?.appendChild(indicator);

  // 淡入
  requestAnimationFrame(() => {
    indicator.style.opacity = '1';
  });

  // 2秒后淡出并移除
  setTimeout(() => {
    indicator.style.opacity = '0';
    setTimeout(() => indicator.remove(), 300);
  }, 2000);
}

/**
 * 可选：使用Web Crypto API加密内容
 * @param {string} content - 要加密的内容
 * @returns {Promise<string>} 加密后的内容（Base64）
 */
async function encryptContent(content) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);

    // 生成密钥（实际应用中应妥善保管密钥）
    const key = await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    // 生成随机IV
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // 加密
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );

    // 返回Base64编码（实际应用需存储IV和Key）
    return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  } catch (error) {
    console.error('[Crypto] 加密失败，使用明文存储:', error);
    return content;
  }
}

// 性能优化：使用防抖的保存函数，3秒内无新输入才保存
const debouncedSave = debounce(saveDraft, 3000);

/**
 * 监听输入事件
 * 性能优化：使用事件委托而非为每个元素绑定监听器
 */
document.addEventListener('input', (event) => {
  const target = event.target;

  if (shouldSaveElement(target)) {
    debouncedSave(target);
  }
}, { passive: true }); // passive提升滚动性能

/**
 * 页面卸载前保存所有草稿
 * 性能优化：同步收集数据，避免异步等待
 */
window.addEventListener('beforeunload', () => {
  try {
    // 查找所有可保存元素
    const editableElements = document.querySelectorAll('textarea, [contenteditable="true"]');

    editableElements.forEach(el => {
      if (shouldSaveElement(el)) {
        const content = el.isContentEditable ? el.innerHTML : el.value;
        const trimmed = el.isContentEditable ? el.textContent?.trim() : content?.trim();

        if (trimmed && trimmed.length >= 10) {
          // 立即保存（不等待异步完成）
          saveDraft(el);
        }
      }
    });
  } catch (error) {
    console.error('[AutoSave] beforeunload保存失败:', error);
  }
});

/**
 * 使用Mutation Observer监听动态添加的输入框
 * 性能优化：针对单页应用（SPA）场景
 */
const observer = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        // 检查新增节点本身
        if (shouldSaveElement(node)) {
          node.addEventListener('input', (e) => {
            if (shouldSaveElement(e.target)) {
              debouncedSave(e.target);
            }
          }, { passive: true });
        }

        // 检查新增节点的子元素
        if (node.querySelectorAll) {
          const editables = node.querySelectorAll('textarea, [contenteditable="true"]');
          editables.forEach(el => {
            if (shouldSaveElement(el)) {
              el.addEventListener('input', (e) => {
                if (shouldSaveElement(e.target)) {
                  debouncedSave(e.target);
                }
              }, { passive: true });
            }
          });
        }
      }
    });
  });
});

// 开始观察DOM变化
observer.observe(document.body, {
  childList: true,
  subtree: true
});

console.log('[AutoSave] 草稿自动保存已启动');
