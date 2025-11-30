# Prompter 问题排除指南

## 1. 粘贴注入不工作

### 问题描述
按 Enter 键后，提示词没有被粘贴到目标应用。

### 原因
- 应用未获得 **辅助功能权限**
- 开发版本和打包版本是不同的应用，需要分别授权

### 解决方案
1. 打开 **系统设置 → 隐私与安全性 → 辅助功能**
2. 点击 **+** 添加应用：
   - 开发版本：`/Users/apple/提示词最新的/Full-screen-prompt/src-tauri/target/debug/app`
   - 打包版本：`/Applications/Prompter.app`
3. 确保应用已勾选

---

## 2. Launchpad 显示问号图标

### 问题描述
Launchpad 中显示灰色问号的应用图标。

### 原因
应用已被删除，但 Launchpad 缓存未更新。

### 解决方案
```bash
# 方法 1：重置 Launchpad
defaults write com.apple.dock ResetLaunchPad -bool true && killall Dock

# 方法 2：彻底清理 Launchpad 数据库（如果方法 1 无效）
rm -rf ~/Library/Application\ Support/Dock/*.db && killall Dock
```

---

## 3. 打包后应用无法注入，开发版本可以

### 问题描述
`cargo tauri dev` 运行时可以正常注入，但 `cargo tauri build` 打包后的应用无法注入。

### 原因
- 打包后的应用签名与开发版本不同
- 辅助功能权限是按应用路径/签名授权的

### 解决方案
1. 在辅助功能权限中单独添加 `/Applications/Prompter.app`
2. 如果仍不工作，尝试：
   ```bash
   # 删除旧应用
   rm -rf /Applications/Prompter.app
   # 重新打包
   cargo tauri build
   # 重新安装
   cp -R target/release/bundle/macos/Prompter.app /Applications/
   ```

---

## 4. 多个 Prompter 进程冲突

### 问题描述
快捷键不响应，或窗口行为异常。

### 原因
多个 Prompter 实例同时运行。

### 解决方案
```bash
# 杀掉所有相关进程
pkill -9 -f "Prompter\|target/debug/app\|target/release/app\|cargo-tauri"
```

---

## 5. CGEvent 粘贴在某些应用不工作

### 问题描述
粘贴注入在大多数应用工作，但在特定应用（如 Electron 应用）不工作。

### 技术背景
ClipBook 使用以下方式实现粘贴：
- `kCGAnnotatedSessionEventTap` (值为 2) 发送键盘事件
- 激活目标应用后等待 150ms
- 发送 Cmd+V 后等待 50ms

### 解决方案
确保代码中：
1. 在显示窗口前保存目标应用的 PID
2. 粘贴前通过 PID 激活目标应用
3. 使用正确的 CGEventTapLocation（HID 或 Session）
