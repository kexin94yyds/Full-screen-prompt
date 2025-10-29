const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const Store = require('electron-store');
const path = require('path');

// 初始化存储
const store = new Store();

let mainWindow = null;
let lastShowAt = 0; // 记录最近一次显示时间，用于忽略刚显示时的 blur

// 创建主窗口
function createWindow() {
  // 获取屏幕尺寸（主显示器）
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  mainWindow = new BrowserWindow({
    width: 394,
    height: 646,
    x: Math.floor((width - 394) / 2),
    y: Math.floor((height - 646) / 2),
    show: false,
    frame: true,
    titleBarStyle: 'hiddenInset',
    title: '',
    resizable: true,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    }
  });

  // 不额外设置层级/工作区，让窗口保持默认行为

  // 加载主界面
  mainWindow.loadFile('app.html');

  // 窗口关闭时隐藏而不是退出
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // 当窗口准备显示时才显示，避免闪烁
  mainWindow.once('ready-to-show', () => {
    // 不自动显示，等待快捷键触发
  });

  // 失去焦点时隐藏窗口
  mainWindow.on('blur', () => {
    // 如果是刚显示后的短暂失焦（切 Space/全屏/层级切换），忽略本次隐藏
    const elapsed = Date.now() - lastShowAt;
    if (elapsed < 800) return;
    // 延迟隐藏，以便用户可以点击窗口内的按钮
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isFocused()) {
        mainWindow.hide();
      }
    }, 200);
  });
}

// 在当前活动的 Space/全屏上显示窗口，并跟随鼠标所在显示器
function showOnActiveSpace() {
  if (!mainWindow) return;

  // 定位到鼠标所在显示器居中
  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  const workArea = display.workArea; // { x, y, width, height }
  const { width: winW, height: winH } = mainWindow.getBounds();
  const targetX = Math.round(workArea.x + (workArea.width - winW) / 2);
  const targetY = Math.round(workArea.y + (workArea.height - winH) / 3); // 稍微靠上
  mainWindow.setPosition(targetX, targetY);

  // 临时允许跨所有工作区（含全屏）显示以避免切 Space
  try { mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch (_) {}
  // 提升层级，确保覆盖全屏
  try { mainWindow.setAlwaysOnTop(true, 'screen-saver'); } catch (_) {}

  mainWindow.show();
  mainWindow.focus();
  lastShowAt = Date.now();

  // 显示后短暂延时再还原到当前 Space，避免后续空间切换副作用
  setTimeout(() => {
    try { mainWindow.setVisibleOnAllWorkspaces(false); } catch (_) {}
  }, 100);

  // 通知渲染进程窗口已显示，可以聚焦搜索框
  mainWindow.webContents.send('window-shown');
}

// 切换窗口显示/隐藏
function toggleWindow() {
  if (!mainWindow) {
    createWindow();
  }

  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    showOnActiveSpace();
  }
}

// 当 Electron 完成初始化后创建窗口
app.whenReady().then(() => {
  createWindow();

  // 注册全局快捷键 Shift+Cmd+O
  const ret = globalShortcut.register('Shift+CommandOrControl+O', () => {
    toggleWindow();
  });

  if (!ret) {
    console.log('快捷键注册失败');
  }

  // 在 macOS 上，当所有窗口关闭时应用不会退出
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      toggleWindow();
    }
  });
});

// 退出应用前取消注册快捷键
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// 在 macOS 外的平台上，关闭所有窗口时退出应用
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC 通信处理 - 存储操作
ipcMain.handle('storage-get', async (event, keys) => {
  if (Array.isArray(keys)) {
    const result = {};
    keys.forEach(key => {
      result[key] = store.get(key);
    });
    return result;
  } else if (typeof keys === 'string') {
    return { [keys]: store.get(keys) };
  } else if (keys === null || keys === undefined) {
    return store.store;
  }
  return {};
});

ipcMain.handle('storage-set', async (event, items) => {
  Object.keys(items).forEach(key => {
    store.set(key, items[key]);
  });
  return true;
});

ipcMain.handle('storage-remove', async (event, keys) => {
  if (Array.isArray(keys)) {
    keys.forEach(key => store.delete(key));
  } else {
    store.delete(keys);
  }
  return true;
});

ipcMain.handle('storage-clear', async () => {
  store.clear();
  return true;
});

// 复制到剪贴板
ipcMain.handle('copy-to-clipboard', async (event, text) => {
  const { clipboard } = require('electron');
  clipboard.writeText(text);
  return true;
});

// 隐藏窗口
ipcMain.handle('hide-window', async () => {
  if (mainWindow) {
    mainWindow.hide();
  }
  return true;
});

// 最小化窗口
ipcMain.handle('minimize-window', async () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
  return true;
});

// 关闭应用
ipcMain.handle('quit-app', async () => {
  app.isQuitting = true;
  app.quit();
  return true;
});

// 打开外部链接
ipcMain.handle('open-external', async (event, url) => {
  const { shell } = require('electron');
  await shell.openExternal(url);
  return true;
});

// 模拟粘贴操作（使用 AppleScript 在 macOS 上模拟 Cmd+V）
ipcMain.handle('paste-text', async () => {
  const { exec } = require('child_process');
  
  return new Promise((resolve, reject) => {
    // 在 macOS 上使用 osascript 模拟 Cmd+V 快捷键
    if (process.platform === 'darwin') {
      const script = `
        tell application "System Events"
          keystroke "v" using command down
        end tell
      `;
      
      exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
        if (error) {
          console.error('粘贴失败:', error);
          reject(error);
        } else {
          resolve(true);
        }
      });
    } else {
      // 其他平台暂不支持
      reject(new Error('当前平台不支持自动粘贴'));
    }
  });
});
