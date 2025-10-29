#!/bin/bash

# 提示词库 Mac 应用启动脚本

echo "🚀 正在启动提示词库应用..."
echo ""

# 检查 Node.js 是否已安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

# 检查 node_modules 是否存在
if [ ! -d "node_modules" ]; then
    echo "📦 首次运行，正在安装依赖..."
    npm install
    echo ""
fi

# 启动应用
echo "✅ 启动应用中..."
echo "💡 提示: 使用 Shift + Cmd + O 呼出窗口"
echo "⏹  按 Ctrl + C 停止应用"
echo ""

npm start

