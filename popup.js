document.addEventListener('DOMContentLoaded', function() {
  // DOM元素
  const searchInput = document.getElementById('search-input');
  const promptsList = document.getElementById('prompts-list');
  const addPromptButton = document.getElementById('add-prompt-button');
  const exportButton = document.getElementById('export-button');
  const importButton = document.getElementById('import-button');
  const editorView = document.getElementById('editor-view');
  const listView = document.getElementById('list-view');
  const promptEditor = document.getElementById('prompt-editor');
  const cancelButton = document.getElementById('cancel-button');
  
  // 处理捐赠链接点击
  const donateLink = document.querySelector('.donate-container a');
  if (donateLink) {
    donateLink.addEventListener('click', function(e) {
      e.preventDefault();
      chrome.tabs.create({ url: 'donate.html' });
    });
  }
  
  // 导入对话框相关元素和变量
  let importDialog = null;
  let importTextarea = null;
  let importButton2 = null;
  let cancelImportButton = null;
  let deleteAllButton = null;

  // 加载和显示提示词
  function loadPrompts() {
    chrome.storage.local.get('prompts', function(data) {
      const prompts = data.prompts || [];
      displayPrompts(prompts);
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
      
      // 添加上移按钮
      const pinButton = document.createElement('div');
      pinButton.className = 'pinned-button';
      pinButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20px" height="20px"><path d="M17 8h1.08l1.38-1.5A7.98 7.98 0 0 0 10.5 1.08l-1.47 1.4L9 4h1.08c.67 0 1.31.14 1.9.38L10 9.403V5h1.5v7h-6v-1.5h4l2.3865-6.1564c-.3968-.1215-.809-.0046-1.2135-.0346H10v-.809Zm-9.5 8.5a4,.99 0 1 0 2 3 .99.99 0 0 0-2-3Z"/></svg>';
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
      
      // 添加点击事件，模拟斜杠命令菜单的Enter键功能
      promptInfo.addEventListener('click', function() {
        // 向background发送消息，请求插入提示词
        chrome.runtime.sendMessage({
          action: 'insertPrompt',
          content: prompt.content
        }, function(response) {
          // 关闭popup
          window.close();
        });
      });
      
      const buttons = document.createElement('div');
      buttons.className = 'buttons';
      
      // 添加复制按钮
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
      
      // 添加鼠标悬停事件以显示/隐藏置顶按钮
      promptItem.addEventListener('mouseenter', function() {
        if (index > 0) { // 只有非第一个项目才显示上移按钮
          pinButton.style.display = 'flex';
        }
      });
      
      promptItem.addEventListener('mouseleave', function() {
        pinButton.style.display = 'none';
      });
      
      promptsList.appendChild(promptItem);
    });
  }

  // 添加新提示词
  addPromptButton.addEventListener('click', function() {
    document.getElementById('editor-title').textContent = '';
    document.getElementById('prompt-id').value = '';
    document.getElementById('prompt-name').value = '';
    document.getElementById('prompt-content').value = '';
    
    listView.classList.remove('active');
    editorView.classList.add('active');
  });

  // 编辑提示词
  function editPrompt(prompt) {
    document.getElementById('editor-title').textContent = '';
    document.getElementById('prompt-id').value = prompt.id;
    document.getElementById('prompt-name').value = prompt.name;
    document.getElementById('prompt-content').value = prompt.content;
    
    listView.classList.remove('active');
    editorView.classList.add('active');
  }

  // 保存提示词
  promptEditor.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const id = document.getElementById('prompt-id').value;
    const name = document.getElementById('prompt-name').value.trim();
    const content = document.getElementById('prompt-content').value.trim();
    
    if (!name || !content) {
      showToast('名称和内容不能为空');
      return;
    }
    
    chrome.storage.local.get('prompts', function(data) {
      let prompts = data.prompts || [];
      
      if (id) {
        // 更新现有提示词
        const index = prompts.findIndex(p => p.id === id);
        if (index !== -1) {
          prompts[index] = { id, name, content };
        }
      } else {
        // 添加新提示词
        const newId = Date.now().toString();
        prompts.push({ id: newId, name, content });
      }
      
      chrome.storage.local.set({ prompts: prompts }, function() {
        showToast('提示词已保存');
        listView.classList.add('active');
        editorView.classList.remove('active');
        loadPrompts();
      });
    });
  });

  // 删除提示词
  function deletePrompt(id) {
    if (confirm('确定要删除这个提示词吗？')) {
      chrome.storage.local.get('prompts', function(data) {
        const prompts = data.prompts || [];
        const updatedPrompts = prompts.filter(p => p.id !== id);
        
        chrome.storage.local.set({ prompts: updatedPrompts }, function() {
          showToast('提示词已删除');
          loadPrompts();
        });
      });
    }
  }

  // 取消编辑
  cancelButton.addEventListener('click', function() {
    listView.classList.add('active');
    editorView.classList.remove('active');
  });

  // 搜索功能
  searchInput.addEventListener('input', function() {
    const searchTerm = this.value.trim();
    chrome.storage.local.get('prompts', function(data) {
      const prompts = data.prompts || [];
      displayPrompts(prompts, searchTerm);
    });
  });

  // 导出功能
  exportButton.addEventListener('click', function() {
    chrome.storage.local.get('prompts', function(data) {
      const prompts = data.prompts || [];
      if (prompts.length === 0) {
        showToast('没有提示词可以导出');
        return;
      }
      
      let exportText = '';
      prompts.forEach(prompt => {
        exportText += prompt.name + '\n' + prompt.content + '\n\n';
      });
      
      const blob = new Blob([exportText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'prompts_export.txt';
      a.click();
      
      URL.revokeObjectURL(url);
      showToast('提示词已导出');
    });
  });

  // 创建导入对话框
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
    dialogContent.style.borderRadius = '8px';
    dialogContent.style.padding = '20px';
    dialogContent.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
    dialogContent.style.maxHeight = '90vh';
    dialogContent.style.overflowY = 'auto';
    
    const title = document.createElement('h2');
    title.textContent = '';
    title.style.margin = '0 0 15px 0';
    
    const instructions = document.createElement('p');
    instructions.textContent = '';
    instructions.style.marginBottom = '15px';
    
    importTextarea = document.createElement('textarea');
    importTextarea.style.width = '100%';
    importTextarea.style.height = '200px';
    importTextarea.style.padding = '10px';
    importTextarea.style.borderRadius = '4px';
    importTextarea.style.border = '1px solid #ddd';
    importTextarea.style.marginBottom = '15px';
    importTextarea.style.resize = 'vertical';
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.marginBottom = '10px';
    buttonContainer.style.flexWrap = 'wrap';
    
    // 全部删除按钮
    deleteAllButton = document.createElement('button');
    deleteAllButton.textContent = '全部删除';
    deleteAllButton.style.padding = '10px 15px';
    deleteAllButton.style.backgroundColor = '#f44336';
    deleteAllButton.style.color = 'white';
    deleteAllButton.style.border = 'none';
    deleteAllButton.style.borderRadius = '4px';
    deleteAllButton.style.cursor = 'pointer';
    deleteAllButton.style.margin = '5px';
    
    cancelImportButton = document.createElement('button');
    cancelImportButton.textContent = '取消';
    cancelImportButton.style.padding = '10px 15px';
    cancelImportButton.style.backgroundColor = '#f1f1f1';
    cancelImportButton.style.color = '#333';
    cancelImportButton.style.border = 'none';
    cancelImportButton.style.borderRadius = '4px';
    cancelImportButton.style.cursor = 'pointer';
    cancelImportButton.style.margin = '5px';
    
    importButton2 = document.createElement('button');
    importButton2.textContent = '导入';
    importButton2.style.padding = '10px 15px';
    importButton2.style.backgroundColor = '#4285f4';
    importButton2.style.color = 'white';
    importButton2.style.border = 'none';
    importButton2.style.borderRadius = '4px';
    importButton2.style.cursor = 'pointer';
    importButton2.style.margin = '5px';
    
    buttonContainer.appendChild(deleteAllButton);
    buttonContainer.appendChild(cancelImportButton);
    buttonContainer.appendChild(importButton2);
    
    dialogContent.appendChild(title);
    dialogContent.appendChild(instructions);
    dialogContent.appendChild(importTextarea);
    dialogContent.appendChild(buttonContainer);
    
    importDialog.appendChild(dialogContent);
    document.body.appendChild(importDialog);
    
    // 添加事件监听器
    cancelImportButton.addEventListener('click', hideImportDialog);
    importButton2.addEventListener('click', importPrompts);
    deleteAllButton.addEventListener('click', deleteAllPrompts);
  }

  // 显示导入对话框
  function showImportDialog() {
    createImportDialog();
    importDialog.style.display = 'flex';
    importTextarea.value = '';
    
    // 添加示例文本作为placeholder
    importTextarea.placeholder = '示例：\nTitle(1)\nPrompts(1)\n\nTitle(2)\nPrompts(2)\n\n注意：\n请输入文本内容，每个提示词之间用空行分隔';
  }

  // 隐藏导入对话框
  function hideImportDialog() {
    if (importDialog) {
      importDialog.style.display = 'none';
    }
  }

  // 导入提示词
  function importPrompts() {
    const text = importTextarea.value.trim();
    if (!text) {
      showToast('请输入提示词内容');
      return;
    }
    
    // 按空行分割提示词
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
            content: content
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
    
    chrome.storage.local.get('prompts', function(data) {
      const existingPrompts = data.prompts || [];
      const updatedPrompts = existingPrompts.concat(newPrompts);
      
      chrome.storage.local.set({ prompts: updatedPrompts }, function() {
        hideImportDialog();
        loadPrompts();
        
        const message = `成功导入 ${newPrompts.length} 个提示词` + 
                       (invalidCount > 0 ? `，${invalidCount} 个格式无效被忽略` : '');
        showToast(message);
      });
    });
  }

  // 删除所有提示词
  function deleteAllPrompts() {
    if (confirm('确定要删除所有提示词吗？此操作不可恢复！')) {
      chrome.storage.local.set({ prompts: [] }, function() {
        hideImportDialog();
        loadPrompts();
        showToast('所有提示词已删除');
      });
    }
  }

  // 显示消息提示
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.5s';
      
      setTimeout(function() {
        document.body.removeChild(toast);
      }, 500);
    }, 3000);
  }

  // 添加导入按钮样式
  function styleImportButton() {
    importButton.style.padding = '10px 15px';
    importButton.style.backgroundColor = '#4285f4';
    importButton.style.color = 'white';
    importButton.style.textAlign = 'center';
    importButton.style.border = 'none';
    importButton.style.borderRadius = '8px';
    importButton.style.cursor = 'pointer';
    importButton.style.fontSize = '14px';
  }

  // 导入提示词按钮事件
  importButton.addEventListener('click', showImportDialog);

  // 添加复制到剪贴板功能
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
      .then(() => {
        showToast('已复制到剪贴板');
      })
      .catch(err => {
        console.error('复制失败:', err);
        showToast('复制失败');
      });
  }

  // 上移提示词功能
  function pinPrompt(id) {
    chrome.storage.local.get('prompts', function(data) {
      const prompts = data.prompts || [];
      const index = prompts.findIndex(p => p.id === id);
      
      if (index > 0) {
        // 交换当前提示词与上一个提示词的位置
        const temp = prompts[index];
        prompts[index] = prompts[index - 1];
        prompts[index - 1] = temp;
        
        chrome.storage.local.set({ prompts: prompts }, function() {
          showToast('提示词已上移');
          loadPrompts();
        });
      }
    });
  }

  // 初始化
  styleImportButton();
  loadPrompts();
});