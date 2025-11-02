#!/bin/bash

echo "🔄 开始更新 Prompter..."

# 1. 重新打包
echo "📦 1/6 重新打包..."
cd "/Users/apple/mac 提示词库/Slash-Command-Prompter"
npm run build

if [ $? -ne 0 ]; then
    echo "❌ 打包失败！"
    exit 1
fi

# 2. 停止应用
echo "🛑 2/6 停止旧版本..."
killall -9 Prompter 2>/dev/null
sleep 1

# 3. 删除旧版本
echo "🗑️  3/6 删除旧版本..."
rm -rf /Applications/Prompter.app

# 4. 复制新版本
echo "📋 4/6 复制新版本..."
cp -R dist/mac-arm64/Prompter.app /Applications/

if [ ! -d "/Applications/Prompter.app" ]; then
    echo "❌ 复制失败！"
    exit 1
fi

# 5. 清除缓存（可选）
echo "🧹 5/6 清除缓存..."
rm -rf ~/Library/Application\ Support/prompt-library-mac

# 6. 启动新版本
echo "🚀 6/6 启动新版本..."
open /Applications/Prompter.app

echo ""
echo "✅ 更新完成！"
echo ""
echo "📝 验证步骤："
echo "  1. 按 ⌘ + Shift + L 唤出应用"
echo "  2. 测试新功能是否生效"
echo ""


