const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 存储操作
  storage: {
    get: (keys) => ipcRenderer.invoke('storage-get', keys),
    set: (items) => ipcRenderer.invoke('storage-set', items),
    remove: (keys) => ipcRenderer.invoke('storage-remove', keys),
    clear: () => ipcRenderer.invoke('storage-clear'),
    // 监听存储变化 (简化版,不支持同步到其他窗口)
    onChanged: (callback) => {
      // Electron Store 不支持实时监听，这里提供空实现
      // 如果需要可以通过 IPC 自己实现
      return { 
        addListener: () => {},
        removeListener: () => {}
      };
    }
  },
  
  // 剪贴板操作
  clipboard: {
    writeText: (text) => ipcRenderer.invoke('copy-to-clipboard', text)
  },
  
  // 粘贴文本到光标位置
  pasteText: () => ipcRenderer.invoke('paste-text'),
  
  // 窗口操作
  window: {
    hide: () => ipcRenderer.invoke('hide-window'),
    minimize: () => ipcRenderer.invoke('minimize-window'),
    close: () => ipcRenderer.invoke('hide-window'),
    quit: () => ipcRenderer.invoke('quit-app'),
    onShown: (callback) => {
      ipcRenderer.on('window-shown', callback);
      return () => ipcRenderer.removeListener('window-shown', callback);
    }
  },
  
  // 外部链接
  shell: {
    openExternal: (url) => ipcRenderer.invoke('open-external', url)
  },
  
  // 标识这是 Electron 环境
  isElectron: true
});

