// Tauri API 适配器 - 让现有代码兼容 Tauri 和 Electron
(function() {
  'use strict';

  // 检测运行环境
  const isTauri = window.__TAURI__ !== undefined;
  const isElectron = window.electronAPI !== undefined;

  console.log('[Adapter] isTauri:', isTauri, 'isElectron:', isElectron);
  console.log('[Adapter] __TAURI__:', window.__TAURI__);

  if (isTauri) {
    console.log('[Adapter] Running in Tauri environment');
    
    // Tauri 2.0 API - 安全获取
    const invoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.tauri?.invoke;
    const getCurrentWindow = window.__TAURI__?.window?.getCurrentWindow;
    
    console.log('[Adapter] invoke:', typeof invoke, 'getCurrentWindow:', typeof getCurrentWindow);
    
    // 创建与 Electron API 兼容的接口
    window.electronAPI = {
      // 存储 API（使用 localStorage，简单可靠）
      storage: {
        get: async (keys) => {
          if (Array.isArray(keys)) {
            const result = {};
            keys.forEach(key => {
              const val = localStorage.getItem(key);
              result[key] = val ? JSON.parse(val) : undefined;
            });
            return result;
          } else if (typeof keys === 'string') {
            const val = localStorage.getItem(keys);
            return { [keys]: val ? JSON.parse(val) : undefined };
          }
          return {};
        },
        set: async (items) => {
          for (const [key, value] of Object.entries(items)) {
            localStorage.setItem(key, JSON.stringify(value));
          }
          return true;
        },
        remove: async (keys) => {
          const keysArr = Array.isArray(keys) ? keys : [keys];
          keysArr.forEach(key => localStorage.removeItem(key));
          return true;
        },
        clear: async () => {
          localStorage.clear();
          return true;
        }
      },

      // 剪贴板 API
      clipboard: {
        writeText: async (text) => {
          await invoke('write_clipboard', { text });
        }
      },

      // 窗口 API
      window: {
        hide: async () => {
          try {
            const win = getCurrentWindow();
            await win.hide();
          } catch (e) { console.error('hide error:', e); }
        },
        minimize: async () => {
          try {
            const win = getCurrentWindow();
            await win.minimize();
          } catch (e) { console.error('minimize error:', e); }
        },
        close: async () => {
          try {
            const win = getCurrentWindow();
            await win.close();
          } catch (e) { console.error('close error:', e); }
        },
        show: async () => {
          try {
            const win = getCurrentWindow();
            await win.show();
            await win.setFocus();
          } catch (e) { console.error('show error:', e); }
        },
        // Electron 特有的事件监听 - 提供空实现
        onShown: (callback) => {
          // Tauri 没有直接等效的 API，但窗口显示时会自动触发
          console.log('[Adapter] onShown registered (no-op in Tauri)');
        }
      },

      // 粘贴 API（使用 CGEvent）
      pasteText: async () => {
        return await invoke('paste_text');
      },

      // 一步完成：写入剪贴板 + 粘贴
      insertAndPaste: async (text) => {
        return await invoke('insert_and_paste', { text });
      },

      // 检查权限
      checkPermission: async () => {
        return await invoke('check_permission');
      },

      // 打开外部链接
      openExternal: async (url) => {
        window.open(url, '_blank');
      }
    };

    // 注册全局快捷键 Shift+Cmd+P
    async function setupShortcut() {
      try {
        const register = window.__TAURI__.globalShortcut?.register;
        if (register) {
          await register('Shift+CommandOrControl+P', async () => {
            const win = getCurrentWindow();
            const visible = await win.isVisible();
            if (visible) {
              await win.hide();
            } else {
              await win.show();
              await win.setFocus();
            }
          });
          console.log('[Adapter] Global shortcut registered');
        }
      } catch (e) {
        console.error('[Adapter] Failed to register shortcut:', e);
      }
    }

    // 初始化
    setupShortcut();

  } else if (isElectron) {
    console.log('[Adapter] Running in Electron environment');
    // Electron 环境下不需要做任何事情，electronAPI 已经存在
  } else {
    console.warn('[Adapter] Unknown environment, API may not work');
  }
})();
