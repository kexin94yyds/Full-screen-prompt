#!/bin/bash
echo "测试辅助功能权限..."
osascript -e 'tell application "System Events" to keystroke "test"' 2>&1

if [ $? -eq 0 ]; then
    echo "✅ 权限正常！可以正常使用插入功能"
else
    echo "❌ 权限未授予，请确认已在系统设置中勾选'终端'"
    echo ""
    echo "详细步骤："
    echo "1. 系统设置 → 隐私与安全性 → 辅助功能"
    echo "2. 点击左下角锁图标解锁"
    echo "3. 勾选 '终端' 或 'Terminal'"
    echo "4. 如果已勾选，请取消后重新勾选"
    echo "5. 完全退出终端（Cmd+Q）后重新打开"
fi






