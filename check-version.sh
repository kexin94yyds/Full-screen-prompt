#!/bin/bash

echo "📊 Prompter 版本检查"
echo "===================="
echo ""

# 1. 源代码时间
echo "📝 源代码修改时间："
ls -lht app.js | head -1

# 2. dist 打包时间
echo ""
echo "📦 dist/ 打包时间："
if [ -f "dist/mac-arm64/Prompter.app/Contents/Resources/app.asar" ]; then
    ls -lht dist/mac-arm64/Prompter.app/Contents/Resources/app.asar
else
    echo "  ❌ 未找到（请先运行 npm run build）"
fi

# 3. 应用安装时间
echo ""
echo "🚀 /Applications/ 安装时间："
if [ -f "/Applications/Prompter.app/Contents/Resources/app.asar" ]; then
    ls -lht /Applications/Prompter.app/Contents/Resources/app.asar
else
    echo "  ❌ 未找到（请先运行 ./update-app.sh）"
fi

# 4. 对比
echo ""
echo "🔍 版本状态："
SRC_TIME=$(stat -f "%m" app.js 2>/dev/null)
DIST_TIME=$(stat -f "%m" dist/mac-arm64/Prompter.app/Contents/Resources/app.asar 2>/dev/null)
APP_TIME=$(stat -f "%m" /Applications/Prompter.app/Contents/Resources/app.asar 2>/dev/null)

if [ -n "$SRC_TIME" ] && [ -n "$DIST_TIME" ]; then
    if [ "$SRC_TIME" -gt "$DIST_TIME" ]; then
        echo "  ⚠️  源代码比 dist/ 新 → 需要运行: npm run build"
    else
        echo "  ✅ dist/ 是最新的"
    fi
fi

if [ -n "$DIST_TIME" ] && [ -n "$APP_TIME" ]; then
    if [ "$DIST_TIME" -gt "$APP_TIME" ]; then
        echo "  ⚠️  dist/ 比 /Applications/ 新 → 需要运行: ./update-app.sh"
    elif [ "$DIST_TIME" -eq "$APP_TIME" ]; then
        echo "  ✅ /Applications/ 是最新的"
    fi
fi

if [ -n "$SRC_TIME" ] && [ -n "$APP_TIME" ]; then
    if [ "$SRC_TIME" -gt "$APP_TIME" ]; then
        echo ""
        echo "⚠️  警告：源代码已修改，但应用未更新！"
        echo ""
        echo "   解决方案："
        echo "   1. npm run build"
        echo "   2. ./update-app.sh"
    fi
fi

# 5. 检查是否有新功能代码
echo ""
echo "🔎 功能检查（搜索优化）："
if [ -f "/Applications/Prompter.app/Contents/Resources/app.asar" ]; then
    npx asar extract /Applications/Prompter.app/Contents/Resources/app.asar /tmp/prompter-check 2>/dev/null
    if grep -q "score = 1000" /tmp/prompter-check/app.js 2>/dev/null; then
        echo "  ✅ 搜索优化代码已包含"
    else
        echo "  ❌ 搜索优化代码未找到（可能是旧版本）"
    fi
    rm -rf /tmp/prompter-check
else
    echo "  ⚠️  应用未安装"
fi

echo ""
echo "===================="


