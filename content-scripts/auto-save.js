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

  const tagName = el.tagName.toUpperCase();

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

  // 排除规则4：某些不需要保存的input类型
  const excludedInputTypes = ['submit', 'button', 'reset', 'image', 'file', 'hidden'];
  if (tagName === 'INPUT' && excludedInputTypes.includes(el.type)) return false;

  // 包含规则1：contenteditable富文本编辑器
  if (el.isContentEditable && el.getAttribute('contenteditable') === 'true') {
    return true;
  }

  // 包含规则2：textarea文本域
  if (tagName === 'TEXTAREA') {
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

  // 包含规则3：INPUT元素（文本类型）
  if (tagName === 'INPUT') {
    const textInputTypes = ['text', 'email', 'url', 'tel', 'number', 'date', 'datetime-local', 'month', 'week', 'time', 'color'];
    if (textInputTypes.includes(el.type)) {
      // 排除短的name字段（通常是用户名、邮箱等敏感信息）
      const sensitivePatterns = /username|user|email|login|account|phone|mobile|名字|用户名|邮箱|手机|电话/i;
      if (sensitivePatterns.test(el.name || '') || sensitivePatterns.test(el.id || '')) {
        return false;
      }
      return true;
    }
  }

  // 包含规则4：SELECT下拉选择框
  if (tagName === 'SELECT') {
    return true;
  }

  // 包含规则5：CHECKBOX和RADIO按钮（如果是表单的一部分）
  if (tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')) {
    // 只保存有name的checkbox/radio（属于表单的一部分）
    return !!(el.name);
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
  const tagName = el.tagName.toLowerCase();
  const identifier = el.id || el.name || `${tagName}_pos_${Array.from(document.querySelectorAll(tagName)).indexOf(el)}`;
  return `${hostname}_${identifier}`;
}

/**
 * 提取元素的值（根据不同元素类型）
 * @param {HTMLElement} el - 目标元素
 * @returns {Object} 包含content和elementType的对象
 */
function extractElementValue(el) {
  const tagName = el.tagName.toUpperCase();
  let content = '';
  let elementType = tagName.toLowerCase();
  let additionalData = {};

  if (el.isContentEditable) {
    // contenteditable富文本
    content = el.innerHTML;
    elementType = 'contenteditable';
  } else if (tagName === 'TEXTAREA') {
    // textarea文本域
    content = el.value;
    elementType = 'textarea';
  } else if (tagName === 'INPUT') {
    const inputType = el.type || 'text';
    elementType = `input-${inputType}`;

    if (inputType === 'checkbox') {
      // checkbox: 保存checked状态
      content = el.checked ? 'checked' : 'unchecked';
      additionalData.checked = el.checked;
      additionalData.value = el.value;
    } else if (inputType === 'radio') {
      // radio: 保存checked状态和值
      content = el.checked ? `checked:${el.value}` : `unchecked:${el.value}`;
      additionalData.checked = el.checked;
      additionalData.value = el.value;
    } else {
      // 其他input类型（text, email, url, number等）
      content = el.value;
    }
  } else if (tagName === 'SELECT') {
    // select下拉框: 保存选中的值和索引
    elementType = 'select';
    const selectedOptions = Array.from(el.selectedOptions).map(opt => ({
      value: opt.value,
      text: opt.text,
      index: opt.index
    }));
    content = JSON.stringify(selectedOptions);
    additionalData.selectedIndex = el.selectedIndex;
    additionalData.multiple = el.multiple;
  }

  return { content, elementType, additionalData };
}

/**
 * 保存草稿核心逻辑
 * @param {HTMLElement} el - 目标元素
 */
async function saveDraft(el) {
  try {
    // 安全检查：确保元素仍在DOM中
    if (!el || !el.isConnected) return;

    // 提取元素的值
    const { content, elementType, additionalData } = extractElementValue(el);

    // 空内容检查（根据元素类型调整验证规则）
    if (elementType === 'input-checkbox' || elementType === 'input-radio') {
      // checkbox和radio总是保存状态
    } else if (elementType === 'select') {
      // select至少要有选中项
      if (!content || content === '[]') return;
    } else {
      // 其他类型需要检查内容长度
      const trimmedContent = elementType === 'contenteditable'
        ? el.textContent?.trim()
        : content?.trim();

      // 对于文本输入，至少需要3个字符（降低阈值以支持更多场景）
      if (!trimmedContent || trimmedContent.length < 3) return;
    }

    // 构建草稿数据对象
    const draft = {
      url: window.location.href,
      content: content,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      title: document.title.substring(0, 60) || '无标题',
      elementType: elementType,
      isRichText: elementType === 'contenteditable',
      domain: window.location.hostname,
      // 可选：添加元数据用于未来功能扩展
      metadata: {
        elementTag: el.tagName.toLowerCase(),
        elementType: elementType,
        elementId: el.id || null,
        elementName: el.name || null,
        elementType: el.type || null,
        ...additionalData
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
 * 监听change事件（用于select、checkbox、radio等元素）
 * 这些元素通常触发change而非input事件
 */
document.addEventListener('change', (event) => {
  const target = event.target;

  if (shouldSaveElement(target)) {
    // select、checkbox、radio立即保存，无需防抖
    const tagName = target.tagName.toUpperCase();
    if (tagName === 'SELECT' || (tagName === 'INPUT' && (target.type === 'checkbox' || target.type === 'radio'))) {
      saveDraft(target);
    } else {
      debouncedSave(target);
    }
  }
}, { passive: true });

/**
 * 页面卸载前保存所有草稿
 * 性能优化：同步收集数据，避免异步等待
 */
window.addEventListener('beforeunload', () => {
  try {
    // 查找所有可保存元素
    const editableElements = document.querySelectorAll('textarea, [contenteditable="true"], input, select');

    editableElements.forEach(el => {
      if (shouldSaveElement(el)) {
        // 立即保存（不等待异步完成）
        saveDraft(el);
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
          attachEventListeners(node);
        }

        // 检查新增节点的子元素
        if (node.querySelectorAll) {
          const formElements = node.querySelectorAll('textarea, [contenteditable="true"], input, select');
          formElements.forEach(el => {
            if (shouldSaveElement(el)) {
              attachEventListeners(el);
            }
          });
        }
      }
    });
  });
});

/**
 * 为元素附加事件监听器
 * @param {HTMLElement} el - 目标元素
 */
function attachEventListeners(el) {
  const tagName = el.tagName.toUpperCase();

  // input事件（用于文本输入）
  el.addEventListener('input', (e) => {
    if (shouldSaveElement(e.target)) {
      debouncedSave(e.target);
    }
  }, { passive: true });

  // change事件（用于select、checkbox、radio）
  if (tagName === 'SELECT' || (tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio'))) {
    el.addEventListener('change', (e) => {
      if (shouldSaveElement(e.target)) {
        saveDraft(e.target);
      }
    }, { passive: true });
  }
}

// 开始观察DOM变化（确保body已加载）
if (document.body) {
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  console.log('[AutoSave] 草稿自动保存已启动');
} else {
  // 等待body加载
  document.addEventListener('DOMContentLoaded', () => {
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      console.log('[AutoSave] 草稿自动保存已启动（延迟）');
    }
  });
}
