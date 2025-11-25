#!/bin/bash

# Prompter 应用更新脚本
# 功能：重新打包应用并更新到 /Applications
# 版本: 2.0
# 更新时间: $(date +%Y-%m-%d)

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 获取脚本所在目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

log_info "开始更新 Prompter 应用..."
log_info "项目目录: $SCRIPT_DIR"
log_info "脚本版本: 2.0"
echo ""

# 1. 检查依赖
log_info "步骤 1/6: 检查依赖..."
if [ ! -d "node_modules" ]; then
    log_warning "未找到 node_modules，正在安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        log_error "依赖安装失败！"
        exit 1
    fi
    log_success "依赖安装完成"
else
    log_success "依赖检查通过"
fi

# 2. 清理旧的构建文件
log_info "步骤 2/6: 清理旧的构建文件..."
if [ -d "dist" ]; then
    rm -rf dist
    log_success "已清理旧的构建文件"
fi

# 3. 重新打包
log_info "步骤 3/6: 重新打包应用..."
npm run build

if [ $? -ne 0 ]; then
    log_error "打包失败！请检查错误信息。"
    exit 1
fi

# 检查打包结果
APP_PATH="dist/mac-arm64/Prompter.app"
if [ ! -d "$APP_PATH" ]; then
    log_error "找不到打包后的应用: $APP_PATH"
    exit 1
fi

log_success "打包成功: $APP_PATH"
echo ""

# 4. 停止旧版本（如果正在运行）
log_info "步骤 4/6: 停止旧版本应用..."
if pgrep -f "Prompter.app" > /dev/null; then
    log_info "正在关闭运行中的 Prompter..."
    killall Prompter 2>/dev/null || true
    sleep 2
    # 如果还在运行，强制关闭
    if pgrep -f "Prompter.app" > /dev/null; then
        log_warning "强制关闭应用..."
        killall -9 Prompter 2>/dev/null || true
        sleep 1
    fi
    log_success "旧版本已停止"
else
    log_success "没有运行中的实例"
fi
echo ""

# 5. 备份旧版本（如果存在）
OLD_APP="/Applications/Prompter.app"
BACKUP_DIR="$HOME/.prompter-backups"
if [ -d "$OLD_APP" ]; then
    log_info "步骤 5/6: 备份旧版本..."
    mkdir -p "$BACKUP_DIR"
    BACKUP_NAME="Prompter-$(date +%Y%m%d-%H%M%S).app"
    log_info "备份到: $BACKUP_DIR/$BACKUP_NAME"
    cp -R "$OLD_APP" "$BACKUP_DIR/$BACKUP_NAME" 2>/dev/null || true
    if [ $? -eq 0 ]; then
        log_success "备份完成"
    else
        log_warning "备份失败，但继续更新"
    fi
else
    log_info "步骤 5/6: 未找到旧版本，跳过备份"
fi
echo ""

# 6. 安装新版本
log_info "步骤 6/6: 安装新版本到 /Applications..."
rm -rf "$OLD_APP"
cp -R "$APP_PATH" /Applications/

if [ ! -d "$OLD_APP" ]; then
    log_error "安装失败！无法找到安装后的应用。"
    exit 1
fi

# 设置权限
chmod -R 755 "$OLD_APP"

log_success "新版本已安装到 /Applications/Prompter.app"
echo ""

# 启动新版本
log_info "启动新版本应用..."
open "$OLD_APP"

# 等待应用启动
sleep 2

# 验证应用是否成功启动
if pgrep -f "Prompter.app" > /dev/null; then
    log_success "应用启动成功！"
else
    log_warning "应用可能需要手动启动"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_success "更新完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log_info "验证步骤："
echo "  1. 按 Shift + ⌘ + P 呼出应用窗口"
echo "  2. 测试插入功能是否正常工作"
echo ""
log_info "提示："
echo "  - 如果遇到权限问题，请前往："
echo "    系统设置 → 隐私与安全性 → 辅助功能"
echo "    勾选 Prompter 并重启应用"
echo ""
log_info "旧版本备份位置: $BACKUP_DIR"
echo ""
log_info "应用版本信息："
echo "  - 构建时间: $(date)"
echo "  - 脚本版本: 2.0"
echo ""

# 清理函数
cleanup() {
    if [ $? -ne 0 ]; then
        log_error "更新过程中出现错误，请检查上述错误信息"
    fi
}

# 设置错误处理
trap cleanup EXIT
