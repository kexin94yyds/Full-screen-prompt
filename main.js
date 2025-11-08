const { app, BrowserWindow, globalShortcut, ipcMain, screen, dialog } = require('electron');
const Store = require('electron-store');
const path = require('path');
const { exec } = require('child_process');

// 初始化存储
const store = new Store();

// 单实例锁，避免多个实例导致快捷键冲突/旧实例抢占
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow = null;
let lastShowAt = 0; // 记录最近一次显示时间，用于忽略刚显示时的 blur
let lastFrontAppName = null; // 记录唤起窗口前的前台应用名称

// 判断是否为 macOS TCC 无辅助功能权限（1002）错误
function isTccDeniedError(err) {
  const msg = String((err && (err.stderr || err.message)) || '');
  return msg.includes('不允许发送按键') || msg.includes('not allowed to send keystrokes') || msg.includes(' 1002');
}

// 打开系统“隐私与安全性 > 辅助功能”设置页（尽量兼容不同版本）
function openAccessibilityPane() {
  // 方式一：通过 x-apple 链接直接打开对应设置页
  try { exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"'); } catch (_) {}
  // 方式二：回退到 AppleScript 定位到隐私-辅助功能（兼容不同系统版本）
  setTimeout(() => {
    const osaScript = `
try
tell application "System Settings"
  reveal anchor "Privacy_Accessibility" of pane id "com.apple.preference.security"
  activate
end tell
end try
try
tell application "System Preferences"
  reveal anchor "Privacy_Accessibility" of pane id "com.apple.preference.security"
  activate
end tell
end try
`.trim();
    try { exec(`osascript -e '${osaScript}'`); } catch (_) {}
  }, 150);
}

// 首次遇到 TCC 拒绝时给出友好指引
async function promptAccessibilityOnce() {
  const key = 'tcc.accessibility.prompted';
  const prompted = !!store.get(key);
  if (!prompted) store.set(key, true);

  const detailCn = [
    'macOS 拒绝了自动粘贴（辅助功能权限未开启）。',
    '请前往：系统设置 → 隐私与安全性 → 辅助功能，',
    '勾选“Electron”（开发环境下显示为 Electron），并重启应用。',
    '如果是从终端启动，也可能需要勾选“终端/Terminal（或 iTerm）”。',
  ].join('\n');

  const result = await dialog.showMessageBox({
    type: 'info',
    buttons: ['打开设置', '知道了'],
    defaultId: 0,
    cancelId: 1,
    title: '需要授权：辅助功能权限',
    message: '启用辅助功能权限以允许自动粘贴',
    detail: detailCn
  });
  if (result.response === 0) {
    openAccessibilityPane();
  }
}

// 获取当前前台应用的名称
function getFrontmostAppName() {
  return new Promise((resolve) => {
    if (process.platform !== 'darwin') return resolve(null);
    const script = 'tell application "System Events" to get name of (first application process whose frontmost is true)';
    exec(`osascript -e '${script}'`, (err, stdout) => {
      if (err) return resolve(null);
      const name = String(stdout || '').trim();
      resolve(name || null);
    });
  });
}

// 激活指定应用（通过名称）
function activateAppByName(name) {
  return new Promise((resolve) => {
    if (process.platform !== 'darwin' || !name) return resolve(false);
    const escaped = name.replace(/"/g, '\\"');
    const script = `tell application "${escaped}" to activate`;
    exec(`osascript -e '${script}'`, () => resolve(true));
  });
}

// 创建主窗口
function createWindow() {
  // 获取屏幕尺寸（主显示器）
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  mainWindow = new BrowserWindow({
    width: 360,
    height: 580,
    x: Math.floor((width - 360) / 2),
    y: Math.floor((height - 580) / 2),
    show: false,
    // 使用无边框窗口以隐藏 macOS 左上角三色按钮
    frame: false,
    // 无需额外的标题栏样式
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

  // 不额外设置层级/工作区，让窗口保持默认行为（显示时再动态调整）

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
    // 刚显示后的短暂失焦（切 Space/全屏/层级切换）容易导致瞬间隐藏，需忽略
    const elapsed = Date.now() - lastShowAt;
    if (elapsed < 800) return;
    setTimeout(() => {
      try {
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isFocused()) {
          mainWindow.hide();
        }
      } catch (err) {
        // 忽略错误
      }
    }, 200);
  });
}

// 在当前活动 Space/全屏上显示，并跟随鼠标所在显示器
async function showOnActiveSpace() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  // 记录唤起窗口前的前台应用
  try { lastFrontAppName = await getFrontmostAppName(); } catch (_) {}

  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  const workArea = display.workArea; // { x, y, width, height }
  const { width: winW, height: winH } = mainWindow.getBounds();
  const targetX = Math.round(workArea.x + (workArea.width - winW) / 2);
  const targetY = Math.round(workArea.y + (workArea.height - winH) / 3);
  mainWindow.setPosition(targetX, targetY);

  // 临时在所有工作区可见（含全屏），避免跳回旧 Space
  try { mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch (_) {}
  // 层级拉高，覆盖全屏
  try { mainWindow.setAlwaysOnTop(true, 'screen-saver'); } catch (_) {}

  mainWindow.show();
  mainWindow.focus();
  lastShowAt = Date.now();

  // 稍后还原，仅在当前 Space 可见
  setTimeout(() => {
    try { mainWindow.setVisibleOnAllWorkspaces(false); } catch (_) {}
  }, 200);

  // 安全地发送消息，检查窗口状态
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    try {
      mainWindow.webContents.send('window-shown');
    } catch (err) {
      // 忽略发送错误，避免崩溃
    }
  }
}

