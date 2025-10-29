// Electron API 适配器
const storage = {
  local: {
    get: async (keys) => {
      return await window.electronAPI.storage.get(keys);
    },
    set: async (items) => {
      return await window.electronAPI.storage.set(items);
    },
    remove: async (keys) => {
      return await window.electronAPI.storage.remove(keys);
    },
    clear: async () => {
      return await window.electronAPI.storage.clear();
    }
  }
};

// 剪贴板适配器
const clipboard = {
  writeText: async (text) => {
    await window.electronAPI.clipboard.writeText(text);
    return Promise.resolve();
  }
};

document.addEventListener('DOMContentLoaded', function() {
  // DOM元素
  const searchInput = document.getElementById('search-input');
  const promptsList = document.getElementById('prompts-list');
  const exportButton = document.getElementById('export-button');
  const importButton = document.getElementById('import-button');
  const editorView = document.getElementById('editor-view');
  const listView = document.getElementById('list-view');
  const promptEditor = document.getElementById('prompt-editor');
  const cancelButton = document.getElementById('cancel-button');
  
  // Mode相关元素
  const modeDropdown = document.getElementById('mode-dropdown');
  const modeButton = document.getElementById('mode-button');
  const modeText = document.getElementById('mode-text');
  const modeDropdownContent = document.getElementById('mode-dropdown-content');
  const addModeItem = document.getElementById('add-mode-item');
  const addModeText = document.getElementById('add-mode-text');
  
  // 窗口控制按钮
  const minimizeBtn = document.getElementById('minimize-btn');
  const closeBtn = document.getElementById('close-btn');
  
  // Mode状态
  let currentMode = { id: 'default', name: '看书' };
  let modes = [{ id: 'default', name: '看书' }];
  let isAddingMode = false;

  // Popup 键盘导航状态
  let listItems = [];
  let selectedIndex = -1;

  function updateSelection(nextIndex) {
    if (!listItems.length) {
      selectedIndex = -1;
      return;
    }
    const max = listItems.length - 1;
    if (nextIndex < 0) nextIndex = max;
    if (nextIndex > max) nextIndex = 0;
    selectedIndex = nextIndex;
    listItems.forEach((el, i) => {
      if (i === selectedIndex) {
        el.classList.add('selected');
        el.scrollIntoView({ block: 'nearest' });
      } else {
        el.classList.remove('selected');
      }
    });
  }

  function collectListItems() {
    listItems = Array.from(promptsList.querySelectorAll('.prompt-item'));
    selectedIndex = listItems.length ? 0 : -1;
    updateSelection(selectedIndex);
    listItems.forEach((el, i) => {
      el.addEventListener('mouseenter', () => updateSelection(i));
    });
  }
  
  // 窗口控制
  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', () => {
      window.electronAPI.window.minimize();
    });
  }
  
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      window.electronAPI.window.close();
    });
  }
  
  // 监听窗口显示事件，聚焦搜索框
  window.electronAPI.window.onShown(() => {
    if (searchInput && listView.classList.contains('active')) {
      setTimeout(() => {
        try { searchInput.focus(); } catch (_) {}
      }, 100);
    }
  });
  
  // 导入对话框相关元素和变量
  let importDialog = null;
  let importTextarea = null;
  let importButton2 = null;
  let cancelImportButton = null;
  let deleteAllButton = null;

  // 初始化
  function init() {
    loadModes();
    loadPrompts();
    if (searchInput) {
      try { searchInput.focus(); } catch (_) {}
    }
  }

  // 加载模式
  function loadModes() {
    storage.local.get(['modes', 'currentMode']).then(data => {
      modes = data.modes || [{ id: 'default', name: '看书' }];
      currentMode = data.currentMode || { id: 'default', name: '看书' };
      updateModeDisplay();
      renderModeDropdown();
    });
  }

  // 更新模式显示
  function updateModeDisplay() {
    const displayName = currentMode.name.length > 10 
      ? currentMode.name.substring(0, 10) + '...' 
      : currentMode.name;
    modeText.textContent = displayName;
  }

  // 渲染模式下拉菜单
  function renderModeDropdown() {
    modeDropdownContent.innerHTML = '';
    
    const addModeDiv = document.createElement('div');
    addModeDiv.className = 'mode-dropdown-item add-mode-item';
    addModeDiv.id = 'add-mode-item';
    addModeDiv.innerHTML = '<span id="add-mode-text">+ Add Mode</span>';
    modeDropdownContent.appendChild(addModeDiv);
    
    modes.forEach((mode, index) => {
      const modeDiv = document.createElement('div');
      modeDiv.className = 'mode-dropdown-item';
      modeDiv.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: relative;
      `;
      
      const pinButton = document.createElement('div');
      pinButton.style.cssText = `
        position: absolute;
        left: 5px;
        width: 20px;
        height: 20px;
        display: none;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #999;
        font-size: 16px;
        transition: color 0.2s;
      `;
      pinButton.innerHTML = '⬆︎';
      pinButton.addEventListener('click', function(e) {
        e.stopPropagation();
        pinMode(mode.id);
      });
      
      pinButton.addEventListener('mouseenter', () => {
        pinButton.style.color = '#1890ff';
      });
      pinButton.addEventListener('mouseleave', () => {
        pinButton.style.color = '#999';
      });
      
      const modeInfo = document.createElement('div');
      modeInfo.style.cssText = `
        flex-grow: 1;
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        margin-left: 10px;
      `;
      modeInfo.innerHTML = `
        <span title="${mode.name}" style="font-size: 16px; font-weight: bold;">${mode.name.length > 10 ? mode.name.substring(0, 10) + '...' : mode.name}</span>
        ${currentMode.id === mode.id ? '<span class="selected-indicator">✓</span>' : ''}
      `;
      modeInfo.addEventListener('click', (e) => {
        e.stopPropagation();
        switchMode(mode);
      });
      
      const buttonsDiv = document.createElement('div');
      buttonsDiv.style.cssText = `
        display: flex;
        gap: 8px;
        opacity: 0;
        transition: opacity 0.2s;
      `;
      
      const editBtn = document.createElement('button');
      editBtn.textContent = '编辑';
      editBtn.style.cssText = `
        background-color: #4285f4;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 14px;
      `;
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        editMode(mode);
      });
      
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '删除';
      deleteBtn.style.cssText = `
        background-color: #f44336;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 14px;
      `;
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteMode(mode);
      });
      
      buttonsDiv.appendChild(editBtn);
      buttonsDiv.appendChild(deleteBtn);
      
      modeDiv.addEventListener('mouseenter', () => {
        buttonsDiv.style.opacity = '1';
        if (index > 0) {
          pinButton.style.display = 'flex';
        }
      });
      modeDiv.addEventListener('mouseleave', () => {
        buttonsDiv.style.opacity = '0';
        pinButton.style.display = 'none';
      });
      
      modeDiv.appendChild(pinButton);
      modeDiv.appendChild(modeInfo);
      modeDiv.appendChild(buttonsDiv);
      
      modeDropdownContent.appendChild(modeDiv);
    });
    
    const newAddModeItem = document.getElementById('add-mode-item');
    if (newAddModeItem) {
      newAddModeItem.addEventListener('click', handleAddModeClick);
    }
  }

  // 加载和显示提示词
  function loadPrompts() {
    storage.local.get('prompts').then(data => {
      const prompts = data.prompts || [];
      const filteredPrompts = prompts.filter(p => (p.modeId || 'default') === currentMode.id);
      displayPrompts(filteredPrompts);
    });
  }

  // 显示提示词列表
  function displayPrompts(prompts, searchTerm = '') {
    promptsList.innerHTML = '';
    
    const filteredPrompts = searchTerm 
      ? prompts.filter(p => 
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          p.content.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : prompts;
    
    filteredPrompts.forEach(function(prompt, index) {
      const promptItem = document.createElement('div');
      promptItem.className = 'prompt-item';
      promptItem.dataset.index = String(index);
      promptItem.dataset.content = prompt.content;
      
      const pinButton = document.createElement('div');
      pinButton.className = 'pinned-button';
      pinButton.innerHTML = '⬆︎';
      pinButton.addEventListener('click', function(e) {
        e.stopPropagation();
        pinPrompt(prompt.id);
      });
      
      const promptInfo = document.createElement('div');
      promptInfo.className = 'prompt-info';
      promptInfo.style.cursor = 'pointer';
      
      const promptName = document.createElement('div');
      promptName.className = 'prompt-name';
      promptName.textContent = prompt.name;
      
      const promptContent = document.createElement('div');
      promptContent.className = 'prompt-content';
      promptContent.textContent = prompt.content;
      
      promptInfo.appendChild(promptName);
      promptInfo.appendChild(promptContent);
      
      promptInfo.addEventListener('click', function() {
        copyToClipboard(prompt.content);
      });
      
      const buttons = document.createElement('div');
      buttons.className = 'buttons';
      
      const copyButton = document.createElement('button');
      copyButton.className = 'button';
      copyButton.textContent = '复制';
      copyButton.addEventListener('click', function(e) {
        e.stopPropagation();
        copyToClipboard(prompt.content);
      });
      
      const editButton = document.createElement('button');
      editButton.className = 'button';
      editButton.textContent = '编辑';
      editButton.addEventListener('click', function(e) {
        e.stopPropagation();
        editPrompt(prompt);
      });
      
      const deleteButton = document.createElement('button');
      deleteButton.className = 'button';
      deleteButton.textContent = '删除';
      deleteButton.addEventListener('click', function(e) {
        e.stopPropagation();
        deletePrompt(prompt.id);
      });
      
      buttons.appendChild(copyButton);
      buttons.appendChild(editButton);
      buttons.appendChild(deleteButton);
      
      promptItem.appendChild(pinButton);
      promptItem.appendChild(promptInfo);
      promptItem.appendChild(buttons);
      
      promptItem.addEventListener('mouseenter', function() {
        if (index > 0) {
          pinButton.style.display = 'flex';
        }
      });
      
      promptItem.addEventListener('mouseleave', function() {
        pinButton.style.display = 'none';
      });
      
      promptsList.appendChild(promptItem);
    });

    collectListItems();
  }

  // Mode下拉菜单事件
  modeButton.addEventListener('click', function(e) {
    e.stopPropagation();
    modeDropdown.classList.toggle('active');
  });

  document.addEventListener('click', function(e) {
    if (!modeDropdown.contains(e.target)) {
      modeDropdown.classList.remove('active');
      cancelAddMode();
    }
  });

  function handleAddModeClick(e) {
    e.stopPropagation();
    if (!isAddingMode) {
      showAddModeInput();
    }
  }

  function showAddModeInput() {
    isAddingMode = true;
    const addModeItem = document.getElementById('add-mode-item');
    addModeItem.innerHTML = `
      <div class="add-mode-input">
        <input type="text" id="new-mode-input" placeholder="模式名称 (≤10字符)" maxlength="10" />
        <button id="save-mode-btn">保存</button>
      </div>
    `;
    
    const input = document.getElementById('new-mode-input');
    const saveBtn = document.getElementById('save-mode-btn');
    
    input.focus();
    
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        saveNewMode();
      } else if (e.key === 'Escape') {
        cancelAddMode();
      }
    });
    
    saveBtn.addEventListener('click', saveNewMode);
  }

  function saveNewMode() {
    const input = document.getElementById('new-mode-input');
    const name = input.value.trim();
    
    if (name && name.length <= 10) {
      const newMode = {
        id: Date.now().toString(),
        name: name
      };
      
      modes.push(newMode);
      currentMode = newMode;
      
      storage.local.set({
        modes: modes,
        currentMode: currentMode
      }).then(() => {
        updateModeDisplay();
        renderModeDropdown();
        loadPrompts();
        modeDropdown.classList.remove('active');
        showToast('模式已添加');
      });
    }
    
    cancelAddMode();
  }

  function cancelAddMode() {
    if (isAddingMode) {
      isAddingMode = false;
      renderModeDropdown();
    }
  }

  function switchMode(mode) {
    currentMode = mode;
    storage.local.set({ currentMode: currentMode }).then(() => {
      updateModeDisplay();
      renderModeDropdown();
      loadPrompts();
      modeDropdown.classList.remove('active');
    });
  }

  function editMode(mode) {
    const modeItems = document.querySelectorAll('.mode-dropdown-item:not(.add-mode-item)');
    let targetModeItem = null;
    
    modeItems.forEach(item => {
      const span = item.querySelector('span[title]');
      if (span && span.getAttribute('title') === mode.name) {
        targetModeItem = item;
      }
    });
    
    if (!targetModeItem) return;
    
    const modeInfo = targetModeItem.querySelector('div[style*="flex-grow: 1"]') || 
                     targetModeItem.querySelector('div[style*="margin-left: 10px"]') ||
                     targetModeItem.children[1];
    
    if (!modeInfo) return;
    
    const originalContent = modeInfo.innerHTML;
    
    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.value = mode.name;
    editInput.maxLength = 10;
    
    const textWidth = Math.max(mode.name.length * 12, 60);
    const maxWidth = 120;
    const inputWidth = Math.min(textWidth, maxWidth);
    
    editInput.style.cssText = `
      font-size: 16px;
      font-weight: bold;
      border: 1px solid #4285f4;
      border-radius: 3px;
      padding: 2px 4px;
      outline: none;
      width: ${inputWidth}px;
      background-color: white;
      box-sizing: border-box;
      margin: 0;
    `;
    
    const editContainer = document.createElement('div');
    editContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
    `;
    
    editContainer.appendChild(editInput);
    
    if (currentMode.id === mode.id) {
      const checkmark = document.createElement('span');
      checkmark.className = 'selected-indicator';
      checkmark.textContent = '✓';
      editContainer.appendChild(checkmark);
    }
    
    modeInfo.innerHTML = '';
    modeInfo.appendChild(editContainer);
    
    editInput.focus();
    editInput.select();
    
    function saveEdit() {
      const newName = editInput.value.trim();
      if (newName && newName.length <= 10 && newName !== mode.name) {
        const modeIndex = modes.findIndex(m => m.id === mode.id);
        if (modeIndex !== -1) {
          modes[modeIndex].name = newName;
          
          if (currentMode.id === mode.id) {
            currentMode.name = newName;
          }
          
          storage.local.set({
            modes: modes,
            currentMode: currentMode
          }).then(() => {
            updateModeDisplay();
            renderModeDropdown();
            showToast(`模式 "${newName}" 已更新`);
          });
        }
      } else if (newName === mode.name || !newName) {
        modeInfo.innerHTML = originalContent;
      } else {
        modeInfo.innerHTML = originalContent;
      }
    }
    
    function cancelEdit() {
      modeInfo.innerHTML = originalContent;
    }
    
    editInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        saveEdit();
      } else if (e.key === 'Escape') {
        cancelEdit();
      }
    });
    
    const clickOutsideHandler = (e) => {
      if (!targetModeItem.contains(e.target)) {
        cancelEdit();
        document.removeEventListener('click', clickOutsideHandler);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', clickOutsideHandler);
    }, 100);
  }

  function deleteMode(mode) {
    if (modes.length <= 1) {
      showToast('至少需要保留一个模式');
      return;
    }
    
    if (confirm(`确定要删除模式 "${mode.name}" 吗？\n注意：该模式下的所有提示词也会被删除！`)) {
      if (currentMode.id === mode.id) {
        const otherMode = modes.find(m => m.id !== mode.id);
        if (otherMode) {
          currentMode = otherMode;
        }
      }
      
      modes = modes.filter(m => m.id !== mode.id);
      
      storage.local.get('prompts').then(data => {
        const prompts = data.prompts || [];
        const updatedPrompts = prompts.filter(p => (p.modeId || 'default') !== mode.id);
        
        storage.local.set({
          modes: modes,
          currentMode: currentMode,
          prompts: updatedPrompts
        }).then(() => {
          updateModeDisplay();
          renderModeDropdown();
          loadPrompts();
          showToast(`模式 "${mode.name}" 及其相关提示词已删除`);
        });
      });
    }
  }

  function editPrompt(prompt) {
    document.getElementById('editor-title').textContent = '编辑提示词';
    document.getElementById('prompt-id').value = prompt.id;
    document.getElementById('prompt-mode-id').value = prompt.modeId || currentMode.id;
    document.getElementById('prompt-name').value = prompt.name;
    document.getElementById('prompt-content').value = prompt.content;
    
    listView.classList.remove('active');
    editorView.classList.add('active');
  }

  promptEditor.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const id = document.getElementById('prompt-id').value;
    const modeId = document.getElementById('prompt-mode-id').value || currentMode.id;
    const name = document.getElementById('prompt-name').value.trim();
    const content = document.getElementById('prompt-content').value.trim();
    
    if (!name || !content) {
      showToast('名称和内容不能为空');
      return;
    }
    
    storage.local.get('prompts').then(data => {
      let prompts = data.prompts || [];
      
      if (id) {
        const index = prompts.findIndex(p => p.id === id);
        if (index !== -1) {
          prompts[index] = { id, name, content, modeId };
        }
      } else {
        const newId = Date.now().toString();
        prompts.push({ id: newId, name, content, modeId: currentMode.id });
      }
      
      storage.local.set({ prompts: prompts }).then(() => {
        showToast('提示词已保存');
        listView.classList.add('active');
        editorView.classList.remove('active');
        loadPrompts();
        
        // 清空表单
        document.getElementById('prompt-id').value = '';
        document.getElementById('prompt-name').value = '';
        document.getElementById('prompt-content').value = '';
      });
    });
  });

  function deletePrompt(id) {
    if (confirm('确定要删除这个提示词吗？')) {
      storage.local.get('prompts').then(data => {
        const prompts = data.prompts || [];
        const updatedPrompts = prompts.filter(p => p.id !== id);
        
        storage.local.set({ prompts: updatedPrompts }).then(() => {
          showToast('提示词已删除');
          loadPrompts();
        });
      });
    }
  }

  cancelButton.addEventListener('click', function() {
    listView.classList.add('active');
    editorView.classList.remove('active');
    
    // 清空表单
    document.getElementById('prompt-id').value = '';
    document.getElementById('prompt-name').value = '';
    document.getElementById('prompt-content').value = '';
  });

  searchInput.addEventListener('input', function() {
    const searchTerm = this.value.trim();
    storage.local.get('prompts').then(data => {
      const prompts = data.prompts || [];
      if (searchTerm) {
        // 全局搜索
        displayGlobalSearchResults(prompts, searchTerm);
      } else {
        // 显示当前模式
        const filteredPrompts = prompts.filter(p => (p.modeId || 'default') === currentMode.id);
        displayPrompts(filteredPrompts);
      }
    });
  });

  exportButton.addEventListener('click', function() {
    storage.local.get('prompts').then(data => {
      const prompts = data.prompts || [];
      const filteredPrompts = prompts.filter(p => (p.modeId || 'default') === currentMode.id);
      
      if (filteredPrompts.length === 0) {
        showToast('当前模式下没有提示词可以导出');
        return;
      }
      
      let exportText = '';
      filteredPrompts.forEach(prompt => {
        exportText += prompt.name + '\n' + prompt.content + '\n\n';
      });
      
      const blob = new Blob([exportText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `prompts_${currentMode.name}_export.txt`;
      a.click();
      
      URL.revokeObjectURL(url);
      showToast(`已导出 "${currentMode.name}" 模式下的 ${filteredPrompts.length} 个提示词`);
    });
  });

  function createImportDialog() {
    if (importDialog) {
      return;
    }
    
    importDialog = document.createElement('div');
    importDialog.style.position = 'fixed';
    importDialog.style.top = '0';
    importDialog.style.left = '0';
    importDialog.style.width = '100%';
    importDialog.style.height = '100%';
    importDialog.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    importDialog.style.display = 'flex';
    importDialog.style.justifyContent = 'center';
    importDialog.style.alignItems = 'center';
    importDialog.style.zIndex = '1000';
    
    const dialogContent = document.createElement('div');
    dialogContent.style.width = '90%';
    dialogContent.style.maxWidth = '550px';
    dialogContent.style.backgroundColor = 'white';
    dialogContent.style.borderRadius = '12px';
    dialogContent.style.padding = '24px';
    dialogContent.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.2)';
    dialogContent.style.maxHeight = '90vh';
    dialogContent.style.overflowY = 'auto';
    
    const title = document.createElement('h2');
    title.textContent = '导入提示词';
    title.style.margin = '0 0 15px 0';
    title.style.fontSize = '20px';
    
    const instructions = document.createElement('p');
    instructions.textContent = '请输入提示词内容（格式：标题和内容用空行分隔）';
    instructions.style.marginBottom = '15px';
    instructions.style.color = '#666';
    
    importTextarea = document.createElement('textarea');
    importTextarea.style.width = '100%';
    importTextarea.style.height = '200px';
    importTextarea.style.padding = '12px';
    importTextarea.style.borderRadius = '8px';
    importTextarea.style.border = '2px solid #ddd';
    importTextarea.style.marginBottom = '15px';
    importTextarea.style.resize = 'vertical';
    importTextarea.style.fontFamily = 'inherit';
    importTextarea.style.fontSize = '14px';
    importTextarea.placeholder = '示例：\n标题1\n内容1\n\n标题2\n内容2';
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.marginBottom = '10px';
    
    deleteAllButton = document.createElement('button');
    deleteAllButton.textContent = '清空当前模式';
    deleteAllButton.style.padding = '10px 15px';
    deleteAllButton.style.backgroundColor = '#f44336';
    deleteAllButton.style.color = 'white';
    deleteAllButton.style.border = 'none';
    deleteAllButton.style.borderRadius = '8px';
    deleteAllButton.style.cursor = 'pointer';
    deleteAllButton.style.fontSize = '14px';
    deleteAllButton.style.fontWeight = '600';
    
    cancelImportButton = document.createElement('button');
    cancelImportButton.textContent = '取消';
    cancelImportButton.style.padding = '10px 15px';
    cancelImportButton.style.backgroundColor = '#f1f1f1';
    cancelImportButton.style.color = '#333';
    cancelImportButton.style.border = 'none';
    cancelImportButton.style.borderRadius = '8px';
    cancelImportButton.style.cursor = 'pointer';
    cancelImportButton.style.fontSize = '14px';
    cancelImportButton.style.fontWeight = '600';
    
    importButton2 = document.createElement('button');
    importButton2.textContent = '导入';
    importButton2.style.padding = '10px 15px';
    importButton2.style.backgroundColor = '#4285f4';
    importButton2.style.color = 'white';
    importButton2.style.border = 'none';
    importButton2.style.borderRadius = '8px';
    importButton2.style.cursor = 'pointer';
    importButton2.style.fontSize = '14px';
    importButton2.style.fontWeight = '600';
    
    buttonContainer.appendChild(deleteAllButton);
    buttonContainer.appendChild(cancelImportButton);
    buttonContainer.appendChild(importButton2);
    
    dialogContent.appendChild(title);
    dialogContent.appendChild(instructions);
    dialogContent.appendChild(importTextarea);
    dialogContent.appendChild(buttonContainer);
    
    importDialog.appendChild(dialogContent);
    document.body.appendChild(importDialog);
    
    cancelImportButton.addEventListener('click', hideImportDialog);
    importButton2.addEventListener('click', importPrompts);
    deleteAllButton.addEventListener('click', deleteAllPrompts);
  }

  function showImportDialog() {
    createImportDialog();
    importDialog.style.display = 'flex';
    importTextarea.value = '';
    setTimeout(() => importTextarea.focus(), 100);
  }

  function hideImportDialog() {
    if (importDialog) {
      importDialog.style.display = 'none';
    }
  }

  function importPrompts() {
    const text = importTextarea.value.trim();
    if (!text) {
      showToast('请输入提示词内容');
      return;
    }
    
    const promptTexts = text.split(/\n\s*\n/);
    const newPrompts = [];
    
    let invalidCount = 0;
    
    promptTexts.forEach(promptText => {
      const lines = promptText.trim().split('\n');
      if (lines.length >= 2) {
        const name = lines[0].trim();
        const content = lines.slice(1).join('\n').trim();
        
        if (name && content) {
          newPrompts.push({
            id: Date.now() + '-' + newPrompts.length,
            name: name,
            content: content,
            modeId: currentMode.id
          });
        } else {
          invalidCount++;
        }
      } else {
        invalidCount++;
      }
    });
    
    if (newPrompts.length === 0) {
      showToast('没有有效的提示词可以导入');
      return;
    }
    
    storage.local.get('prompts').then(data => {
      const existingPrompts = data.prompts || [];
      const updatedPrompts = existingPrompts.concat(newPrompts);
      
      storage.local.set({ prompts: updatedPrompts }).then(() => {
        hideImportDialog();
        loadPrompts();
        
        const message = `成功导入 ${newPrompts.length} 个提示词` + 
                       (invalidCount > 0 ? `，${invalidCount} 个格式无效被忽略` : '');
        showToast(message);
      });
    });
  }

  function deleteAllPrompts() {
    if (confirm(`确定要删除 "${currentMode.name}" 模式下的所有提示词吗？此操作不可恢复！`)) {
      storage.local.get('prompts').then(data => {
        const prompts = data.prompts || [];
        const updatedPrompts = prompts.filter(p => (p.modeId || 'default') !== currentMode.id);
        
        storage.local.set({ prompts: updatedPrompts }).then(() => {
          hideImportDialog();
          loadPrompts();
          showToast(`"${currentMode.name}" 模式下的提示词已全部删除`);
        });
      });
    }
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(function() {
      toast.style.opacity = '0';
      
      setTimeout(function() {
        if (toast.parentNode) {
          document.body.removeChild(toast);
        }
      }, 500);
    }, 3000);
  }

  importButton.addEventListener('click', showImportDialog);

  async function copyToClipboard(text) {
    try {
      await clipboard.writeText(text);
      showToast('已复制到剪贴板');
      // 复制成功后自动隐藏窗口
      try {
        setTimeout(() => { try { window.electronAPI.window.hide(); } catch (_) {} }, 50);
      } catch (_) {}
    } catch (err) {
      console.error('复制失败:', err);
      showToast('复制失败');
    }
  }

  // 将提示词插入到光标位置
  async function insertPromptAtCursor(text) {
    try {
      // 1. 先复制到剪贴板
      await clipboard.writeText(text);
      
      // 2. 隐藏窗口
      try {
        await window.electronAPI.window.hide();
      } catch (_) {}
      
      // 3. 等待窗口隐藏完成，然后模拟粘贴操作
      setTimeout(async () => {
        try {
          await window.electronAPI.pasteText();
          showToast('提示词已插入');
        } catch (err) {
          console.error('插入失败:', err);
          showToast('插入失败，内容已复制到剪贴板');
        }
      }, 100);
      
    } catch (err) {
      console.error('插入失败:', err);
      showToast('插入失败');
    }
  }

  function pinPrompt(id) {
    storage.local.get('prompts').then(data => {
      const prompts = data.prompts || [];
      
      const currentModePrompts = [];
      prompts.forEach((prompt, index) => {
        if ((prompt.modeId || 'default') === currentMode.id) {
          currentModePrompts.push({ prompt, globalIndex: index });
        }
      });
      
      const currentModeIndex = currentModePrompts.findIndex(item => item.prompt.id === id);
      
      if (currentModeIndex > 0) {
        const currentItem = currentModePrompts[currentModeIndex];
        const previousItem = currentModePrompts[currentModeIndex - 1];
        
        const temp = prompts[currentItem.globalIndex];
        prompts[currentItem.globalIndex] = prompts[previousItem.globalIndex];
        prompts[previousItem.globalIndex] = temp;
        
        storage.local.set({ prompts: prompts }).then(() => {
          showToast('提示词已上移');
          loadPrompts();
        });
      } else {
        showToast('已经是当前模式的第一个提示词');
      }
    });
  }

  function pinMode(id) {
    const index = modes.findIndex(m => m.id === id);
    
    if (index > 0) {
      const temp = modes[index];
      modes[index] = modes[index - 1];
      modes[index - 1] = temp;
      
      storage.local.set({ modes: modes }).then(() => {
        showToast('模式已上移');
        renderModeDropdown();
      });
    }
  }

  function displayGlobalSearchResults(prompts, searchTerm) {
    promptsList.innerHTML = '';
    
    const searchResults = prompts.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.content.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (searchResults.length === 0) {
      const noResultsDiv = document.createElement('div');
      noResultsDiv.style.cssText = `
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 200px;
        color: #999;
        font-size: 16px;
      `;
      noResultsDiv.textContent = '没有找到匹配的提示词';
      promptsList.appendChild(noResultsDiv);
      return;
    }
    
    searchResults.forEach(function(prompt, index) {
      const promptItem = document.createElement('div');
      promptItem.className = 'prompt-item';
      promptItem.dataset.index = String(index);
      promptItem.dataset.content = prompt.content;
      
      const promptInfo = document.createElement('div');
      promptInfo.className = 'prompt-info';
      promptInfo.style.cursor = 'pointer';
      
      const promptName = document.createElement('div');
      promptName.className = 'prompt-name';
      promptName.textContent = prompt.name;
      
      const modeTag = document.createElement('div');
      const modeName = modes.find(m => m.id === (prompt.modeId || 'default'))?.name || '看书';
      modeTag.style.cssText = `
        display: inline-block;
        background-color: #e8f0fe;
        color: #1a73e8;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 12px;
        margin-left: 8px;
        vertical-align: middle;
      `;
      modeTag.textContent = modeName;
      
      const nameContainer = document.createElement('div');
      nameContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
      `;
      nameContainer.appendChild(promptName);
      nameContainer.appendChild(modeTag);
      
      const promptContent = document.createElement('div');
      promptContent.className = 'prompt-content';
      promptContent.textContent = prompt.content;
      
      promptInfo.appendChild(nameContainer);
      promptInfo.appendChild(promptContent);
      
      promptInfo.addEventListener('click', function() {
        copyToClipboard(prompt.content);
      });
      
      const buttons = document.createElement('div');
      buttons.className = 'buttons';
      
      const copyButton = document.createElement('button');
      copyButton.className = 'button';
      copyButton.textContent = '复制';
      copyButton.addEventListener('click', function(e) {
        e.stopPropagation();
        copyToClipboard(prompt.content);
      });
      
      const editButton = document.createElement('button');
      editButton.className = 'button';
      editButton.textContent = '编辑';
      editButton.addEventListener('click', function(e) {
        e.stopPropagation();
        editPrompt(prompt);
      });
      
      const deleteButton = document.createElement('button');
      deleteButton.className = 'button';
      deleteButton.textContent = '删除';
      deleteButton.addEventListener('click', function(e) {
        e.stopPropagation();
        deletePrompt(prompt.id);
      });
      
      buttons.appendChild(copyButton);
      buttons.appendChild(editButton);
      buttons.appendChild(deleteButton);
      
      promptItem.appendChild(promptInfo);
      promptItem.appendChild(buttons);
      
      promptsList.appendChild(promptItem);
    });

    collectListItems();
  }

  // 键盘导航
  document.addEventListener('keydown', function(e) {
    if (!listView.classList.contains('active')) return;

    if (importDialog && importDialog.style && importDialog.style.display === 'flex') {
      return;
    }

    const isArrow = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key);
    if (isArrow && document.activeElement === searchInput) {
      e.preventDefault();
    }

    if (!listItems.length) return;

    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowLeft':
        updateSelection(selectedIndex - 1);
        break;
      case 'ArrowDown':
      case 'ArrowRight':
        updateSelection(selectedIndex + 1);
        break;
      case 'Enter':
        if (selectedIndex >= 0 && selectedIndex < listItems.length) {
          const el = listItems[selectedIndex];
          const content = el.dataset.content || '';
          if (content) {
            copyToClipboard(content);
            e.preventDefault();
          }
        }
        break;
      default:
        return;
    }
  });

  

  // 初始化
  init();
});
