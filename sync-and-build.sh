#!/bin/bash

# 同步并打包脚本
# 作用：从旧项目同步最新代码，保持窗口大小修改，然后打包

echo "🔄 正在同步最新代码..."

# 源项目路径
SOURCE_DIR="/Users/apple/mac 提示词库/Slash-Command-Prompter"
# 当前项目路径
CURRENT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 1. 同步所有文件（排除 node_modules、dist、.git）
rsync -av \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.git' \
  --exclude='package-lock.json' \
  --exclude='sync-and-build.sh' \
  "${SOURCE_DIR}/" \
  "${CURRENT_DIR}/"

echo "✅ 代码同步完成"
echo ""

# 2. 修改窗口大小为 360x580
echo "🔧 应用窗口大小修改..."
sed -i '' 's/width: 394/width: 360/g' "${CURRENT_DIR}/main.js"
sed -i '' 's/height: 646/height: 580/g' "${CURRENT_DIR}/main.js"
sed -i '' 's/(width - 394)/(width - 360)/g' "${CURRENT_DIR}/main.js"
sed -i '' 's/(height - 646)/(height - 580)/g' "${CURRENT_DIR}/main.js"

echo "✅ 窗口大小已调整为 360x580"
echo ""

# 3. 显示差异对比（可选）
echo "📊 与源项目的差异："
echo "----------------------------------------"
diff -u "${SOURCE_DIR}/main.js" "${CURRENT_DIR}/main.js" | grep -A 3 -B 3 "width\|height" || echo "仅窗口大小不同"
echo "----------------------------------------"
echo ""

# 4. 询问是否继续打包
read -p "是否继续打包？(y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ 已取消打包"
    exit 1
fi

# 5. 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 6. 开始打包
echo "📦 开始打包应用..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 打包成功！"
    echo "📍 应用位置：${CURRENT_DIR}/dist/mac-arm64/Prompter.app"
    echo ""
    echo "💡 使用方法："
    echo "   1. 退出旧版应用"
    echo "   2. 将 Prompter.app 拖到应用程序文件夹"
    echo "   3. 选择替换"
else
    echo ""
    echo "❌ 打包失败，请检查错误信息"
    exit 1
fi