// 切换窗口显示/隐藏
async function toggleWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }

  try {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      await showOnActiveSpace();
    }
  } catch (err) {
    // 如果窗口已销毁，重新创建
    if (mainWindow.isDestroyed()) {
      createWindow();
    }
  }
}

// 当 Electron 完成初始化后创建窗口
app.whenReady().then(() => {
  createWindow();

  // 注册全局快捷键 Shift+Cmd+P（呼出面板）
  const ret = globalShortcut.register('Shift+CommandOrControl+P', () => {
    toggleWindow();
  });

  if (!ret) {
    console.log('⚠️ 快捷键 Shift+Cmd+P 注册失败（可能已被其他应用占用）');
  } else {
    console.log('✅ 快捷键 Shift+Cmd+P 注册成功');
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

// 二次启动时聚焦现有窗口
app.on('second-instance', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      if (!mainWindow.isVisible()) {
        showOnActiveSpace();
      } else {
        mainWindow.focus();
      }
    } catch (err) {
      // 忽略错误
    }
  }
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

// 粘贴（在前台应用的光标处模拟 Cmd+V）
// 粘贴功能已暂时移除，保持仅复制行为

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
  
  return new Promise((resolve, reject) => {
    // 在 macOS 上使用 osascript 模拟 Cmd+V 快捷键
    if (process.platform === 'darwin') {
      const script = `
        tell application "System Events"
          keystroke "v" using command down
        end tell
      `;
      
      exec(`osascript -e '${script}'`, async (error, stdout, stderr) => {
        if (error) {
          console.error('粘贴失败:', error);
          if (isTccDeniedError(error)) {
            try { await promptAccessibilityOnce(); } catch (_) {}
          }
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

// 一步完成：写入剪贴板 -> 隐藏窗口 -> 等待窗口隐藏 -> 模拟 Cmd+V
ipcMain.handle('insert-and-paste', async (event, text) => {
  const { clipboard } = require('electron');

  if (process.platform !== 'darwin') {
    throw new Error('当前平台不支持自动粘贴');
  }

  clipboard.writeText(text);

  // 合并“激活原前台应用 + 粘贴”为一次 AppleScript 调用，减少进程开销
  const pasteCombined = () => new Promise((resolve, reject) => {
    const appName = (lastFrontAppName || '').replace(/"/g, '\\"');
    const script = lastFrontAppName
      ? `
        tell application "${appName}" to activate
        delay 0.06
        tell application "System Events" to keystroke "v" using command down
      `
      : `tell application "System Events" to keystroke "v" using command down`;
    exec(`osascript -e '${script}'`, async (error) => {
      if (error) {
        console.error('粘贴失败:', error);
        if (isTccDeniedError(error)) {
          try { await promptAccessibilityOnce(); } catch (_) {}
        }
        reject(error);
      } else {
        resolve(true);
      }
    });
  });

  // 如果窗口可见，等隐藏后再粘贴，确保前台焦点回到原应用
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    return new Promise((resolve, reject) => {
      const doPaste = () => {
        // 隐藏完成后立刻执行合并脚本（内部自带极短 delay）
        pasteCombined().then(resolve).catch(reject);
      };
      mainWindow.once('hide', doPaste);
      try { mainWindow.hide(); } catch (_) { doPaste(); }
    });
  }

  // 窗口不可见：直接执行合并脚本
  return pasteCombined();
});
