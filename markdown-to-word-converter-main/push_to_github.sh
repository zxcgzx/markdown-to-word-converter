#!/bin/bash

# 自动重试推送脚本
# 设置最大重试次数
MAX_RETRIES=5
RETRY_COUNT=0

echo "开始推送到 GitHub..."

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    echo "尝试推送 (第 $((RETRY_COUNT + 1)) 次)"

    # 尝试推送
    if timeout 120 git push origin main --verbose; then
        echo "推送成功！"
        exit 0
    else
        echo "推送失败，等待 10 秒后重试..."
        sleep 10
        RETRY_COUNT=$((RETRY_COUNT + 1))
    fi
done

echo "推送失败，已达到最大重试次数"
echo "可能的解决方案："
echo "1. 检查网络连接"
echo "2. 验证 GitHub token 是否有效"
echo "3. 尝试手动推送: git push origin main"
exit 1