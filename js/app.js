        // 商业化权限系统 - 3级用户分级
        const userPermissions = {
            'basic123': {
                level: 'basic',
                name: '基础用户',
                icon: '🆓',
                features: {
                    basicMarkdown: true,
                    mathFormulas: false,
                    batchProcess: false,
                    customExport: false,
                    aiFix: true,         // 基础用户也可使用AI修复
                    priority: 'low'
                }
            },
            '517517': {
                level: 'advanced',
                name: '高级用户',
                icon: '⭐',
                features: {
                    basicMarkdown: true,
                    mathFormulas: true,
                    batchProcess: true,
                    customExport: true,
                    aiFix: true,         // 高级用户支持AI修复
                    priority: 'high'
                }
            },
            'lingling': {
                level: 'super_admin',
                name: '超级管理员',
                icon: '👑',
                features: {
                    basicMarkdown: true,
                    mathFormulas: true,
                    batchProcess: true,
                    customExport: true,
                    aiFix: true,         // 超级管理员支持AI修复
                    priority: 'highest',
                    adminPanel: true,
                    passwordGenerator: true
                }
            }
        };
        
        // 当前用户权限
        let currentUser = null;
        let currentPassword = null; // 保存当前使用的密码
        
        const markdownInput = document.getElementById('markdownInput');
        const preview = document.getElementById('preview');

        let previewBlocks = [];
        const selectedPreviewBlockIds = new Set();
        let selectedPreviewRange = null;
        let previewSupportsPartialSelection = false;

        
        // 示例加载标志
        let isLoadingExample = false;
        const AUTO_SAVE_KEY = 'markdown-auto-save';
        const AUTO_SAVE_TIMESTAMP_KEY = 'markdown-auto-save-timestamp';
        let tableExamplesInitialized = false;
        let tableConverterKeyHandler = null;
        let tableEnhancementsBound = false;
        let tableFitMode = 'full';
        let tableStriped = true;
        let lastAIErrorMessage = '';
        
        // 自定义密码管理
        const customPasswords = {
            // 从localStorage加载自定义密码
            load() {
                const stored = localStorage.getItem('customPasswords');
                return stored ? JSON.parse(stored) : {};
            },
            
            // 保存自定义密码到localStorage
            save(passwords) {
                localStorage.setItem('customPasswords', JSON.stringify(passwords));
            },
            
            // 添加新密码
            add(password, userLevel) {
                const passwords = this.load();
                passwords[password] = {
                    level: userLevel,
                    createdAt: new Date().toISOString(),
                    createdBy: currentUser ? currentUser.level : 'admin'
                };
                this.save(passwords);
                return password;
            },
            
            // 删除密码
            remove(password) {
                const passwords = this.load();
                delete passwords[password];
                this.save(passwords);
            },
            
            // 获取所有有效密码
            getAll() {
                return this.load();
            },
            
            // 检查密码是否存在
            exists(password) {
                const passwords = this.load();
                return passwords.hasOwnProperty(password);
            },
            
            // 获取密码对应的用户权限
            getPermissions(password) {
                const passwords = this.load();
                const customPassword = passwords[password];
                if (!customPassword) return null;
                
                // 基于用户等级返回权限配置
                const basePermissions = {
                    basic: {
                        level: 'basic',
                        name: '基础用户',
                        icon: '🆓',
                        features: {
                            basicMarkdown: true,
                            mathFormulas: false,
                            batchProcess: false,
                            customExport: false,
                            aiFix: true,
                            priority: 'low'
                        }
                    },
                    advanced: {
                        level: 'advanced',
                        name: '高级用户',
                        icon: '⭐',
                        features: {
                            basicMarkdown: true,
                            mathFormulas: true,
                            batchProcess: true,
                            customExport: true,
                            aiFix: true,
                            priority: 'high'
                        }
                    }
                };
                
                return basePermissions[customPassword.level] || null;
            }
        };
        
        // 撤销密码管理器 - 防止已删除的密码通过分享码重新激活
        const revokedPasswords = {
            // 从 localStorage 加载撤销列表
            load() {
                const stored = localStorage.getItem('revokedPasswords');
                return stored ? JSON.parse(stored) : {};
            },
            
            // 保存撤销列表到 localStorage
            save(revoked) {
                localStorage.setItem('revokedPasswords', JSON.stringify(revoked));
            },
            
            // 撤销密码
            revoke(password, reason = '管理员删除') {
                const revoked = this.load();
                revoked[password] = {
                    revokedAt: new Date().toISOString(),
                    revokedBy: currentUser ? currentUser.level : 'admin',
                    reason: reason
                };
                this.save(revoked);
            },
            
            // 检查密码是否已撤销
            isRevoked(password) {
                const revoked = this.load();
                return revoked.hasOwnProperty(password);
            },
            
            // 获取所有撤销密码
            getAll() {
                return this.load();
            },
            
            // 清除所有撤销记录（仅管理员可用）
            clearAll() {
                localStorage.removeItem('revokedPasswords');
            },
            
            // 恢复密码（从撤销列表中移除）
            restore(password) {
                const revoked = this.load();
                delete revoked[password];
                this.save(revoked);
            }
        };
        
        let loginAttempts = 0;
        const maxAttempts = 5;
        let lockoutTime = 0;
        
        // 密码显示/隐藏切换
        function togglePasswordVisibility() {
            const passwordInput = document.getElementById('passwordInput');
            const passwordToggle = document.getElementById('passwordToggle');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                passwordToggle.textContent = '🙈';
                passwordToggle.setAttribute('aria-label', '隐藏密码');
                passwordToggle.setAttribute('title', '隐藏密码');
            } else {
                passwordInput.type = 'password';
                passwordToggle.textContent = '👁️';
                passwordToggle.setAttribute('aria-label', '显示密码');
                passwordToggle.setAttribute('title', '显示密码');
            }
        }
        
        // 检查是否被锁定
        function checkLockout() {
            const now = Date.now();
            if (lockoutTime > now) {
                const remainingTime = Math.ceil((lockoutTime - now) / 1000);
                return remainingTime;
            }
            return 0;
        }
        
        // 显示错误信息
        function showPasswordError(message, shake = true) {
            const passwordError = document.getElementById('passwordError');
            passwordError.textContent = message;
            passwordError.style.display = 'block';
            
            if (shake) {
                passwordError.style.animation = 'none';
                setTimeout(() => {
                    passwordError.style.animation = 'errorShake 0.6s ease-out';
                }, 10);
            }
            
            // 5秒后隐藏错误信息
            setTimeout(() => {
                passwordError.style.display = 'none';
            }, 5000);
        }
        
        function verifyPassword() {
            const passwordInput = document.getElementById('passwordInput');
            const password = passwordInput.value.trim();
            
            // 检查锁定状态
            const lockoutRemaining = checkLockout();
            if (lockoutRemaining > 0) {
                showPasswordError(`尝试次数过多，请等待 ${lockoutRemaining} 秒后重试`, false);
                return;
            }

            // 检查是否已被撤销
            if (revokedPasswords.isRevoked(password)) {
                showPasswordError('该密码已被撤销，无法登录，请联系管理员重新获取。');
                passwordInput.value = '';
                return;
            }
            
            // 检查预设密码或自定义密码
            let userFound = false;
            
            if (userPermissions[password]) {
                // 预设密码
                currentUser = userPermissions[password];
                userFound = true;
            } else if (customPasswords.exists(password)) {
                // 自定义密码
                currentUser = customPasswords.getPermissions(password);
                userFound = true;
            }
            
            if (userFound && currentUser) {
                // 密码正确，重置尝试次数
                loginAttempts = 0;
                
                // 保存当前使用的密码
                currentPassword = password;
                
                // 显示成功动画
                const modal = document.querySelector('.password-modal');
                modal.style.animation = 'fadeOut 0.5s ease-out forwards';
                
                setTimeout(() => {
                    // 隐藏验证界面，显示主应用
                    document.getElementById('passwordOverlay').style.display = 'none';
                    document.getElementById('mainApp').classList.add('authenticated');
                    
                    // 保存验证状态和用户权限到sessionStorage
                    sessionStorage.setItem('authenticated', 'true');
                    sessionStorage.setItem('userLevel', currentUser.level);
                    sessionStorage.setItem('currentPassword', password); // 保存当前密码
                    sessionStorage.setItem('userPermissions', JSON.stringify(currentUser));
                    
                    // 显示欢迎信息
                    showWelcomeMessage();
                    
                    // 初始化应用（根据权限）
                    initializeApp();
                }, 500);
                
            } else {
                // 密码错误，增加尝试次数
                loginAttempts++;
                
                let errorMessage = `密码错误，请重试 (${loginAttempts}/${maxAttempts})`;
                
                if (loginAttempts >= maxAttempts) {
                    // 达到最大尝试次数，锁定5分钟
                    lockoutTime = Date.now() + 5 * 60 * 1000;
                    errorMessage = '尝试次数过多，已锁定5分钟';
                }
                
                showPasswordError(errorMessage);
                passwordInput.value = '';
                passwordInput.focus();
            }
        }
        
        // 显示用户欢迎信息
        function showWelcomeMessage() {
            if (!currentUser) return;
            
            const welcomeMessage = `欢迎，${currentUser.icon} ${currentUser.name}！`;
            
            showToast('登录成功', welcomeMessage, 'success', 3000);
        }
        
        
        // 检查文档大小限制
        function checkDocumentSize(content) {
            // 所有用户都无文档大小限制
            return { allowed: true, size: content.length };
        }
        
        // 检查功能权限
        function hasFeature(featureName) {
            return currentUser && currentUser.features && currentUser.features[featureName];
        }
        
        // 更新用户状态显示
        function updateUserStatus() {
            if (!currentUser) return;
            
            const userStatus = document.getElementById('userStatus');
            const userIcon = document.getElementById('userIcon');
            const userName = document.getElementById('userName');
            const userLevel = document.getElementById('userLevel');
            const adminButton = document.getElementById('adminButton');
            
            if (userStatus && userIcon && userName && userLevel) {
                userStatus.style.display = 'block';
                userIcon.textContent = currentUser.icon;
                userName.textContent = currentUser.name;
                userLevel.textContent = currentUser.level.toUpperCase();
                
                // 显示或隐藏管理按钮
                if (adminButton) {
                    if (hasFeature('adminPanel')) {
                        adminButton.style.display = 'block';
                    } else {
                        adminButton.style.display = 'none';
                    }
                }
            }
        }
        
        // 显示用户权限详情
        function showUserPermissions() {
            if (!currentUser) return;
            
            const featuresList = Object.entries(currentUser.features)
                .filter(([key, value]) => key !== 'priority')
                .map(([key, value]) => {
                    const featureNames = {
                        basicMarkdown: '基础Markdown语法',
                        mathFormulas: '数学公式支持',
                        batchProcess: '批量文件处理',
                        customExport: '自定义导出模板',
                        aiFix: 'AI智能修复',
                        adminPanel: '管理员面板',
                        passwordGenerator: '密码生成器'
                    };
                    const status = value ? '✅' : '❌';
                    return `<div style="padding: 4px 0;">${status} ${featureNames[key] || key}</div>`;
                }).join('');
            
            showConfirm(
                `${currentUser.icon} ${currentUser.name} - 权限详情`,
                `
                <div style="text-align: left; max-width: 400px;">
                    <div style="background: var(--preview-bg); padding: 12px; border-radius: 6px;">
                        <strong>功能权限</strong><br>
                        ${featuresList}
                    </div>
                    <div style="background: rgba(0, 184, 148, 0.1); padding: 12px; border-radius: 6px; margin-top: 12px; border-left: 4px solid var(--success);">
                        🎉 <strong>无限制使用</strong><br>
                        所有用户都可以无限制使用转换功能！
                    </div>
                </div>
                `,
                '📊'
            );
        }
        
        // === 管理员面板功能 ===
        
        // 显示管理员面板
        function showAdminPanel() {
            if (!hasFeature('adminPanel')) {
                showToast('权限不足', '只有超级管理员可以访问管理面板', 'warning');
                return;
            }
            
            document.getElementById('adminPanel').style.display = 'block';
        }
        
        // 关闭管理员面板
        function closeAdminPanel() {
            document.getElementById('adminPanel').style.display = 'none';
        }
        
        // 切换管理标签页
        function switchAdminTab(tabName) {
            // 隐藏所有标签页内容
            document.querySelectorAll('.admin-tab-content').forEach(tab => {
                tab.style.display = 'none';
            });
            
            // 移除所有标签页活动状态
            document.querySelectorAll('.admin-tab').forEach(tab => {
                tab.style.borderBottom = '2px solid transparent';
                tab.style.color = 'var(--text-secondary)';
                tab.style.fontWeight = 'normal';
            });
            
            // 显示选中的标签页
            document.getElementById(tabName + 'Tab').style.display = 'block';
            
            // 设置选中标签的活动状态
            const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
            if (activeTab) {
                activeTab.style.borderBottom = '2px solid var(--accent-primary)';
                activeTab.style.color = 'var(--accent-primary)';
                activeTab.style.fontWeight = '600';
            }
            
            // 根据标签页更新数据
            if (tabName === 'password') {
                updatePasswordList();
            }
        }
        
        // 更新管理面板统计数据
        
        
        // 生成密码
        function generatePassword() {
            const userType = document.getElementById('passwordUserType').value;
            const length = parseInt(document.getElementById('passwordLength').value);
            
            // 生成包含字母和数字的随机密码
            const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let password = '';
            
            for (let i = 0; i < length; i++) {
                password += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            
            // 确保密码唯一性
            while (userPermissions[password] || customPasswords.exists(password)) {
                password = '';
                for (let i = 0; i < length; i++) {
                    password += chars.charAt(Math.floor(Math.random() * chars.length));
                }
            }
            
            // 添加到自定义密码管理中
            customPasswords.add(password, userType);
            
            // 显示生成的密码
            const generatedPasswordDiv = document.getElementById('generatedPassword');
            const passwordValueDiv = document.getElementById('passwordValue');
            const shareTextValueDiv = document.getElementById('shareTextValue');
            
            if (generatedPasswordDiv && passwordValueDiv) {
                passwordValueDiv.textContent = password;
                generatedPasswordDiv.style.display = 'block';
                
                // 存储生成的密码供复制使用
                window.lastGeneratedPassword = password;
                window.lastGeneratedUserType = userType;
                
                // 生成分享文本
                const shareText = `PWD:${password}|${userType}|${new Date().toISOString().split('T')[0]}`;
                window.lastGeneratedShareText = shareText;
                
                // 显示分享文本
                if (shareTextValueDiv) {
                    shareTextValueDiv.textContent = shareText;
                }
            }
            
            // 更新密码列表显示
            updatePasswordList();
            
            showToast('密码生成', `已为${userType === 'basic' ? '基础用户' : '高级用户'}生成新密码: ${password}`, 'success', 4000);
        }
        
        // 复制密码
        function copyPassword() {
            if (window.lastGeneratedPassword) {
                navigator.clipboard.writeText(window.lastGeneratedPassword).then(() => {
                    showToast('复制成功', '密码已复制到剪贴板', 'success');
                }).catch(() => {
                    // 兼容性回退
                    const textarea = document.createElement('textarea');
                    textarea.value = window.lastGeneratedPassword;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    showToast('复制成功', '密码已复制到剪贴板', 'success');
                });
            }
        }
        
        // 复制分享文本（显示分享区域）
        function copyShareText() {
            if (window.lastGeneratedShareText) {
                // 显示分享文本区域
                const shareTextArea = document.getElementById('shareTextArea');
                if (shareTextArea) {
                    shareTextArea.style.display = 'block';
                }
                
                // 复制分享文本
                navigator.clipboard.writeText(window.lastGeneratedShareText).then(() => {
                    showToast('分享码复制成功', '📱 现在可以通过微信/QQ发送给朋友了！\n朋友收到后在登录界面点击"粘贴分享码"即可导入密码', 'success', 5000);
                }).catch(() => {
                    // 兼容性回退
                    const textarea = document.createElement('textarea');
                    textarea.value = window.lastGeneratedShareText;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    showToast('分享码复制成功', '📱 现在可以通过微信/QQ发送给朋友了！', 'success', 4000);
                });
            }
        }
        
        // 直接复制分享文本（点击文本区域）
        function copyShareTextDirect() {
            if (window.lastGeneratedShareText) {
                navigator.clipboard.writeText(window.lastGeneratedShareText).then(() => {
                    showToast('复制成功', '分享码已复制', 'success');
                }).catch(() => {
                    showToast('复制失败', '请手动选择文本复制', 'error');
                });
            }
        }
        
        // 更新密码列表显示
        function updatePasswordList() {
            const passwordListDiv = document.getElementById('passwordList');
            const passwordCountDisplay = document.getElementById('passwordCountDisplay');
            
            if (!passwordListDiv) return;
            
            const allPasswords = customPasswords.getAll();
            const passwordEntries = Object.entries(allPasswords);
            
            // 更新密码数量显示
            if (passwordCountDisplay) {
                passwordCountDisplay.textContent = passwordEntries.length;
            }
            
            if (passwordEntries.length === 0) {
                passwordListDiv.innerHTML = '<div style="color: var(--text-secondary); text-align: center; font-style: italic;">暂无生成的密码</div>';
                return;
            }
            
            const passwordItems = passwordEntries.map(([password, info]) => {
                const levelNames = { basic: '基础用户', advanced: '高级用户' };
                const levelIcons = { basic: '🆓', advanced: '⭐' };
                const createdDate = new Date(info.createdAt).toLocaleDateString();
                
                return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span>${levelIcons[info.level]}</span>
                                <code style="background: white; padding: 2px 6px; border-radius: 4px; font-weight: 600;">${password}</code>
                                <span style="color: var(--text-secondary); font-size: 12px;">${levelNames[info.level]}</span>
                            </div>
                            <div style="color: var(--text-muted); font-size: 11px; margin-top: 2px;">创建于: ${createdDate}</div>
                        </div>
                        <div style="display: flex; gap: 4px;">
                            <button onclick="copyPasswordToClipboard('${password}')" style="background: var(--info); color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer; font-size: 11px;" title="复制密码">复制</button>
                            <button onclick="deleteCustomPassword('${password}')" style="background: var(--warning); color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer; font-size: 11px;" title="删除密码">删除</button>
                        </div>
                    </div>
                `;
            }).join('');
            
            passwordListDiv.innerHTML = passwordItems;
            
            // 同时更新撤销列表
            updateRevokedPasswordList();
        }
        
        // 更新撤销密码列表显示
        function updateRevokedPasswordList() {
            const revokedPasswordListDiv = document.getElementById('revokedPasswordList');
            const revokedCountDisplay = document.getElementById('revokedCountDisplay');
            
            if (!revokedPasswordListDiv || !revokedCountDisplay) return;
            
            const allRevokedPasswords = revokedPasswords.getAll();
            const revokedEntries = Object.entries(allRevokedPasswords);
            
            // 更新撤销数量显示
            revokedCountDisplay.textContent = revokedEntries.length;
            
            if (revokedEntries.length === 0) {
                revokedPasswordListDiv.innerHTML = '<div style="color: var(--text-secondary); text-align: center; font-style: italic;">暂无撤销的密码</div>';
                return;
            }
            
            const revokedItems = revokedEntries.map(([password, info]) => {
                const revokedDate = new Date(info.revokedAt).toLocaleDateString();
                const revokedTime = new Date(info.revokedAt).toLocaleTimeString();
                
                return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span>🚫</span>
                                <code style="background: #ffebee; padding: 2px 6px; border-radius: 4px; font-weight: 600; color: #c62828;">${password}</code>
                                <span style="color: var(--text-secondary); font-size: 12px;">${info.reason}</span>
                            </div>
                            <div style="color: var(--text-muted); font-size: 11px; margin-top: 2px;">撤销于: ${revokedDate} ${revokedTime}</div>
                        </div>
                        <div style="display: flex; gap: 4px;">
                            <button onclick="restoreRevokedPassword('${password}')" style="background: var(--success); color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer; font-size: 11px;" title="恢复密码">恢复</button>
                        </div>
                    </div>
                `;
            }).join('');
            
            revokedPasswordListDiv.innerHTML = revokedItems;
        }
        
        // 恢复撤销的密码
        function restoreRevokedPassword(password) {
            if (confirm(`确认恢复密码 "${password}"？\n恢复后该密码的分享码将可以再次使用。`)) {
                revokedPasswords.restore(password);
                updateRevokedPasswordList();
                showToast('密码恢复', `密码 ${password} 已从撤销列表中移除`, 'success');
            }
        }
        
        // 清空所有撤销密码
        function clearRevokedPasswords() {
            const allRevokedPasswords = revokedPasswords.getAll();
            const revokedCount = Object.keys(allRevokedPasswords).length;
            
            if (revokedCount === 0) {
                showToast('提示', '当前没有撤销的密码', 'info');
                return;
            }
            
            if (confirm(`确认清空所有 ${revokedCount} 个撤销记录？\n清空后，这些密码的分享码将可以再次使用。`)) {
                revokedPasswords.clearAll();
                updateRevokedPasswordList();
                showToast('撤销清空', `已清空所有 ${revokedCount} 个撤销记录`, 'success');
            }
        }
        
        // 复制密码到剪贴板
        function copyPasswordToClipboard(password) {
            navigator.clipboard.writeText(password).then(() => {
                showToast('复制成功', `密码 ${password} 已复制到剪贴板`, 'success');
            }).catch(() => {
                // 兼容性回退
                const textarea = document.createElement('textarea');
                textarea.value = password;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                showToast('复制成功', `密码 ${password} 已复制到剪贴板`, 'success');
            });
        }
        
        // 删除自定义密码
        function deleteCustomPassword(password) {
            if (confirm(`确认删除密码 "${password}"？\n删除后该密码将无法再用于登录，包括使用分享码。`)) {
                // 先将密码加入撤销列表
                revokedPasswords.revoke(password, '管理员删除');
                
                // 再从密码列表中移除
                customPasswords.remove(password);
                
                updatePasswordList();
                showToast('密码删除', `密码 ${password} 已删除并撤销，相关分享码已失效`, 'success');
            }
        }
        
        // === 核心分享功能 ===
        
        // === 免登录密码导入功能 ===
        
        // 粘贴分享码（超简单导入方式）
        function pasteShareCode() {
            // 尝试从剪贴板读取
            if (navigator.clipboard && navigator.clipboard.readText) {
                navigator.clipboard.readText().then(text => {
                    parseAndImportShareCode(text);
                }).catch(() => {
                    // 如果无法自动读取剪贴板，让用户手动输入
                    showShareCodeInput();
                });
            } else {
                // 不支持剪贴板API，让用户手动输入
                showShareCodeInput();
            }
        }
        
        // 显示手动输入分享码的对话框
        function showShareCodeInput() {
            const shareCode = prompt('📱 请粘贴朋友发送的分享码：\n\n格式类似：PWD:abc123|advanced|2025-01-01');
            if (shareCode) {
                parseAndImportShareCode(shareCode);
            }
        }
        
        // 解析并导入分享码
        function parseAndImportShareCode(shareCode) {
            try {
                // 去除空白字符
                shareCode = shareCode.trim();
                
                // 检查格式：PWD:password|userType|date
                if (!shareCode.startsWith('PWD:')) {
                    throw new Error('分享码格式错误：必须以"PWD:"开头');
                }
                
                // 解析分享码
                const parts = shareCode.substring(4).split('|'); // 去掉"PWD:"前缀
                if (parts.length < 2) {
                    throw new Error('分享码格式错误：缺少必要信息');
                }
                
                const password = parts[0];
                const userType = parts[1];
                const createDate = parts[2] || new Date().toISOString();
                
                // 验证用户类型
                if (!['basic', 'advanced'].includes(userType)) {
                    throw new Error('分享码格式错误：无效的用户类型');
                }
                
                // 检查密码是否已被撤销
                if (revokedPasswords.isRevoked(password)) {
                    throw new Error(`密码 "${password}" 已被撤销，无法使用。\n请联系管理员获取新的密码。`);
                }
                
                // 检查密码是否已存在
                const existingPasswords = customPasswords.getAll();
                if (existingPasswords[password]) {
                    showPasswordError(`ℹ️ 密码 "${password}" 已存在，可以直接使用`, false);
                    
                    // 自动填入密码框
                    const passwordInput = document.getElementById('passwordInput');
                    if (passwordInput) {
                        passwordInput.value = password;
                        passwordInput.focus();
                    }
                    return;
                }
                
                // 导入新密码
                customPasswords.add(password, userType);
                
                // 显示成功信息
                const userTypeName = userType === 'basic' ? '基础用户' : '高级用户';
                showPasswordError(`✅ 导入成功！\n已添加${userTypeName}密码：${password}\n现在可以使用这个密码登录了！`, false);
                
                // 自动填入密码框
                const passwordInput = document.getElementById('passwordInput');
                if (passwordInput) {
                    passwordInput.value = password;
                    passwordInput.placeholder = '已自动填入密码，按回车登录';
                    setTimeout(() => {
                        passwordInput.focus();
                        passwordInput.select();
                    }, 1000);
                }
                
            } catch (error) {
                console.error('解析分享码失败:', error);
                showPasswordError(`❌ 分享码格式错误：${error.message}\n\n正确格式示例：PWD:abc123|advanced|2025-01-01`, false);
            }
        }
        
        // 密码分享功能已简化，文件导入功能已移除
        
        // 更新配额管理标签页中的密码列表
        function updateQuotaPasswordList() {
            const quotaPasswordListDiv = document.getElementById('quotaPasswordList');
            const passwordCountSpan = document.getElementById('passwordCount');
            
            if (!quotaPasswordListDiv || !passwordCountSpan) return;
            
            const allPasswords = customPasswords.getAll();
            const passwordEntries = Object.entries(allPasswords);
            
            // 更新密码数量
            passwordCountSpan.textContent = passwordEntries.length;
            
            if (passwordEntries.length === 0) {
                quotaPasswordListDiv.innerHTML = '<div style="color: var(--text-secondary); text-align: center; font-style: italic;">暂无生成的密码</div>';
                return;
            }
            
            // 按用户类型分组显示
            const basicPasswords = passwordEntries.filter(([_, info]) => info.level === 'basic');
            const advancedPasswords = passwordEntries.filter(([_, info]) => info.level === 'advanced');
            
            let html = '';
            
            if (basicPasswords.length > 0) {
                html += `
                    <div style="margin-bottom: 15px;">
                        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                            🆓 基础用户密码 (${basicPasswords.length})
                        </div>
                        ${basicPasswords.map(([password, info]) => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; margin: 2px 0; background: white; border-radius: 4px; border-left: 3px solid var(--accent-primary);">
                                <code style="font-weight: 600; color: var(--accent-primary);">${password}</code>
                                <div style="display: flex; gap: 4px;">
                                    <button onclick="copyPasswordToClipboard('${password}')" style="background: var(--info); color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-size: 10px;">复制</button>
                                    <button onclick="deleteCustomPasswordFromQuota('${password}')" style="background: var(--warning); color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-size: 10px;">删除</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
            
            if (advancedPasswords.length > 0) {
                html += `
                    <div>
                        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                            ⭐ 高级用户密码 (${advancedPasswords.length})
                        </div>
                        ${advancedPasswords.map(([password, info]) => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; margin: 2px 0; background: white; border-radius: 4px; border-left: 3px solid var(--accent-secondary);">
                                <code style="font-weight: 600; color: var(--accent-secondary);">${password}</code>
                                <div style="display: flex; gap: 4px;">
                                    <button onclick="copyPasswordToClipboard('${password}')" style="background: var(--info); color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-size: 10px;">复制</button>
                                    <button onclick="deleteCustomPasswordFromQuota('${password}')" style="background: var(--warning); color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-size: 10px;">删除</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
            
            quotaPasswordListDiv.innerHTML = html;
        }
        
        // 从配额管理界面删除密码
        function deleteCustomPasswordFromQuota(password) {
            if (confirm(`确认删除密码 "${password}"？\n删除后该密码将无法再用于登录，包括使用分享码。`)) {
                // 先将密码加入撤销列表
                revokedPasswords.revoke(password, '管理员删除');
                
                // 再从密码列表中移除
                customPasswords.remove(password);
                
                updatePasswordList();
                showToast('密码删除', `密码 ${password} 已删除并撤销，相关分享码已失效`, 'success');
            }
        }
        
        // 清除所有自定义密码
        function clearAllPasswords() {
            const allPasswords = customPasswords.getAll();
            const passwordCount = Object.keys(allPasswords).length;
            
            if (passwordCount === 0) {
                showToast('提示', '当前没有生成的密码', 'info');
                return;
            }
            
            if (confirm(`确认清除所有 ${passwordCount} 个生成的密码？\n此操作不可撤销，所有自定义密码将无法再用于登录，包括使用分享码。`)) {
                // 先将所有密码加入撤销列表
                Object.keys(allPasswords).forEach(password => {
                    revokedPasswords.revoke(password, '批量清除');
                });
                
                // 清除所有自定义密码
                localStorage.removeItem('customPasswords');
                
                // 更新所有相关显示
                updatePasswordList();
                
                showToast('密码清除', `已清除所有 ${passwordCount} 个自定义密码并撤销，相关分享码已失效`, 'success');
            }
        }
        
        
        // === 退出登录功能 ===
        
        // 显示退出确认对话框
        async function showLogoutConfirm() {
            const confirmed = await showConfirm(
                '退出登录',
                `确认退出当前账号 ${currentUser ? currentUser.icon + ' ' + currentUser.name : ''}？\n\n退出后需要重新输入密码才能使用系统。`,
                '🚪'
            );
            
            if (confirmed) {
                logout();
            }
        }
        
        // 执行退出登录
        function logout() {
            // 关闭管理面板（如果打开的话）
            closeAdminPanel();

            // 清除会话状态
            sessionStorage.removeItem('authenticated');
            sessionStorage.removeItem('userLevel');
            sessionStorage.removeItem('userPermissions');
            sessionStorage.removeItem('currentPassword');
            
            // 清除当前用户信息
            currentUser = null;
            currentPassword = null;
            
            // 隐藏用户状态
            const userStatus = document.getElementById('userStatus');
            if (userStatus) {
                userStatus.style.display = 'none';
            }
            
            // 确保密码界面可见，主应用隐藏
            const mainApp = document.getElementById('mainApp');
            const passwordOverlay = document.getElementById('passwordOverlay');
            
            if (mainApp) {
                mainApp.classList.remove('authenticated');
                mainApp.style.display = 'none'; // 强制隐藏
            }
            
            if (passwordOverlay) {
                passwordOverlay.style.display = 'block'; // 强制显示
            }
            
            // 清空并聚焦密码输入框
            const passwordInput = document.getElementById('passwordInput');
            if (passwordInput) {
                passwordInput.value = '';
                
                // 强制刷新界面显示
                setTimeout(() => {
                    passwordInput.focus();
                    // 重置主应用显示
                    if (mainApp) {
                        mainApp.style.display = '';
                    }
                }, 50);
            }
            
            // 清除内容（可选）
            const markdownInput = document.getElementById('markdownInput');
            if (markdownInput && markdownInput.value.trim()) {
                // 如果有内容，询问是否保存草稿
                if (confirm('是否将当前内容保存为草稿？')) {
                    saveToLocal();
                }
                markdownInput.value = '';
            }
            
            // 重置预览
            const preview = document.getElementById('preview');
            if (preview) {
                preview.innerHTML = `
                    <div class="preview-empty">
                        <div class="preview-empty-icon">📝</div>
                        <div class="preview-empty-title">开始创作您的文档</div>
                        <div class="preview-empty-subtitle">
                            在左侧输入框中输入Markdown内容<br>
                            或者使用下方的快速操作
                        </div>
                        <div class="preview-quick-actions" role="group" aria-label="快速操作">
                            <button class="quick-action-btn" onclick="loadExample('simple')" aria-label="加载简单示例">📄 简单示例</button>
                            <button class="quick-action-btn" onclick="loadExample('advanced')" aria-label="加载高级示例">🚀 高级示例</button>
                            <button class="quick-action-btn" onclick="uploadFile()" aria-label="上传Markdown文件">📁 上传文件</button>
                            <button class="quick-action-btn" onclick="loadFromLocal()" aria-label="加载本地草稿">📂 加载草稿</button>
                        </div>
                    </div>
                `;
            }
            
            // 重置统计
            updateWordCount();

            showToast('退出成功', '已退出登录，请重新输入密码', 'info', 2000);

            introModalShown = false;
        }
        
        // 显示升级提示界面
        function showUpgradePrompt(title, message, type) {
            // 简化升级选项，只推荐高级用户
            const upgradeRecommendation = `
                <div style="padding: 12px; margin: 8px 0; background: var(--preview-bg); border-radius: 8px; border-left: 4px solid var(--accent-primary);">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                        <span style="font-size: 18px;">⭐</span>
                        <strong style="color: var(--accent-primary);">高级用户</strong>
                    </div>
                    <div style="color: var(--text-secondary); margin-bottom: 8px;">
                        • 每日50次转换 (基础版15次)<br>
                        • 50K字符文档 (基础版10K)<br>
                        • 支持数学公式<br>
                        • 批量处理功能
                    </div>
                    <div style="background: var(--accent-primary); color: white; padding: 4px 8px; border-radius: 4px; display: inline-block; font-size: 12px; font-weight: 600;">
                        联系管理员获取密码
                    </div>
                </div>
            `;
            
            showConfirm(
                title,
                `${message}<br><br><strong>推荐升级方案：</strong><br>${upgradeRecommendation}`,
                '💎'
            );
        }
        
        // 检查是否已经验证过
        function checkAuthentication() {
            if (sessionStorage.getItem('authenticated') === 'true') {
                // 恢复用户权限信息
                const storedPermissions = sessionStorage.getItem('userPermissions');
                if (storedPermissions) {
                    currentUser = JSON.parse(storedPermissions);
                }
                
                // 恢复当前使用的密码
                const storedPassword = sessionStorage.getItem('currentPassword');
                if (storedPassword) {
                    currentPassword = storedPassword;

                    // 会话密码若已被撤销，强制要求重新登录
                    if (revokedPasswords.isRevoked(storedPassword)) {
                        sessionStorage.removeItem('authenticated');
                        sessionStorage.removeItem('userLevel');
                        sessionStorage.removeItem('userPermissions');
                        sessionStorage.removeItem('currentPassword');
                        currentUser = null;
                        currentPassword = null;
                        showToast('密码已撤销', '当前会话密码已失效，请重新登录', 'warning');
                        return;
                    }
                }
                
                document.getElementById('passwordOverlay').style.display = 'none';
                document.getElementById('mainApp').classList.add('authenticated');
                updateUserStatus(); // 恢复时更新状态
                initializeApp();
            } else {
                // 聚焦到密码输入框
                setTimeout(() => {
                    document.getElementById('passwordInput').focus();
                }, 100);
            }
        }
        
        // === AI智能修复系统 ===
        
        // API密钥加密/解密函数 - 简单混淆机制
        function encodeApiKey(key) {
            if (!key) return '';
            const shift = 5;
            const prefix = 'zk_';
            const encoded = btoa(key).split('').map(char => 
                String.fromCharCode(char.charCodeAt(0) + shift)
            ).join('');
            return prefix + encoded;
        }
        
        function decodeApiKey(encodedKey) {
            if (!encodedKey || !encodedKey.startsWith('zk_')) return encodedKey;
            const shift = 5;
            const encoded = encodedKey.substring(3);
            const decoded = encoded.split('').map(char => 
                String.fromCharCode(char.charCodeAt(0) - shift)
            ).join('');
            return atob(decoded);
        }

        // AI服务商配置
        const AI_CONFIGS = {
            kimi: {
                name: 'Kimi (moonshot)',
                endpoint: 'https://api.moonshot.cn/v1/chat/completions',
                models: [
                    { value: 'moonshot-v1-32k', label: 'moonshot-v1-32k (默认)' },
                    { value: 'moonshot-v1-8k', label: 'moonshot-v1-8k (8K备用)' },
                    { value: 'moonshot-v1-128k', label: 'moonshot-v1-128k (128K备用)' }
                ]
            },
            glm: {
                name: '智谱GLM',
                endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
                models: [
                    { value: 'glm-4-flash', label: 'GLM-4-Flash (快速版)' },
                    { value: 'glm-4-plus', label: 'GLM-4-Plus (高性能版)' }
                ]
            },
            baichuan: {
                name: '百川AI',
                endpoint: 'https://api.baichuan-ai.com/v1/chat/completions',
                models: [
                    { value: 'Baichuan3-Turbo-128k', label: 'Baichuan3-Turbo-128k' }
                ]
            },
            deepseek: {
                name: 'DeepSeek',
                endpoint: 'https://api.deepseek.com/v1/chat/completions',
                models: [
                    { value: 'deepseek-chat', label: 'deepseek-chat' }
                ]
            },
            openai: {
                name: 'OpenAI',
                endpoint: 'https://oapio.asia/v1/chat/completions',
                models: [
                    { value: 'gpt-4o-mini', label: 'GPT-4o-mini' },
                    { value: 'gpt-4o-2024-11-20', label: 'GPT-4o-2024-11-20' },
                    { value: 'claude-3-5-sonnet-20241022', label: 'Claude-3.5-Sonnet' },
                    { value: 'claude-sonnet-4-20250514', label: 'Claude-4.0-Sonnet' }
                ]
            },
            gemini: {
                name: 'Gemini-2.5-Flash',
                endpoint: 'https://uaznplcgugss.ap-southeast-1.clawcloudrun.com/v1/chat/completions',
                models: [
                    { value: 'gemini-2.5-flash', label: 'Gemini-2.5-Flash (快速版)' }
                ]
            }
        };
        
        // 自定义AI配置模板库
        const AI_CONFIG_TEMPLATES = {
            anthropic: {
                name: 'Anthropic Claude',
                endpoint: 'https://api.anthropic.com/v1/messages',
                models: [
                    { value: 'claude-3-5-sonnet-20241022', label: 'Claude-3.5-Sonnet' },
                    { value: 'claude-3-opus-20240229', label: 'Claude-3-Opus' },
                    { value: 'claude-3-haiku-20240307', label: 'Claude-3-Haiku' }
                ],
                headers: {
                    'anthropic-version': '2023-06-01'
                }
            },
            ollama: {
                name: 'Ollama (本地)',
                endpoint: 'http://localhost:11434/v1/chat/completions',
                models: [
                    { value: 'llama3.2', label: 'Llama 3.2' },
                    { value: 'mistral', label: 'Mistral' },
                    { value: 'codellama', label: 'Code Llama' }
                ]
            },
            groq: {
                name: 'Groq',
                endpoint: 'https://api.groq.com/openai/v1/chat/completions',
                models: [
                    { value: 'llama-3.1-405b-reasoning', label: 'Llama 3.1 405B' },
                    { value: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B' },
                    { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' }
                ]
            },
            together: {
                name: 'Together AI',
                endpoint: 'https://api.together.xyz/v1/chat/completions',
                models: [
                    { value: 'meta-llama/Llama-3-70b-chat-hf', label: 'Llama 3 70B Chat' },
                    { value: 'mistralai/Mixtral-8x7B-Instruct-v0.1', label: 'Mixtral 8x7B' },
                    { value: 'NousResearch/Nous-Hermes-2-Yi-34B', label: 'Nous Hermes 2 Yi 34B' }
                ]
            },
            perplexity: {
                name: 'Perplexity',
                endpoint: 'https://api.perplexity.ai/chat/completions',
                models: [
                    { value: 'llama-3.1-sonar-small-128k-online', label: 'Llama 3.1 Sonar Small (在线)' },
                    { value: 'llama-3.1-sonar-large-128k-online', label: 'Llama 3.1 Sonar Large (在线)' },
                    { value: 'llama-3.1-sonar-huge-128k-online', label: 'Llama 3.1 Sonar Huge (在线)' }
                ]
            }
        };
        
        // 自定义AI配置管理器
        const customAIConfigs = {
            // 从localStorage加载自定义配置
            load() {
                const stored = localStorage.getItem('customAIConfigs');
                return stored ? JSON.parse(stored) : {};
            },
            
            // 保存自定义配置到localStorage
            save(configs) {
                localStorage.setItem('customAIConfigs', JSON.stringify(configs));
            },
            
            // 添加新的自定义配置
            add(id, config) {
                const configs = this.load();
                configs[id] = {
                    ...config,
                    isCustom: true,
                    createdAt: new Date().toISOString()
                };
                this.save(configs);
                return id;
            },
            
            // 删除自定义配置
            remove(id) {
                const configs = this.load();
                delete configs[id];
                this.save(configs);
            },
            
            // 获取所有配置（预设+自定义）
            getAll() {
                const customConfigs = this.load();
                return { ...AI_CONFIGS, ...customConfigs };
            },
            
            // 获取单个配置
            get(id) {
                const allConfigs = this.getAll();
                return allConfigs[id] || null;
            },
            
            // 验证配置格式
            validate(config) {
                const errors = [];
                
                if (!config.name || typeof config.name !== 'string' || config.name.trim().length === 0) {
                    errors.push('服务商名称不能为空');
                }
                
                if (!config.endpoint || typeof config.endpoint !== 'string') {
                    errors.push('API端点不能为空');
                } else {
                    try {
                        new URL(config.endpoint);
                    } catch {
                        errors.push('API端点格式不正确，请输入有效的URL');
                    }
                }
                
                if (!config.models || !Array.isArray(config.models) || config.models.length === 0) {
                    errors.push('至少需要一个模型');
                } else {
                    config.models.forEach((model, index) => {
                        if (!model.value || typeof model.value !== 'string') {
                            errors.push(`模型${index + 1}的值不能为空`);
                        }
                        if (!model.label || typeof model.label !== 'string') {
                            errors.push(`模型${index + 1}的显示名称不能为空`);
                        }
                    });
                }
                
                return errors;
            }
        };
        
        // AI修复的系统提示词
        const AI_SYSTEM_PROMPTS = {
            quick_fix: `你是Markdown格式修复专家。请修复用户提供的文本，使其符合标准Markdown语法和中文写作规范：

1. 修复标题格式（确保 # 前后都有空格，层次清晰H1-H6）
2. 修复列表格式（确保 - 或 1. 前后都各自有空格，支持嵌套和任务列表）
3. 修复代码块格式（确保正确的\`\`\`包围，添加语言标识）
4. 修复链接格式（[text](url)）和图片格式（![alt](url)）
5. 修复表格格式（确保正确的|分隔和对齐）
6. 修复引用格式（确保 > 前后都各自有空格，支持多级引用）
7. 修复强调格式（粗体、斜体、删除线等等，确保符号出现的前与后都各自至少有1个空格(\ )，不要与其他内容直接连在一起）
8. 中英文混排优化（在中文与英文、数字间添加空格）
9. 标点符号规范化（使用中文标点符号）
10. 公式格式修复（LaTeX公式必须写在一行内，避免换行导致预览失效，公式代码前后都要各自保留有空格）
11. 保持原有内容含义和逻辑结构不变
12. 禁用在数学模式中直接使用带变音的 Unicode 字符（如 ȧ、ẍ、ā 等），统一改写为等价的 LaTeX 记号（\dot{a}、\ddot{x}、\bar{a}…）。
13. 强调边界空格规则:在中文（含全角标点）与 Markdown 强调定界符之间必须留一个空格。适用于 *、_、**、__、~~。定界符外侧与相邻的中文/全角标点之间留 1 个空格；定界符内侧与被强调内容之间不留空格。例如：
✅ 正确：……“ **读图说明手册** ”……
❌ 错误：……“**读图说明手册**”……
✅ 正确：逐一讲解， **每个子图说明** 坐标含义……
❌ 错误：逐一讲解，**每个子图说明**坐标含义……
✅ 正确：这是 *斜体* 与 **粗体** 的示例。
❌ 错误：这是*斜体*与**粗体**的示例。
重要：只返回修复后的Markdown文本，不要添加任何解释说明或代码块包装。
注意： 不要在代码、链接、图片语法里改动空格；不要在定界符内部加空格（如 ** 粗体 ** 是错的）。

请修复以下内容：`,

            advanced_optimize: `你是文档优化专家。请深度优化用户的Markdown文档，从结构、内容、可读性三个维度提升质量：

文档结构优化：
1. 完善H1-H6标题层次结构，确保逻辑清晰
2. 优化标题以便生成清晰的目录结构
3. 合理分段，每段主题明确，长度适中
4. 添加适当的分割线区分主要章节
5. 通过缩进、列表、引用等体现内容层次关系

内容质量提升：
1. 优化段落间的逻辑连接，确保内容流畅
2. 在合适位置添加必要的说明和示例
3. 通过粗体、斜体、引用等强调关键信息
4. 改进表格结构，增加可读性和信息密度
5. 合理使用有序/无序列表，优化信息展示

可读性增强：
1. 通过空行、分隔线创建视觉层次
2. 优化中英文混排，规范标点符号使用
3. 完善代码块格式，添加语言标识
4. 确保LaTeX公式单行书写，格式标准
5. 改进链接描述文本，提升用户体验

技术细节处理：
- 确保所有公式的LaTeX代码在一行内，避免预览失效
- 优化粗体和斜体格式，确保符号后正确空格
- 统一代码风格，添加必要的语法高亮标识
- 规范化引用格式，支持多级引用结构

专业化增强：
- 学术文档：添加适当的引用和参考格式
- 技术文档：完善代码示例和技术说明
- 商业文档：优化结构化信息展示
- 个人笔记：提升逻辑性和可检索性

重要：保持原有核心内容和观点不变，只返回优化后的完整Markdown文本，不要添加任何解释说明或代码块包装。

请深度优化以下内容：`
        };
        
        // AI使用配额管理
        const AI_USAGE_LIMITS = {
            basic: 20,        // 基础用户每日20次
            advanced: 20,     // 高级用户每日20次
            super_admin: -1   // 超级管理员无限制
        };
        const AI_MIN_INTERVAL_MS = 3000; // 最短调用间隔
        const AI_REQUEST_TIMEOUT_MS = 25000; // 单次请求超时
        const AI_MAX_RETRY = 2; // 额外重试次数
        let lastAICallAt = 0;
        
        // 预配置的AI服务（所有用户可用）
        const PRESET_AI_CONFIGS = {
            kimi: {
                provider: 'kimi',
                model: 'moonshot-v1-32k',
                apiKey: encodeApiKey('sk-gHkveDRADoUyhVOFxxN2oUBYft8A1sQ6Xc1czwaoVtySgKD2'),
                temperature: 0.3,
                maxTokens: 4096,
                fixFormat: true,
                fixSyntax: true,
                optimizeContent: false,
                addStructure: false
            },
            glm: {
                provider: 'glm',
                model: 'glm-4-flash',
                apiKey: encodeApiKey('ee0a994d6669c2249075f43be85a3a91.6oA7rMgYPFeSckwQ'),
                temperature: 0.3,
                maxTokens: 4096,
                fixFormat: true,
                fixSyntax: true,
                optimizeContent: false,
                addStructure: false
            }
        };
        
        // 默认使用Kimi配置
        let PRESET_AI_CONFIG = PRESET_AI_CONFIGS.kimi;
        
        // 选择AI服务提供商
        function selectAIProvider(provider) {
            if (PRESET_AI_CONFIGS[provider]) {
                PRESET_AI_CONFIG = PRESET_AI_CONFIGS[provider];
                
                // 更新按钮样式
                const kimiBtn = document.getElementById('selectKimi');
                const glmBtn = document.getElementById('selectGLM');
                
                if (kimiBtn && glmBtn) {
                    if (provider === 'kimi') {
                        kimiBtn.style.background = 'var(--accent-primary)';
                        kimiBtn.style.color = 'white';
                        kimiBtn.style.borderColor = 'var(--accent-primary)';
                        
                        glmBtn.style.background = 'transparent';
                        glmBtn.style.color = 'var(--text-primary)';
                        glmBtn.style.borderColor = 'var(--text-muted)';
                    } else {
                        glmBtn.style.background = 'var(--accent-primary)';
                        glmBtn.style.color = 'white';
                        glmBtn.style.borderColor = 'var(--accent-primary)';
                        
                        kimiBtn.style.background = 'transparent';
                        kimiBtn.style.color = 'var(--text-primary)';
                        kimiBtn.style.borderColor = 'var(--text-muted)';
                    }
                }
                
                // 保存选择到本地存储
                localStorage.setItem('selectedAIProvider', provider);
                
                // 显示选择成功提示
                showToast('设置成功', `已选择 ${PRESET_AI_CONFIG.provider === 'kimi' ? 'Kimi AI' : 'GLM-4-Flash'} 服务`, 'success');
            }
        }
        
        // 加载保存的AI提供商选择
        function loadAIProviderSelection() {
            const savedProvider = localStorage.getItem('selectedAIProvider');
            if (savedProvider && PRESET_AI_CONFIGS[savedProvider]) {
                PRESET_AI_CONFIG = PRESET_AI_CONFIGS[savedProvider];
            }
        }
        
        // 初始化时加载选择
        loadAIProviderSelection();
        
        // 显示AI配置模态框
        function showAIConfigModal() {
            // 所有用户可直接打开完整配置
            showFullAIConfig();
        }
        
        // 高级用户的简化AI配置界面
        function showSimpleAIConfig() {
            showConfirm(
                '🤖 AI智能修复',
                `
                <div style="text-align: left; max-width: 450px;">
                    <div style="background: var(--preview-bg); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="margin-top: 0; color: var(--accent-primary);">🎉 即开即用</h3>
                        <p style="margin: 10px 0; color: var(--text-secondary);">
                            我们已为您预配置好 <strong>Kimi moonshot-v1-32k</strong> 和 <strong>GLM-4-Flash</strong> 服务，无需额外设置！
                        </p>
                        
                        <div style="margin: 15px 0;">
                            <h4 style="color: var(--text-primary); margin-bottom: 10px;">🤖 选择AI服务</h4>
                            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                                <button id="selectKimi" onclick="selectAIProvider('kimi')" style="flex: 1; padding: 8px 12px; border: 2px solid var(--accent-primary); background: var(--accent-primary); color: white; border-radius: 6px; cursor: pointer; font-size: 14px;">
                                    🌙 Kimi (默认)
                                </button>
                                <button id="selectGLM" onclick="selectAIProvider('glm')" style="flex: 1; padding: 8px 12px; border: 2px solid var(--text-muted); background: transparent; color: var(--text-primary); border-radius: 6px; cursor: pointer; font-size: 14px;">
                                    ⚡ GLM-4-Flash
                                </button>
                            </div>
                        </div>
                        
                        <div style="background: rgba(255, 107, 107, 0.1); padding: 15px; border-radius: 6px; border-left: 3px solid #ff6b6b; margin: 15px 0;">
                            <div style="font-weight: 600; margin-bottom: 5px;">📊 使用配额</div>
                            <div style="font-size: 14px; color: var(--text-secondary);">
                                今日剩余: <strong id="simpleAiUsageCount" style="color: #ff6b6b;">--</strong> 次
                            </div>
                        </div>
                        
                        <div style="margin-top: 20px;">
                            <h4 style="color: var(--text-primary); margin-bottom: 10px;">✨ 使用方法</h4>
                            <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
                                <li>在输入框中编写或粘贴Markdown内容</li>
                                <li>点击 <strong>⚡ 整体修复</strong> 自动修复格式问题</li>
                                <li>点击 <strong>🧠 深度优化</strong> 重新组织文档结构</li>
                                <li>使用快捷键 <strong>Ctrl+Alt+F</strong> 整体修复</li>
                            </ul>
                        </div>
                    </div>
                </div>
                `,
                '🚀'
            ).then(() => {
                // 自动为高级用户设置预配置
                ensurePresetConfig();
                // 更新使用次数显示
                updateSimpleAIUsageDisplay();
            });
        }
        
        // 超级管理员的完整AI配置界面
        function showFullAIConfig() {
            ensurePresetConfig();
            // 更新服务商选择器（加载自定义配置）
            updateProviderSelector();
            // 加载保存的配置
            loadAIConfig();
            document.getElementById('aiConfigModal').style.display = 'block';
        }
        
        // 确保有预配置
        function ensurePresetConfig() {
            const savedConfig = localStorage.getItem('aiConfig');
            if (!savedConfig) {
                // 如果没有配置，使用预设配置
                localStorage.setItem('aiConfig', JSON.stringify(PRESET_AI_CONFIG));
            }
        }
        
        // 更新简化界面的使用次数显示
        function updateSimpleAIUsageDisplay() {
            if (!currentUser) return;
            
            const today = new Date().toDateString();
            const usageKey = `ai_usage_${currentUser.level}_${today}`;
            const currentUsage = parseInt(localStorage.getItem(usageKey) || '0');
            const limit = AI_USAGE_LIMITS[currentUser.level];
            
            const usageCountElement = document.getElementById('simpleAiUsageCount');
            if (usageCountElement) {
                usageCountElement.textContent = limit === -1 ? '∞' : `${Math.max(limit - currentUsage, 0)}`;
            }
        }
        
        // 关闭AI配置模态框
        function closeAIConfigModal() {
            document.getElementById('aiConfigModal').style.display = 'none';
        }
        
        // 更新AI模型选择
        function updateAIModels() {
            const provider = document.getElementById('aiProvider').value;
            const modelSelect = document.getElementById('aiModel');
            const customConfigSection = document.getElementById('customConfigSection');
            
            // 处理自定义服务商
            if (provider === 'custom') {
                customConfigSection.style.display = 'block';
                modelSelect.innerHTML = '<option value="">请先配置自定义服务商</option>';
                
                // 确保有至少一个模型输入框
                const modelsList = document.getElementById('customModelsList');
                if (modelsList.children.length === 0) {
                    addCustomModelItem('', '');
                }
                return;
            } else {
                customConfigSection.style.display = 'none';
            }
            
            // 获取配置（预设或自定义）
            const allConfigs = customAIConfigs.getAll();
            const config = allConfigs[provider];
            
            if (!config) {
                console.error('未找到AI配置:', provider);
                return;
            }
            
            // 清空当前选项
            modelSelect.innerHTML = '';
            
            // 添加新的模型选项
            config.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.value;
                option.textContent = model.label;
                modelSelect.appendChild(option);
            });
        }
        
        // 显示配置模板选择器
        function showConfigTemplates() {
            const templates = Object.keys(AI_CONFIG_TEMPLATES);
            let templateOptions = templates.map(key => {
                const template = AI_CONFIG_TEMPLATES[key];
                return `<option value="${key}">${template.name}</option>`;
            }).join('');
            
            showConfirm(
                '📋 选择配置模板',
                `
                <div style="text-align: left; max-width: 400px;">
                    <p style="margin-bottom: 15px; color: var(--text-secondary);">选择一个预设模板快速配置：</p>
                    <select id="templateSelector" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 15px;">
                        <option value="">请选择模板...</option>
                        ${templateOptions}
                    </select>
                    <div style="background: var(--preview-bg); padding: 12px; border-radius: 6px; margin-bottom: 15px;">
                        <div id="templatePreview" style="font-size: 14px; color: var(--text-secondary);">
                            选择模板后将显示配置预览...
                        </div>
                    </div>
                </div>
                `,
                '🚀'
            ).then(() => {
                const selectedTemplate = document.getElementById('templateSelector').value;
                if (selectedTemplate) {
                    loadConfigTemplate(selectedTemplate);
                }
            });
            
            // 添加模板预览功能
            setTimeout(() => {
                const selector = document.getElementById('templateSelector');
                if (selector) {
                    selector.addEventListener('change', function() {
                        const templateKey = this.value;
                        const preview = document.getElementById('templatePreview');
                        if (templateKey && preview) {
                            const template = AI_CONFIG_TEMPLATES[templateKey];
                            preview.innerHTML = `
                                <strong>${template.name}</strong><br>
                                <span style="font-size: 12px;">端点：${template.endpoint}</span><br>
                                <span style="font-size: 12px;">模型数量：${template.models.length} 个</span>
                            `;
                        }
                    });
                }
            }, 100);
        }
        
        // 加载配置模板
        function loadConfigTemplate(templateKey) {
            const template = AI_CONFIG_TEMPLATES[templateKey];
            if (!template) return;
            
            // 填充表单
            document.getElementById('customProviderName').value = template.name;
            document.getElementById('customEndpoint').value = template.endpoint;
            
            // 清空并重新填充模型列表
            const modelsList = document.getElementById('customModelsList');
            modelsList.innerHTML = '';
            
            template.models.forEach(model => {
                addCustomModelItem(model.value, model.label);
            });
            
            // 填充高级选项
            if (template.headers) {
                document.getElementById('customHeaders').value = JSON.stringify(template.headers, null, 2);
            }
            
            showToast('模板加载成功', `已加载 ${template.name} 配置模板`, 'success');
        }
        
        // 添加自定义模型
        function addCustomModel() {
            addCustomModelItem('', '');
        }
        
        // 添加自定义模型项
        function addCustomModelItem(modelValue = '', labelValue = '') {
            const modelsList = document.getElementById('customModelsList');
            const modelItem = document.createElement('div');
            modelItem.className = 'custom-model-item';
            modelItem.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px; align-items: center;';
            
            modelItem.innerHTML = `
                <input type="text" placeholder="模型ID (如: gpt-4)" value="${modelValue}" style="flex: 1; padding: 6px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 13px;">
                <input type="text" placeholder="显示名称 (如: GPT-4)" value="${labelValue}" style="flex: 1; padding: 6px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 13px;">
                <button onclick="removeCustomModel(this)" style="background: var(--warning); color: white; border: none; padding: 4px 6px; border-radius: 3px; cursor: pointer; font-size: 11px;">🗑️</button>
            `;
            
            modelsList.appendChild(modelItem);
        }
        
        // 移除自定义模型
        function removeCustomModel(button) {
            const modelItem = button.closest('.custom-model-item');
            const modelsList = document.getElementById('customModelsList');
            
            // 确保至少保留一个模型输入框
            if (modelsList.children.length > 1) {
                modelItem.remove();
            } else {
                showToast('提示', '至少需要保留一个模型配置', 'warning');
            }
        }
        
        // 验证自定义配置
        function validateCustomConfig() {
            const config = getCustomConfigFromForm();
            if (!config) return;
            
            const errors = customAIConfigs.validate(config);
            
            if (errors.length > 0) {
                showToast('配置验证失败', errors.join('\\n'), 'error', 5000);
                return false;
            }
            
            showToast('配置验证成功', '自定义配置格式正确！', 'success');
            return true;
        }
        
        // 从表单获取自定义配置
        function getCustomConfigFromForm() {
            const name = document.getElementById('customProviderName').value.trim();
            const endpoint = document.getElementById('customEndpoint').value.trim();
            
            if (!name || !endpoint) {
                showToast('配置不完整', '请填写服务商名称和API端点', 'warning');
                return null;
            }
            
            // 获取模型列表
            const modelItems = document.querySelectorAll('.custom-model-item');
            const models = [];
            
            modelItems.forEach(item => {
                const inputs = item.querySelectorAll('input');
                const modelValue = inputs[0].value.trim();
                const labelValue = inputs[1].value.trim();
                
                if (modelValue && labelValue) {
                    models.push({ value: modelValue, label: labelValue });
                }
            });
            
            if (models.length === 0) {
                showToast('配置不完整', '请至少添加一个模型', 'warning');
                return null;
            }
            
            const config = {
                name: name,
                endpoint: endpoint,
                models: models
            };
            
            // 处理高级选项
            const headersText = document.getElementById('customHeaders').value.trim();
            const paramsText = document.getElementById('customParams').value.trim();
            
            if (headersText) {
                try {
                    config.headers = JSON.parse(headersText);
                } catch (error) {
                    showToast('JSON格式错误', '自定义请求头格式不正确', 'error');
                    return null;
                }
            }
            
            if (paramsText) {
                try {
                    config.params = JSON.parse(paramsText);
                } catch (error) {
                    showToast('JSON格式错误', '请求参数格式不正确', 'error');
                    return null;
                }
            }
            
            return config;
        }
        
        // 保存自定义配置
        function saveCustomConfig() {
            const config = getCustomConfigFromForm();
            if (!config) return;
            
            if (!validateCustomConfig()) return;
            
            // 生成唯一ID
            const configId = 'custom_' + Date.now();
            
            // 保存配置
            customAIConfigs.add(configId, config);
            
            // 更新服务商选择器
            updateProviderSelector();
            
            // 选择新添加的配置
            document.getElementById('aiProvider').value = configId;
            updateAIModels();
            
            showToast('保存成功', `自定义配置"${config.name}"已保存`, 'success');
        }
        
        // 更新服务商选择器
        function updateProviderSelector() {
            const providerSelect = document.getElementById('aiProvider');
            const currentValue = providerSelect.value;
            
            // 重新构建选项
            const allConfigs = customAIConfigs.getAll();
            
            // 保存原有选项
            const defaultOptions = [
                { value: 'kimi', label: 'Kimi (moonshot)' },
                { value: 'glm', label: '智谱GLM' },
                { value: 'baichuan', label: '百川AI' },
                { value: 'deepseek', label: 'DeepSeek' },
                { value: 'openai', label: 'OpenAI' },
                { value: 'gemini', label: 'Gemini-2.5-Flash' }
            ];
            
            providerSelect.innerHTML = '';
            
            // 添加预设选项
            defaultOptions.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option.value;
                optionElement.textContent = option.label;
                providerSelect.appendChild(optionElement);
            });
            
            // 添加自定义配置
            Object.keys(allConfigs).forEach(key => {
                const config = allConfigs[key];
                if (config.isCustom) {
                    const optionElement = document.createElement('option');
                    optionElement.value = key;
                    optionElement.textContent = `🔧 ${config.name}`;
                    optionElement.style.color = 'var(--accent-primary)';
                    providerSelect.appendChild(optionElement);
                }
            });
            
            // 添加自定义选项
            const customOption = document.createElement('option');
            customOption.value = 'custom';
            customOption.textContent = '🔧 自定义服务商';
            customOption.style.fontWeight = 'bold';
            customOption.style.color = 'var(--accent-primary)';
            providerSelect.appendChild(customOption);
            
            // 恢复选择
            if (currentValue) {
                providerSelect.value = currentValue;
            }
        }
        
        // 导出自定义配置
        function exportCustomConfig() {
            const config = getCustomConfigFromForm();
            if (!config) return;
            
            const exportData = {
                version: '1.0',
                config: config,
                exportedAt: new Date().toISOString()
            };
            
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `ai-config-${config.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
            link.click();
            
            showToast('导出成功', '配置文件已下载', 'success');
        }
        
        // 导入自定义配置
        function importCustomConfig() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            
            input.onchange = function(event) {
                const file = event.target.files[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        const importData = JSON.parse(e.target.result);
                        
                        if (!importData.config) {
                            throw new Error('配置文件格式不正确');
                        }
                        
                        const config = importData.config;
                        
                        // 验证配置
                        const errors = customAIConfigs.validate(config);
                        if (errors.length > 0) {
                            throw new Error('配置验证失败: ' + errors.join(', '));
                        }
                        
                        // 填充表单
                        document.getElementById('customProviderName').value = config.name || '';
                        document.getElementById('customEndpoint').value = config.endpoint || '';
                        
                        // 清空并填充模型列表
                        const modelsList = document.getElementById('customModelsList');
                        modelsList.innerHTML = '';
                        
                        if (config.models && config.models.length > 0) {
                            config.models.forEach(model => {
                                addCustomModelItem(model.value, model.label);
                            });
                        } else {
                            addCustomModelItem('', '');
                        }
                        
                        // 填充高级选项
                        if (config.headers) {
                            document.getElementById('customHeaders').value = JSON.stringify(config.headers, null, 2);
                        }
                        
                        if (config.params) {
                            document.getElementById('customParams').value = JSON.stringify(config.params, null, 2);
                        }
                        
                        showToast('导入成功', `配置"${config.name}"已导入`, 'success');
                        
                    } catch (error) {
                        console.error('导入配置失败:', error);
                        showToast('导入失败', error.message, 'error');
                    }
                };
                reader.readAsText(file);
            };
            
            input.click();
        }
        
        // 切换API密钥可见性
        function toggleAPIKeyVisibility() {
            const apiKeyInput = document.getElementById('aiApiKey');
            const toggleBtn = apiKeyInput.nextElementSibling;
            
            if (apiKeyInput.type === 'password') {
                apiKeyInput.type = 'text';
                toggleBtn.textContent = '🙈';
                toggleBtn.title = '隐藏API密钥';
            } else {
                apiKeyInput.type = 'password';
                toggleBtn.textContent = '👁️';
                toggleBtn.title = '显示API密钥';
            }
        }
        
        // 保存AI配置
        function saveAIConfig() {
            const provider = document.getElementById('aiProvider').value;
            const model = document.getElementById('aiModel').value;
            const apiKey = document.getElementById('aiApiKey').value.trim();
            const temperature = parseFloat(document.getElementById('aiTemperature').value || '0.3');
            const maxTokens = parseInt(document.getElementById('aiMaxTokens').value || '4096', 10);
            
            if (!apiKey) {
                showToast('配置错误', '请输入API密钥', 'warning');
                return;
            }
            
            // 保存配置到本地存储
            const config = {
                provider: provider,
                model: model,
                apiKey: apiKey,
                temperature: isNaN(temperature) ? 0.3 : temperature,
                maxTokens: isNaN(maxTokens) ? 4096 : maxTokens,
                fixFormat: document.getElementById('fixFormat').checked,
                fixSyntax: document.getElementById('fixSyntax').checked,
                optimizeContent: document.getElementById('optimizeContent').checked,
                addStructure: document.getElementById('addStructure').checked,
                timestamp: Date.now()
            };
            
            localStorage.setItem('aiConfig', JSON.stringify(config));
            
            showToast('配置保存', 'AI修复配置已保存', 'success');
            closeAIConfigModal();
            
            // 更新使用次数显示
            updateAIUsageDisplay();
            updateAIStatusBar();
        }
        
        // 加载AI配置
        function loadAIConfig() {
            const savedConfig = localStorage.getItem('aiConfig');
            if (savedConfig) {
                try {
                    const config = JSON.parse(savedConfig);
                    
                    document.getElementById('aiProvider').value = config.provider || 'kimi';
                    updateAIModels();
                    document.getElementById('aiModel').value = config.model || AI_CONFIGS[config.provider].models[0].value;
                    document.getElementById('aiApiKey').value = config.apiKey || '';
                    document.getElementById('aiTemperature').value = config.temperature ?? 0.3;
                    document.getElementById('aiMaxTokens').value = config.maxTokens ?? 4096;
                    document.getElementById('fixFormat').checked = config.fixFormat !== false;
                    document.getElementById('fixSyntax').checked = config.fixSyntax !== false;
                    document.getElementById('optimizeContent').checked = config.optimizeContent !== false;
                    document.getElementById('addStructure').checked = config.addStructure !== false;
                } catch (error) {
                    console.error('加载AI配置失败:', error);
                }
            } else {
                // 默认配置
                updateAIModels();
            }

            updateAIStatusBar();
        }
        
        // 检查是否可以使用AI修复功能
        function canUseAIFix() {
            return !!currentUser;
        }
        
        // 检查AI使用配额
        function checkAIUsageLimit() {
            if (!currentUser) return false;
            
            const today = new Date().toDateString();
            const usageKey = `ai_usage_${currentUser.level}_${today}`;
            const currentUsage = parseInt(localStorage.getItem(usageKey) || '0');
            const limit = AI_USAGE_LIMITS[currentUser.level];
            
            return limit === -1 || currentUsage < limit;
        }
        
        // 增加AI使用次数
        function incrementAIUsage() {
            if (!currentUser) return;
            
            const today = new Date().toDateString();
            const usageKey = `ai_usage_${currentUser.level}_${today}`;
            const currentUsage = parseInt(localStorage.getItem(usageKey) || '0');
            
            localStorage.setItem(usageKey, (currentUsage + 1).toString());
            updateAIUsageDisplay();
        }
        
        // 更新AI使用次数显示
        function updateAIUsageDisplay() {
            if (!currentUser || !canUseAIFix()) return;
            
            const today = new Date().toDateString();
            const usageKey = `ai_usage_${currentUser.level}_${today}`;
            const currentUsage = parseInt(localStorage.getItem(usageKey) || '0');
            const limit = AI_USAGE_LIMITS[currentUser.level];
            
            const usageCountElement = document.getElementById('aiUsageCount');
            if (usageCountElement) {
                if (limit === -1) {
                    usageCountElement.textContent = '无限制';
                } else {
                    usageCountElement.textContent = `${limit - currentUsage}`;
                }
            }

            updateAIStatusBar();
        }

        function updateAIStatusBar() {
            const bar = document.getElementById('aiStatusBar');
            if (!bar) return;

            ensurePresetConfig();
            let config = PRESET_AI_CONFIG;
            const savedConfig = localStorage.getItem('aiConfig');
            if (savedConfig) {
                try {
                    config = JSON.parse(savedConfig);
                } catch (error) {
                    console.warn('AI状态栏配置解析失败，使用预设', error);
                }
            }

            const allConfigs = customAIConfigs.getAll();
            const providerName = allConfigs[config.provider]?.name || config.provider || '未配置';
            const model = config.model || (allConfigs[config.provider]?.models?.[0]?.value) || '未选模型';

            const providerEl = document.getElementById('aiStatusProvider');
            const modelEl = document.getElementById('aiStatusModel');
            const quotaEl = document.getElementById('aiStatusQuota');
            const lastEl = document.getElementById('aiStatusLast');

            if (providerEl) providerEl.textContent = providerName;
            if (modelEl) modelEl.textContent = model;

            let remaining = '--';
            if (currentUser) {
                const today = new Date().toDateString();
                const usageKey = `ai_usage_${currentUser.level}_${today}`;
                const currentUsage = parseInt(localStorage.getItem(usageKey) || '0');
                const limit = AI_USAGE_LIMITS[currentUser.level];
                remaining = limit === -1 ? '∞' : Math.max(limit - currentUsage, 0);
            }
            if (quotaEl) quotaEl.textContent = remaining;
            if (lastEl) {
                lastEl.textContent = lastAIErrorMessage ? `⚠️ ${lastAIErrorMessage}` : '✅ 状态良好';
            }

            bar.classList.toggle('is-warning', !!lastAIErrorMessage);
        }

        // AI修复交互状态
        let pendingAIRequest = null;
        let pendingAIResult = null;
        let currentAIFixController = null;
        let aiStatusCard = null;
        let aiStatusMessageEl = null;
        let aiStatusProgressFill = null;
        let aiStatusCancelBtn = null;
        let aiStatusProgress = 0;
        let aiStatusTarget = 0;
        let aiStatusInterval = null;
        let introModalShown = false;
        
        // 快速AI修复功能
        async function performQuickAIFix() {
            if (currentAIFixController) {
                showToast('提示', 'AI修复正在进行，请等待当前操作完成', 'info');
                return;
            }

            if (!canUseAIFix()) {
                showToast('提示', '请先登录后再使用AI修复', 'info');
                return;
            }

            const markdownText = document.getElementById('markdownInput').value.trim();
            if (!markdownText) {
                showToast('提示', '请先输入需要修复的Markdown内容', 'warning');
                return;
            }

            if (!checkAIUsageLimit()) {
                showToast('配额不足', '今日AI修复次数已用完，请明天再试', 'warning');
                return;
            }

            pendingAIRequest = {
                content: markdownText,
                type: 'quick_fix',
                label: '整体修复'
            };
            openAIModeModal('整体修复');
        }

        async function performSelectedAIFix() {
            if (currentAIFixController) {
                showToast('提示', 'AI修复正在进行，请等待当前操作完成', 'info');
                return;
            }

            if (!canUseAIFix()) {
                showToast('提示', '请先登录后再使用AI修复', 'info');
                return;
            }

            if (!previewSupportsPartialSelection) {
                showToast('提示', '当前文档暂不支持局部修复，请尝试全文修复', 'info');
                return;
            }

            if (!selectedPreviewRange || selectedPreviewRange.end <= selectedPreviewRange.start) {
                showToast('提示', '请先在预览中选择需要修复的内容', 'info');
                return;
            }

            if (!checkAIUsageLimit()) {
                showToast('配额不足', '今日AI修复次数已用完，请明天再试', 'warning');
                return;
            }

            const { start, end } = selectedPreviewRange;
            const markdownText = markdownInput.value;
            const selectedText = markdownText.slice(start, end);

            if (!selectedText.trim()) {
                showToast('提示', '选中的内容为空，请重新选择', 'warning');
                return;
            }

            await performAIFix(selectedText, {
                type: 'quick_fix',
                mode: '局部修复',
                range: {
                    start,
                    end,
                    originalText: selectedText
                }
            });
        }

        // 深度AI优化功能
        async function performAdvancedAIFix() {
            if (currentAIFixController) {
                showToast('提示', 'AI修复正在进行，请等待当前操作完成', 'info');
                return;
            }

            if (!canUseAIFix()) {
                showUpgradePrompt(
                    'AI修复需要升级',
                    'AI智能修复功能仅对高级用户开放。\n升级后可享受每日10次AI修复服务！',
                    'ai'
                );
                return;
            }

            const markdownText = document.getElementById('markdownInput').value.trim();
            if (!markdownText) {
                showToast('提示', '请先输入需要优化的Markdown内容', 'warning');
                return;
            }

            if (!checkAIUsageLimit()) {
                showToast('配额不足', '今日AI修复次数已用完，请明天再试', 'warning');
                return;
            }

            pendingAIRequest = {
                content: markdownText,
                type: 'advanced_optimize',
                label: '深度优化'
            };
            openAIModeModal('深度优化');
        }
        
        // 核心AI修复功能
        async function performAIFix(content, options = {}) {
            if (!content) return null;

            const isPartialFix = options && options.range;
            if (isPartialFix) {
                const { start, end, originalText } = options.range;
                const currentSlice = markdownInput.value.slice(start, end);
                if (currentSlice !== originalText) {
                    showToast('提示', '选中的内容已变化，请重新选择后再试', 'warning');
                    return null;
                }
            }

            let config;
            ensurePresetConfig();
            const savedConfig = localStorage.getItem('aiConfig');
            if (savedConfig) {
                try {
                    config = JSON.parse(savedConfig);
                } catch (error) {
                    console.warn('AI配置解析失败，使用预设配置', error);
                    config = PRESET_AI_CONFIG;
                    localStorage.setItem('aiConfig', JSON.stringify(config));
                }
            } else {
                config = PRESET_AI_CONFIG;
                localStorage.setItem('aiConfig', JSON.stringify(config));
            }

            const allConfigs = customAIConfigs.getAll();
            const aiConfig = allConfigs[config.provider];
            if (!aiConfig) {
                showToast('配置错误', '不支持的AI服务商', 'error');
                return null;
            }

            const now = Date.now();
            if (now - lastAICallAt < AI_MIN_INTERVAL_MS) {
                const waitMs = AI_MIN_INTERVAL_MS - (now - lastAICallAt);
                showToast('操作过于频繁', `请稍候 ${Math.ceil(waitMs / 1000)} 秒后再试`, 'warning');
                return null;
            }
            lastAICallAt = now;

            const basePrompt = AI_SYSTEM_PROMPTS[options.type] || AI_SYSTEM_PROMPTS.quick_fix;
            const directives = buildAIModeDirectives(options);
            const finalSystemPrompt = directives ? `${basePrompt}\n\n${directives}` : basePrompt;

            resetAIStatus();
            updateAIStatus('准备发送请求...', 10, true);

            try {
                const temperature = typeof config.temperature === 'number' ? config.temperature : 0.3;
                const maxTokens = Number.isInteger(config.maxTokens) ? config.maxTokens : 4096;

                const headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${decodeApiKey(config.apiKey)}`
                };

                if (aiConfig.headers) {
                    Object.assign(headers, aiConfig.headers);
                }

                const requestBody = {
                    model: config.model,
                    messages: [
                        { role: 'system', content: finalSystemPrompt },
                        { role: 'user', content: content }
                    ],
                    temperature: Math.min(Math.max(temperature, 0), 2),
                    max_tokens: Math.max(1, maxTokens),
                    stream: false
                };

                if (aiConfig.params) {
                    Object.assign(requestBody, aiConfig.params);
                }
                
                const sendRequest = async (attempt) => {
                    let timedOut = false;
                    const controller = new AbortController();
                    currentAIFixController = controller;
                    const timeoutId = setTimeout(() => {
                        timedOut = true;
                        controller.abort();
                    }, AI_REQUEST_TIMEOUT_MS);

                    try {
                        if (attempt > 1) {
                            updateAIStatus(`正在重试 (${attempt}/${AI_MAX_RETRY + 1})...`, 35, true);
                        } else {
                            updateAIStatus(`正在连接 ${aiConfig.name} ...`, 30, true);
                        }

                        const response = await fetch(aiConfig.endpoint, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify(requestBody),
                            signal: controller.signal
                        });
                        clearTimeout(timeoutId);

                        if (!response.ok) {
                            let errorMessage = `API调用失败 (${response.status})`;
                            try {
                                const errorData = await response.json();
                                errorMessage += `: ${errorData.error?.message || errorData.message || '未知错误'}`;
                            } catch (e) {
                                errorMessage += `: ${response.statusText}`;
                            }
                            const err = new Error(errorMessage);
                            err.status = response.status;
                            throw err;
                        }

                        updateAIStatus('解析AI响应...', 65, false);

                        let data;
                        const contentType = response.headers.get('content-type') || '';
                        if (contentType.includes('application/json')) {
                            data = await response.json();
                        } else {
                            const rawText = await response.text();
                            try {
                                data = JSON.parse(rawText);
                            } catch (parseError) {
                                throw new Error('AI返回数据无法解析');
                            }
                        }

                        return { data };
                    } catch (err) {
                        if (controller.signal.aborted && !timedOut) {
                            // 用户主动取消，直接抛出
                            throw err;
                        }
                        if (timedOut) {
                            err.timedOut = true;
                        }
                        throw err;
                    } finally {
                        clearTimeout(timeoutId);
                        currentAIFixController = null;
                    }
                };

                let data;
                let lastError = null;
                for (let attempt = 1; attempt <= AI_MAX_RETRY + 1; attempt++) {
                    try {
                        const result = await sendRequest(attempt);
                        data = result.data;
                        lastError = null;
                        break;
                    } catch (err) {
                        lastError = err;
                        const isLast = attempt === AI_MAX_RETRY + 1;
                        if (isLast) {
                            throw err;
                        } else {
                            updateAIStatus('请求失败，正在重试...', 40, true);
                        }
                    }
                }

                if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
                    throw new Error('AI返回的数据格式不正确');
                }

                const fixedContent = (data.choices[0].message.content || '').trim();
                if (!fixedContent) {
                    throw new Error('AI返回了空的修复结果');
                }

                updateAIStatus('生成对比视图...', 85, false);

                const resultPacket = {
                    original: content,
                    improved: fixedContent,
                    provider: aiConfig.name,
                    options: {
                        ...options,
                        baseLabel: options.baseLabel || options.modeLabel || options.mode || 'AI修复',
                        modeVariantLabel: options.modeVariantLabel || '默认策略'
                    }
                };

                showAIResultModal(resultPacket);
                completeAIStatus(isPartialFix ? '局部修复完成，等待确认' : 'AI修复完成，等待确认', true);
                lastAIErrorMessage = '';
                updateAIStatusBar();

                return fixedContent;
            } catch (error) {
                if (error.name === 'AbortError') {
                    completeAIStatus('AI修复已取消', false);
                    showToast('已取消', 'AI修复已取消，文档未改动', 'info');
                } else {
                    completeAIStatus('AI修复失败', false);
                    const friendly = mapAIErrorMessage(error);
                    lastAIErrorMessage = friendly;
                    updateAIStatusBar();
                    showToast('修复失败', friendly, 'error', 5000);

                    if (/401|403|API密钥/.test(error.message)) {
                        setTimeout(() => {
                            showAIConfigModal();
                        }, 2000);
                    }

                    if (error.timedOut) {
                        incrementAIUsage();
                    }
                }
                return null;
            } finally {
                hideAIStatus(600);
            }
        }

        function buildAIModeDirectives(options = {}) {
            const parts = [];

            const enhanceFormat = options.enhanceFormat !== undefined ? options.enhanceFormat : true;
            const enhanceLanguage = options.enhanceLanguage !== undefined ? options.enhanceLanguage : true;
            const enhanceStructure = options.enhanceStructure !== undefined ? options.enhanceStructure : options.type === 'advanced_optimize';

            if (enhanceFormat) {
                parts.push('优先修正Markdown语法、表格、列表、代码块与引用等格式问题，确保文档可正确渲染。');
            }

            if (enhanceLanguage) {
                parts.push('润色语句，使表达准确、顺畅且符合中文书写习惯，但不得改变原有含义。');
            }

            if (enhanceStructure) {
                parts.push('可调整段落顺序、标题层级以及列表结构，以提升整体逻辑与可读性。');
            }

            if (options.preserveCodeBlocks !== false) {
                parts.push('所有代码块内容必须保持原样，不得改写代码，只能在代码块外部修复文字描述。');
            }

            if (options.preserveQuotes) {
                parts.push('引用块中的原文应尽量保持不变，仅可调整引用符号与标点格式。');
            }

            if (!parts.length) return '';
            return `附加要求：\n${parts.map((text, index) => `${index + 1}. ${text}`).join('\n')}`;
        }

        function mapAIErrorMessage(error) {
            if (!error || !error.message) return 'AI修复过程中发生未知错误';
            const message = error.message;
            const status = error.status || '';
            if (status === 401 || message.includes('401')) return 'API密钥无效，请检查配置或重新生成密钥';
            if (status === 403 || message.includes('403')) return 'AI服务拒绝访问，请确认账号权限或服务是否启用';
            if (status === 429 || message.includes('429')) return '调用频率超限，请稍后重试或降低请求频率';
            if (error.timedOut || message.includes('timeout')) return 'AI服务响应超时，请检查网络或稍后再试';
            if (message.includes('网络') || message.includes('fetch')) return '网络连接异常，无法访问AI服务';
            return `修复失败：${message}`;
        }

        function openAIModeModal(label = 'AI修复') {
            const modal = document.getElementById('aiModeModal');
            if (!modal) return;
            document.getElementById('aiModeIntro').textContent = `当前操作：${label}。请选择关注重点（可多选组合），AI 将按照指令执行。`;
            modal.style.display = 'flex';

            const formatToggle = document.getElementById('aiModeFormat');
            const languageToggle = document.getElementById('aiModeLanguage');
            const structureToggle = document.getElementById('aiModeStructure');

            const isAdvanced = pendingAIRequest?.type === 'advanced_optimize';

            if (formatToggle) formatToggle.checked = true;
            if (languageToggle) languageToggle.checked = !!isAdvanced;
            if (structureToggle) structureToggle.checked = !!isAdvanced;

            const preserveCode = document.getElementById('aiModePreserveCode');
            if (preserveCode) preserveCode.checked = true;
            const preserveQuotes = document.getElementById('aiModePreserveQuotes');
            if (preserveQuotes) preserveQuotes.checked = false;
        }

        function closeAIModeModal(resetRequest = true) {
            const modal = document.getElementById('aiModeModal');
            if (modal) {
                modal.style.display = 'none';
            }
            if (resetRequest) {
                pendingAIRequest = null;
            }
        }

        async function confirmAIModeSelection() {
            if (!pendingAIRequest) {
                closeAIModeModal();
                return;
            }

            const request = pendingAIRequest;
            closeAIModeModal(false);

            let enhanceFormat = document.getElementById('aiModeFormat')?.checked || false;
            let enhanceLanguage = document.getElementById('aiModeLanguage')?.checked || false;
            let enhanceStructure = document.getElementById('aiModeStructure')?.checked || false;
            const preserveCode = document.getElementById('aiModePreserveCode')?.checked !== false;
            const preserveQuotes = document.getElementById('aiModePreserveQuotes')?.checked || false;

            let selectedLabels = [];
            if (enhanceFormat) selectedLabels.push('格式修复');
            if (enhanceLanguage) selectedLabels.push('文案润色');
            if (enhanceStructure) selectedLabels.push('结构强化');

            if (!selectedLabels.length) {
                if (request.type === 'advanced_optimize') {
                    enhanceFormat = true;
                    enhanceLanguage = true;
                    enhanceStructure = true;
                    selectedLabels = ['格式修复', '文案润色', '结构强化'];
                    if (document.getElementById('aiModeFormat')) document.getElementById('aiModeFormat').checked = true;
                    if (document.getElementById('aiModeLanguage')) document.getElementById('aiModeLanguage').checked = true;
                    if (document.getElementById('aiModeStructure')) document.getElementById('aiModeStructure').checked = true;
                } else {
                    enhanceFormat = true;
                    enhanceLanguage = false;
                    enhanceStructure = false;
                    selectedLabels = ['格式修复'];
                    if (document.getElementById('aiModeFormat')) document.getElementById('aiModeFormat').checked = true;
                    if (document.getElementById('aiModeLanguage')) document.getElementById('aiModeLanguage').checked = false;
                    if (document.getElementById('aiModeStructure')) document.getElementById('aiModeStructure').checked = false;
                }
            }

            const options = {
                type: request.type,
                baseLabel: request.label,
                modeLabel: request.label,
                enhanceFormat,
                enhanceLanguage,
                enhanceStructure,
                selectedLabels,
                modeVariantLabel: selectedLabels.join(' + ') || '默认策略',
                preserveCodeBlocks: preserveCode,
                preserveQuotes: preserveQuotes
            };

            pendingAIRequest = null;
            try {
                await performAIFix(request.content, options);
            } catch (error) {
                console.error('AI修复执行失败:', error);
            }
        }

        function resetAIStatus() {
            aiStatusTarget = 0;
            aiStatusProgress = 0;
            ensureAIStatusCard();
            if (aiStatusProgressFill) {
                aiStatusProgressFill.style.width = '5%';
            }
        }

        function ensureAIStatusCard() {
            if (aiStatusCard) return;
            const stack = document.getElementById('previewStatusStack');
            if (!stack) return;

            aiStatusCard = document.createElement('div');
            aiStatusCard.className = 'status-card ai-status-card';
            aiStatusCard.innerHTML = `
                <div class="ai-status-header">
                    <div class="ai-status-message" id="aiStatusMessage"><span>🤖</span><span>AI修复准备中...</span></div>
                    <button type="button" id="aiStatusCancelBtn">中止</button>
                </div>
                <div class="ai-status-progress">
                    <div class="progress-bar-fill" id="aiStatusProgressFill"></div>
                </div>
            `;
            stack.appendChild(aiStatusCard);

            aiStatusMessageEl = document.getElementById('aiStatusMessage');
            aiStatusProgressFill = document.getElementById('aiStatusProgressFill');
            aiStatusCancelBtn = document.getElementById('aiStatusCancelBtn');
            if (aiStatusCancelBtn) {
                aiStatusCancelBtn.onclick = cancelCurrentAIFix;
            }
        }

        function updateAIStatus(message, targetProgress, allowCancel = true) {
            ensureAIStatusCard();
            if (!aiStatusCard) return;

            if (aiStatusMessageEl) {
                aiStatusMessageEl.innerHTML = `<span>🤖</span><span>${message}</span>`;
            }

            if (aiStatusCancelBtn) {
                aiStatusCancelBtn.style.display = allowCancel ? 'inline-flex' : 'none';
            }

            aiStatusTarget = Math.max(aiStatusTarget, Math.min(targetProgress, 95));

            if (!aiStatusInterval) {
                aiStatusInterval = setInterval(() => {
                    if (aiStatusProgress < aiStatusTarget) {
                        aiStatusProgress += 1;
                        if (aiStatusProgressFill) {
                            aiStatusProgressFill.style.width = `${aiStatusProgress}%`;
                        }
                    } else if (aiStatusProgress >= 95) {
                        clearInterval(aiStatusInterval);
                        aiStatusInterval = null;
                    }
                }, 80);
            }
        }

        function completeAIStatus(message, isSuccess) {
            updateAIStatus(message, 98, false);
            if (aiStatusProgressFill) {
                aiStatusProgressFill.style.width = '100%';
            }
            if (aiStatusMessageEl) {
                const icon = isSuccess ? '✅' : '⚠️';
                aiStatusMessageEl.innerHTML = `<span>${icon}</span><span>${message}</span>`;
            }
        }

        function hideAIStatus(delay = 0) {
            if (!aiStatusCard) return;
            const cardRef = aiStatusCard;
            const remove = () => {
                if (cardRef && cardRef.parentNode) {
                    cardRef.parentNode.removeChild(cardRef);
                }
                if (aiStatusCard === cardRef) {
                    aiStatusCard = null;
                    aiStatusMessageEl = null;
                    aiStatusProgressFill = null;
                    aiStatusCancelBtn = null;
                    if (aiStatusInterval) {
                        clearInterval(aiStatusInterval);
                        aiStatusInterval = null;
                    }
                }
            };
            if (delay > 0) {
                setTimeout(remove, delay);
            } else {
                remove();
            }
        }

        function cancelCurrentAIFix() {
            if (currentAIFixController) {
                currentAIFixController.abort();
            }
        }

        function showAIResultModal(resultPacket) {
            pendingAIResult = resultPacket;

            const summaryEl = document.getElementById('aiResultSummary');
            if (summaryEl) {
                summaryEl.innerHTML = '';
                const capabilityLabels = (resultPacket.options.selectedLabels && resultPacket.options.selectedLabels.length)
                    ? resultPacket.options.selectedLabels
                    : [
                        resultPacket.options.enhanceFormat !== false ? '格式修复' : null,
                        resultPacket.options.enhanceLanguage !== false ? '文案润色' : null,
                        resultPacket.options.enhanceStructure ? '结构强化' : null
                    ].filter(Boolean);

                const chips = [
                    `模式：${resultPacket.options.baseLabel}`,
                    `侧重点：${capabilityLabels.join(' + ') || '默认策略'}`,
                    `服务商：${resultPacket.provider}`
                ];

                if (resultPacket.options.preserveCodeBlocks !== false) chips.push('保持代码块');
                if (resultPacket.options.preserveQuotes) chips.push('保留引用');
                if (resultPacket.options.range) chips.push('范围：局部选区');

                chips.forEach(text => {
                    const chip = document.createElement('span');
                    chip.textContent = text;
                    summaryEl.appendChild(chip);
                });
            }

            const diffContainer = document.getElementById('aiDiffContainer');
            if (diffContainer) {
                renderMarkdownDiff(diffContainer, resultPacket.original, resultPacket.improved);
            }

            const originalPreview = document.getElementById('aiOriginalPreview');
            if (originalPreview) {
                originalPreview.textContent = resultPacket.original;
            }

            const improvedPreview = document.getElementById('aiImprovedPreview');
            if (improvedPreview) {
                improvedPreview.textContent = resultPacket.improved;
            }

            switchAIResultView('diff');

            const modal = document.getElementById('aiResultModal');
            if (modal) {
                modal.style.display = 'flex';
            }
        }

        function switchAIResultView(view) {
            const panels = {
                diff: document.getElementById('aiResultViewDiff'),
                original: document.getElementById('aiResultViewOriginal'),
                improved: document.getElementById('aiResultViewImproved')
            };

            const tabs = {
                diff: document.getElementById('aiResultTabDiff'),
                original: document.getElementById('aiResultTabOriginal'),
                improved: document.getElementById('aiResultTabImproved')
            };

            Object.keys(panels).forEach(key => {
                if (panels[key]) {
                    panels[key].classList.toggle('active', key === view);
                }
                if (tabs[key]) {
                    tabs[key].classList.toggle('active', key === view);
                    tabs[key].setAttribute('aria-selected', key === view ? 'true' : 'false');
                }
            });
        }

        function closeAIResultModal() {
            const modal = document.getElementById('aiResultModal');
            if (modal) {
                modal.style.display = 'none';
            }
        }

        function rejectAIResult() {
            const hasResult = !!pendingAIResult;
            closeAIResultModal();
            pendingAIResult = null;
            if (hasResult) {
                showToast('已保留原文', 'AI修复结果已放弃，不会修改当前文档', 'info');
            }
        }

        function applyAIResult() {
            if (!pendingAIResult) {
                closeAIResultModal();
                return;
            }

            const markdownInput = document.getElementById('markdownInput');
            const isPartial = pendingAIResult.options && pendingAIResult.options.range;

            if (isPartial) {
                const { start, end, originalText } = pendingAIResult.options.range;
                const currentContent = markdownInput.value;
                const currentSlice = currentContent.slice(start, end);
                if (currentSlice !== originalText) {
                    showToast('提示', '选中的内容已变化，请重新选择后再试', 'warning');
                    pendingAIResult = null;
                    closeAIResultModal();
                    return;
                }

                const improvedContent = pendingAIResult.improved;
                markdownInput.value = currentContent.slice(0, start) + improvedContent + currentContent.slice(end);
            } else {
                markdownInput.value = pendingAIResult.improved;
            }
            debouncedUpdatePreview();
            debouncedUpdateWordCount();
            incrementAIUsage();

            showToast('套用成功', `${pendingAIResult.options.baseLabel} 已写入文档`, 'success');

            pendingAIResult = null;
            closeAIResultModal();
            clearPreviewSelection();
        }

        function renderMarkdownDiff(container, original, improved) {
            if (!container) return;
            const oldLines = original.split(/\r?\n/);
            const newLines = improved.split(/\r?\n/);
            if (oldLines.length > 1200 || newLines.length > 1200) {
                container.innerHTML = '<span class="diff-line diff-skip">文档较大，已省略详细差异展示。</span>';
                return;
            }
            const diffItems = condenseUnchangedSegments(computeLineDiff(oldLines, newLines));

            container.innerHTML = '';
            diffItems.forEach(item => {
                const lineEl = document.createElement('span');
                let className = 'diff-unchanged';
                let prefix = ' ';

                if (item.type === 'added') {
                    className = 'diff-added';
                    prefix = '+';
                } else if (item.type === 'removed') {
                    className = 'diff-removed';
                    prefix = '-';
                } else if (item.type === 'skip') {
                    className = 'diff-skip';
                    prefix = '…';
                }

                lineEl.className = `diff-line ${className}`;
                lineEl.textContent = item.type === 'skip' ? item.value : `${prefix} ${item.value}`;
                container.appendChild(lineEl);
            });
        }

        function computeLineDiff(oldLines, newLines) {
            const m = oldLines.length;
            const n = newLines.length;
            const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

            for (let i = m - 1; i >= 0; i--) {
                for (let j = n - 1; j >= 0; j--) {
                    if (oldLines[i] === newLines[j]) {
                        dp[i][j] = dp[i + 1][j + 1] + 1;
                    } else {
                        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
                    }
                }
            }

            const result = [];
            let i = 0;
            let j = 0;

            while (i < m && j < n) {
                if (oldLines[i] === newLines[j]) {
                    result.push({ type: 'unchanged', value: oldLines[i] });
                    i++;
                    j++;
                } else if (dp[i + 1][j] >= dp[i][j + 1]) {
                    result.push({ type: 'removed', value: oldLines[i] });
                    i++;
                } else {
                    result.push({ type: 'added', value: newLines[j] });
                    j++;
                }
            }

            while (i < m) {
                result.push({ type: 'removed', value: oldLines[i++] });
            }

            while (j < n) {
                result.push({ type: 'added', value: newLines[j++] });
            }

            return result;
        }

        function condenseUnchangedSegments(diffItems) {
            const condensed = [];
            let buffer = [];

            const flush = () => {
                if (!buffer.length) return;
                if (buffer.length > 6) {
                    condensed.push(buffer[0], buffer[1]);
                    condensed.push({ type: 'skip', value: `... ${buffer.length - 4} 行未变化 ...` });
                    condensed.push(buffer[buffer.length - 2], buffer[buffer.length - 1]);
                } else {
                    condensed.push(...buffer);
                }
                buffer = [];
            };

            diffItems.forEach(item => {
                if (item.type === 'unchanged') {
                    buffer.push(item);
                } else {
                    flush();
                    condensed.push(item);
                }
            });

            flush();
            return condensed;
        }

        function shouldShowIntroModal() {
            const today = new Date().toDateString();
            const dismissedDate = localStorage.getItem('introModalDismissDate');
            return dismissedDate !== today;
        }

        function showIntroModal() {
            const modal = document.getElementById('introModal');
            if (!modal || introModalShown) return;
            introModalShown = true;
            modal.style.display = 'flex';
        }

        function closeIntroModal(mode = 'once') {
            const modal = document.getElementById('introModal');
            if (modal) {
                modal.style.display = 'none';
            }
            introModalShown = true;
            if (mode === 'today') {
                localStorage.setItem('introModalDismissDate', new Date().toDateString());
                showToast('今日不再提示', '今日剩余时间内将不再弹出欢迎介绍');
            }
        }
        
        // === AI修复用户体验优化 ===
        
        // 点击背景关闭相关模态框
        document.addEventListener('click', function(e) {
            const aiConfigModal = document.getElementById('aiConfigModal');
            if (e.target === aiConfigModal) {
                closeAIConfigModal();
            }

            const aiModeModal = document.getElementById('aiModeModal');
            if (e.target === aiModeModal) {
                closeAIModeModal();
            }

            const aiResultModal = document.getElementById('aiResultModal');
            if (e.target === aiResultModal) {
                rejectAIResult();
            }

            const introModal = document.getElementById('introModal');
            if (e.target === introModal) {
                closeIntroModal('once');
            }
        });
        
        // 键盘快捷键支持
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                const aiResultModal = document.getElementById('aiResultModal');
                if (aiResultModal && aiResultModal.style.display === 'flex') {
                    rejectAIResult();
                    return;
                }

                const aiModeModal = document.getElementById('aiModeModal');
                if (aiModeModal && aiModeModal.style.display === 'flex') {
                    closeAIModeModal();
                    return;
                }

                const aiConfigModal = document.getElementById('aiConfigModal');
                if (aiConfigModal && aiConfigModal.style.display === 'block') {
                    closeAIConfigModal();
                }

                const introModal = document.getElementById('introModal');
                if (introModal && introModal.style.display === 'flex') {
                    closeIntroModal('once');
                    return;
                }
            }

            // Ctrl+Alt+F 快速AI修复
            if (e.ctrlKey && e.altKey && (e.key === 'f' || e.key === 'F')) {
                e.preventDefault();
                if (canUseAIFix()) {
                    performQuickAIFix();
                }
            }
            
            // Ctrl+Alt+O AI深度优化
            if (e.ctrlKey && e.altKey && (e.key === 'o' || e.key === 'O')) {
                e.preventDefault();
                if (canUseAIFix()) {
                    performAdvancedAIFix();
                }
            }
        });
        
        // API配置验证功能
        async function validateAIConfig(config) {
            const aiConfig = AI_CONFIGS[config.provider];
            if (!aiConfig) {
                throw new Error('不支持的AI服务商');
            }
            
            if (!config.apiKey || config.apiKey.trim().length < 10) {
                throw new Error('API密钥格式不正确');
            }
            
            // 简单的API密钥格式验证
            const keyPatterns = {
                kimi: /^sk-[a-zA-Z0-9]{32,}$/,
                glm: /^[a-f0-9]{32}\.[a-zA-Z0-9]{16}$/,
                baichuan: /^sk-[a-f0-9]{32}$/,
                deepseek: /^sk-[a-f0-9]{32}$/,
                openai: /^sk-[a-zA-Z0-9]{32,}$/
            };
            
            const pattern = keyPatterns[config.provider];
            if (pattern && !pattern.test(config.apiKey)) {
                console.warn(`API密钥格式可能不正确: ${config.provider}`);
            }
            
            return true;
        }
        
        // 测试AI配置连接
        async function testAIConnection() {
            const savedConfig = localStorage.getItem('aiConfig');
            if (!savedConfig) {
                showToast('配置错误', '请先保存AI配置', 'warning');
                return;
            }
            
            let config;
            try {
                config = JSON.parse(savedConfig);
                await validateAIConfig(config);
            } catch (error) {
                showToast('配置验证失败', error.message, 'error');
                return;
            }
            
            // 获取AI配置（支持自定义配置）
            const allConfigs = customAIConfigs.getAll();
            const aiConfig = allConfigs[config.provider];
            
            if (!aiConfig) {
                showToast('配置错误', '不支持的AI服务商', 'error');
                return;
            }
            
            try {
                showToast('连接测试', '正在测试AI服务连接...', 'info', 0);
                
                // 构建请求头
                const headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${decodeApiKey(config.apiKey)}`
                };
                
                // 添加自定义请求头
                if (aiConfig.headers) {
                    Object.assign(headers, aiConfig.headers);
                }
                
                // 构建请求体
                const temperature = typeof config.temperature === 'number' ? config.temperature : 0.3;
                const maxTokens = Number.isInteger(config.maxTokens) ? config.maxTokens : 4096;
                const requestBody = {
                    model: config.model,
                    messages: [
                        { role: 'user', content: '测试连接' }
                    ],
                    temperature: Math.min(Math.max(temperature, 0), 2),
                    max_tokens: Math.max(1, maxTokens)
                };
                
                // 添加自定义参数
                if (aiConfig.params) {
                    Object.assign(requestBody, aiConfig.params);
                }
                
                const response = await fetch(aiConfig.endpoint, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(requestBody)
                });
                
                if (response.ok) {
                    showToast('连接成功', `${aiConfig.name} 连接正常`, 'success');
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    const errorMsg = errorData.error?.message || errorData.message || `HTTP ${response.status}`;
                    showToast('连接失败', `${aiConfig.name} 连接失败: ${errorMsg}`, 'error');
                }
            } catch (error) {
                showToast('连接失败', `网络错误: ${error.message}`, 'error');
            }
        }
        
        // 增强的错误处理和用户引导
        function showAIHelp() {
            const helpContent = `
                <div style="text-align: left; max-width: 500px;">
                    <h3 style="color: var(--accent-primary); margin-top: 0;">🤖 AI智能修复帮助</h3>
                    
                    <div style="margin-bottom: 20px;">
                        <h4>📋 功能说明</h4>
                        <ul style="margin: 10px 0; padding-left: 20px;">
                            <li><strong>整体修复</strong>：自动修复Markdown格式问题</li>
                            <li><strong>深度优化</strong>：AI重新组织和优化文档结构</li>
                            <li><strong>配置管理</strong>：支持多个AI服务商切换</li>
                        </ul>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <h4>🔑 API密钥获取</h4>
                        <ul style="margin: 10px 0; padding-left: 20px; font-size: 14px;">
                            <li><strong>Kimi</strong>: <a href="https://platform.moonshot.cn" target="_blank">platform.moonshot.cn</a></li>
                            <li><strong>智谱GLM</strong>: <a href="https://bigmodel.cn" target="_blank">bigmodel.cn</a></li>
                            <li><strong>百川AI</strong>: <a href="https://platform.baichuan-ai.com" target="_blank">platform.baichuan-ai.com</a></li>
                            <li><strong>DeepSeek</strong>: <a href="https://platform.deepseek.com" target="_blank">platform.deepseek.com</a></li>
                            <li><strong>OpenAI</strong>: 需要代理服务</li>
                        </ul>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <h4>⌨️ 快捷键</h4>
                        <ul style="margin: 10px 0; padding-left: 20px; font-size: 14px;">
                            <li><strong>Ctrl+Alt+F</strong>: 整体修复</li>
                            <li><strong>Ctrl+Alt+O</strong>: 深度优化</li>
                            <li><strong>Esc</strong>: 关闭配置面板</li>
                        </ul>
                    </div>
                    
                    <div style="background: rgba(255, 193, 7, 0.1); padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107;">
                        <h4 style="margin-top: 0;">💡 使用建议</h4>
                        <ul style="margin: 5px 0; padding-left: 20px; font-size: 14px;">
                            <li>首次使用请先配置AI服务</li>
                            <li>建议先测试连接再使用</li>
                            <li>API密钥仅在本地存储，不会上传</li>
                            <li>高级用户每日10次，超级管理员无限制</li>
                        </ul>
                    </div>
                </div>
            `;
            
            showConfirm('AI智能修复帮助', helpContent, '💡');
        }
        
        // 添加事件监听器
        document.addEventListener('DOMContentLoaded', function() {
            // 密码显示/隐藏切换
            const passwordToggle = document.getElementById('passwordToggle');
            if (passwordToggle) {
                passwordToggle.addEventListener('click', togglePasswordVisibility);
            }
            
            // 支持回车键提交密码
            const passwordInput = document.getElementById('passwordInput');
            if (passwordInput) {
                passwordInput.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        verifyPassword();
                    }
                });
            }

            const previewElement = document.getElementById('preview');
            if (previewElement) {
                previewElement.addEventListener('click', handlePreviewBlockClick);
            }
        });
        
        // 初始化应用（原来的初始化逻辑）
        function initializeApp() {
            // 更新用户状态显示
            updateUserStatus();
            updateAIStatusBar();
            
            // 初始化AI修复功能组显示
            initializeAIFixFeatures();
            
            // 等待DOM完全可见后初始化事件绑定
            setTimeout(() => {
                initializeEventBindings();
            }, 100);

            // 初始化拖拽功能
            initializeDragAndDrop();

            // 优先恢复自动保存的草稿，避免覆盖用户内容
            const restored = restoreAutoSavedDraft();
            if (!restored) {
                loadExample();
            }

            if (!introModalShown && shouldShowIntroModal()) {
                setTimeout(() => {
                    if (!introModalShown) {
                        showIntroModal();
                    }
                }, 400);
            }
        }
        
        // 初始化AI修复功能
        function initializeAIFixFeatures() {
            const aiFixGroup = document.getElementById('aiFixGroup');
            if (!aiFixGroup) return;
            
            // 根据用户权限显示或隐藏AI修复功能组
            if (canUseAIFix()) {
                aiFixGroup.style.display = 'block';
                // 更新使用次数显示
                updateAIUsageDisplay();
                // 根据用户级别设置按钮文本
                updateAIConfigButtonText();
            } else {
                aiFixGroup.style.display = 'none';
            }

            updatePartialAIFixButtonState();
        }
        
        // 根据用户级别更新AI配置按钮文本
        function updateAIConfigButtonText() {
            const aiConfigBtn = document.getElementById('aiConfigBtn');
            if (!aiConfigBtn || !currentUser) return;
            
            if (currentUser.level === 'super_admin') {
                aiConfigBtn.innerHTML = '⚙️ AI配置';
                aiConfigBtn.setAttribute('aria-label', 'AI修复配置');
            } else {
                aiConfigBtn.innerHTML = '⚙️ AI设置';
                aiConfigBtn.setAttribute('aria-label', 'AI修复设置');
            }
        }
        
        // 初始化事件绑定 - 确保在主界面显示后执行
        function initializeEventBindings() {
            try {
                // 获取DOM元素（在主界面显示后重新获取）
                const markdownInput = document.getElementById('markdownInput');
                const preview = document.getElementById('preview');
                
                // 验证元素存在且可见
                if (!markdownInput || !preview) {
                    console.warn('关键DOM元素未找到，延迟重试...');
                    setTimeout(initializeEventBindings, 200);
                    return;
                }
                
                // 检查元素是否真正可见
                const isVisible = markdownInput.offsetParent !== null && 
                                 markdownInput.style.display !== 'none' &&
                                 getComputedStyle(markdownInput).visibility !== 'hidden';
                
                if (!isVisible) {
                    console.warn('DOM元素尚未完全可见，延迟重试...');
                    setTimeout(initializeEventBindings, 200);
                    return;
                }
                
                // 移除可能的重复监听器（防止重复绑定）
                markdownInput.removeEventListener('input', handleInputChange);
                
                // 绑定实时预览事件
                markdownInput.addEventListener('input', handleInputChange);
                
                console.log('✅ 实时预览事件绑定成功');
                
                // 触发一次初始预览更新
                if (markdownInput.value.trim()) {
                    debouncedUpdatePreview();
                }
                
            } catch (error) {
                console.error('事件绑定失败:', error);
                // 失败重试机制
                setTimeout(initializeEventBindings, 500);
            }
        }
        
        // 输入变化处理函数
        function handleInputChange() {
            try {
                debouncedUpdateWordCount(); // 字数统计使用防抖
                debouncedUpdatePreview();   // 预览更新使用动态防抖
                debouncedAutoSave();        // 自动保存草稿
                
                // 调试信息（仅在开发模式下显示）
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                    console.log('📝 实时预览触发');
                }
            } catch (error) {
                console.error('实时预览处理失败:', error);
                // 尝试重新初始化事件绑定
                setTimeout(initializeEventBindings, 1000);
            }
        }
        
        // 检查实时预览状态的调试函数
        function checkPreviewStatus() {
            const markdownInput = document.getElementById('markdownInput');
            const preview = document.getElementById('preview');
            
            const status = {
                markdownInputExists: !!markdownInput,
                previewExists: !!preview,
                markdownInputVisible: markdownInput ? markdownInput.offsetParent !== null : false,
                previewVisible: preview ? preview.offsetParent !== null : false,
                hasEventListeners: markdownInput ? getEventListeners(markdownInput).input?.length > 0 : false,
                currentValue: markdownInput ? markdownInput.value.length : 0
            };
            
            console.table(status);
            return status;
        }
        
        // 全局暴露调试函数（仅在开发环境）
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            window.checkPreviewStatus = checkPreviewStatus;
            window.reinitializePreview = initializeEventBindings;
        }
        
        // 配置marked选项
        marked.setOptions({
            breaks: true,
            gfm: true
        });

        // 全局HTML净化助手，保护预览/导出/复制内容的安全性
        function sanitizeHTML(html, options = {}) {
            try {
                if (window.DOMPurify && typeof DOMPurify.sanitize === 'function') {
                    const baseOptions = { USE_PROFILES: { html: true } };
                    return DOMPurify.sanitize(html, { ...baseOptions, ...options });
                }
            } catch (error) {
                console.warn('DOMPurify 不可用，返回原始HTML', error);
            }
            return html;
        }

        // Markdown 统一解析出口，默认携带净化
        function renderMarkdownToHTML(markdownText) {
            const rawHtml = marked.parse(markdownText);
            return sanitizeHTML(rawHtml);
        }

        // DOM元素引用 - 移动到函数中按需获取，避免过早引用

        // 数学公式缓存系统
        const mathCache = new Map();
        let lastMathHash = '';

        // 计算内容哈希（简单实现）
        function simpleHash(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32bit integer
            }
            return hash.toString();
        }

        // 提取数学公式
        function extractMathFormulas(text) {
            const formulas = [];
            const patterns = [
                /\$\$([^$]+)\$\$/g,     // Display math $$...$$
                /\$([^$\n]+)\$/g,       // Inline math $...$
                /\\\(([^)]+)\\\)/g,     // Inline math \(...\)
                /\\\[([^\]]+)\\\]/g     // Display math \[...\]
            ];
            
            patterns.forEach((pattern, index) => {
                let match;
                while ((match = pattern.exec(text)) !== null) {
                    formulas.push({
                        formula: match[0],
                        content: match[1],
                        display: index % 2 === 0,
                        hash: simpleHash(match[0])
                    });
                }
            });
            
            return formulas;
        }

        // 优化的数学公式渲染函数
        function renderMath(element) {
            if (!window.renderMathInElement) {
                return;
            }
            
            const mathIndicator = document.getElementById('mathIndicator');
            const markdownText = document.getElementById('markdownInput').value;
            
            // 快速检查是否包含数学公式
            const hasMath = /\$.*?\$|\\\(.*?\\\)|\\\[.*?\\\]|\$\$.*?\$\$/s.test(markdownText);
            if (!hasMath) {
                if (mathIndicator) {
                    mathIndicator.classList.remove('show');
                }
                return;
            }

            // 计算当前内容的数学公式哈希
            const mathFormulas = extractMathFormulas(markdownText);
            const currentMathHash = simpleHash(mathFormulas.map(f => f.formula).join(''));
            
            // 如果数学公式没有变化，跳过渲染
            if (currentMathHash === lastMathHash) {
                return;
            }
            
            lastMathHash = currentMathHash;
            
            // 显示渲染指示器
            if (mathIndicator) {
                mathIndicator.classList.add('show');
            }
            
            // 使用RequestAnimationFrame优化渲染时机
            requestAnimationFrame(() => {
                try {
                    // 创建DocumentFragment进行批量DOM操作
                    const fragment = document.createDocumentFragment();
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = element.innerHTML;
                    fragment.appendChild(tempDiv);
                    
                    renderMathInElement(tempDiv, {
                        delimiters: [
                            {left: '$$', right: '$$', display: true},
                            {left: '$', right: '$', display: false},
                            {left: '\\(', right: '\\)', display: false},
                            {left: '\\[', right: '\\]', display: true}
                        ],
                        throwOnError: false,
                        errorCallback: function(msg, err) {
                            console.warn('数学公式渲染警告:', msg, err);
                        }
                    });
                    
                    // 批量更新DOM
                    element.innerHTML = tempDiv.innerHTML;
                    
                    // 渲染完成后隐藏指示器
                    setTimeout(() => {
                        if (mathIndicator) {
                            mathIndicator.classList.remove('show');
                        }
                    }, 200);
                    
                } catch (error) {
                    console.error('数学公式渲染失败:', error);
                    if (mathIndicator) {
                        mathIndicator.classList.remove('show');
                    }
                    showToast('公式渲染失败', '部分数学公式可能无法正确显示', 'warning', 2000);
                }
            });
        }

        // 节流的数学公式渲染（1000ms限制）
        const throttledRenderMath = throttle(renderMath, 1000);

        // Toast通知系统
        function showToast(title, message, type = 'success', duration = 3000) {
            const container = document.getElementById('toastContainer');
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            
            const icons = {
                success: '✅',
                error: '❌',
                warning: '⚠️',
                info: 'ℹ️'
            };
            
            toast.innerHTML = `
                <div class="toast-icon">${icons[type] || icons.info}</div>
                <div class="toast-content">
                    <div class="toast-title">${title}</div>
                    ${message ? `<div class="toast-message">${message}</div>` : ''}
                </div>
            `;
            
            container.appendChild(toast);
            
            // 显示动画
            setTimeout(() => toast.classList.add('show'), 10);
            
            // 自动移除
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => {
                    if (container.contains(toast)) {
                        container.removeChild(toast);
                    }
                }, 300);
            }, duration);
        }

        // 自定义确认对话框
        function showConfirm(title, message, icon = '❓') {
            return new Promise((resolve) => {
                const dialog = document.getElementById('customDialog');
                const dialogIcon = document.getElementById('dialogIcon');
                const dialogTitle = document.getElementById('dialogTitle');
                const dialogMessage = document.getElementById('dialogMessage');
                const confirmBtn = document.getElementById('dialogConfirm');
                const cancelBtn = document.getElementById('dialogCancel');
                
                dialogIcon.textContent = icon;
                dialogTitle.textContent = title;
                dialogMessage.innerHTML = message;
                
                dialog.classList.add('show');
                
                const handleConfirm = () => {
                    cleanup();
                    resolve(true);
                };
                
                const handleCancel = () => {
                    cleanup();
                    resolve(false);
                };
                
                const cleanup = () => {
                    dialog.classList.remove('show');
                    confirmBtn.removeEventListener('click', handleConfirm);
                    cancelBtn.removeEventListener('click', handleCancel);
                };
                
                confirmBtn.addEventListener('click', handleConfirm);
                cancelBtn.addEventListener('click', handleCancel);
                
                // ESC键取消
                const handleEsc = (e) => {
                    if (e.key === 'Escape') {
                        handleCancel();
                        document.removeEventListener('keydown', handleEsc);
                    }
                };
                document.addEventListener('keydown', handleEsc);
            });
        }

        // 显示状态消息（保留向后兼容）
        function showStatus(message, type = 'success') {
            showToast('提示', message, type);
        }

        // 更新字数统计
        function updateWordCount() {
            const text = markdownInput.value;
            const charCount = text.length;
            const wordCount_val = text.trim() ? text.trim().split(/\s+/).length : 0;
            const lineCount = text.split('\n').length;
            
            // 估算阅读时间（假设每分钟200个单词）
            const readTime = Math.ceil(wordCount_val / 200);
            
            // 更新各个统计项
            document.getElementById('charCount').textContent = charCount.toLocaleString();
            document.getElementById('wordCount').textContent = wordCount_val.toLocaleString();
            document.getElementById('lineCount').textContent = lineCount.toLocaleString();
            document.getElementById('readTime').textContent = readTime || '<1';
        }

        // 自动保存草稿
        function autoSaveDraft() {
            if (!markdownInput || isLoadingExample) return;
            const content = markdownInput.value;
            if (!content.trim()) {
                localStorage.removeItem(AUTO_SAVE_KEY);
                localStorage.removeItem(AUTO_SAVE_TIMESTAMP_KEY);
                return;
            }
            localStorage.setItem(AUTO_SAVE_KEY, content);
            localStorage.setItem(AUTO_SAVE_TIMESTAMP_KEY, new Date().toLocaleString());
        }

        // 恢复自动保存草稿
        function restoreAutoSavedDraft() {
            if (!markdownInput) return false;
            const saved = localStorage.getItem(AUTO_SAVE_KEY);
            if (!saved) return false;

            // 避免覆盖已有输入
            if (markdownInput.value.trim()) return false;

            const timestamp = localStorage.getItem(AUTO_SAVE_TIMESTAMP_KEY) || '未知时间';
            markdownInput.value = saved;
            updateWordCount();
            updatePreview();
            showToast('已恢复草稿', `自动保存于 ${timestamp}`);
            return true;
        }

        // 增强防抖函数 - 支持动态延迟
        function debounce(func, wait, dynamicWaitFunc = null) {
            let timeout;
            return function executedFunction(...args) {
                const actualWait = dynamicWaitFunc ? dynamicWaitFunc() : wait;
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, actualWait);
            };
        }

        // 节流函数 - 限制函数执行频率
        function throttle(func, limit) {
            let inThrottle;
            return function executedFunction(...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        }

        // 长文档性能优化配置
        const PERFORMANCE_CONFIG = {
            CHUNK_SIZE: 2000,           // 每个分片的字符数
            LARGE_DOC_THRESHOLD: 5000,  // 长文档阈值
            HUGE_DOC_THRESHOLD: 15000,  // 超长文档阈值
            MAX_PARSE_TIME: 100         // 最大解析时间(ms)
        };

        // 内容差异检测
        let lastContentHash = '';
        
        function getContentHash(content) {
            return simpleHash(content);
        }

        // 分片解析函数
        function parseMarkdownInChunks(markdownText, onProgress = null) {
            return new Promise((resolve) => {
                const chunks = [];
                const chunkSize = PERFORMANCE_CONFIG.CHUNK_SIZE;
                
                // 按行分割，保持内容完整性
                const lines = markdownText.split('\n');
                let currentChunk = '';
                let currentSize = 0;
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i] + '\n';
                    
                    if (currentSize + line.length > chunkSize && currentChunk.trim()) {
                        chunks.push(currentChunk);
                        currentChunk = line;
                        currentSize = line.length;
                    } else {
                        currentChunk += line;
                        currentSize += line.length;
                    }
                }
                
                if (currentChunk.trim()) {
                    chunks.push(currentChunk);
                }
                
                // 逐步解析分片
                let processedChunks = [];
                let currentIndex = 0;
                
                function processNextChunk() {
                    if (currentIndex >= chunks.length) {
                        resolve(processedChunks.join(''));
                        return;
                    }
                    
                    const chunk = chunks[currentIndex];
                    const startTime = performance.now();
                    
                    try {
                        const html = renderMarkdownToHTML(chunk);
                        processedChunks.push(html);
                        
                        if (onProgress) {
                            onProgress({
                                current: currentIndex + 1,
                                total: chunks.length,
                                percentage: Math.round(((currentIndex + 1) / chunks.length) * 100)
                            });
                        }
                        
                        currentIndex++;
                        
                        // 检查解析时间，如果太长则延迟下一个分片
                        const parseTime = performance.now() - startTime;
                        if (parseTime > PERFORMANCE_CONFIG.MAX_PARSE_TIME) {
                            setTimeout(processNextChunk, 10);
                        } else {
                            processNextChunk();
                        }
                        
                    } catch (error) {
                        processedChunks.push(`<div class="parse-error">分片解析错误: ${error.message}</div>`);
                        currentIndex++;
                        setTimeout(processNextChunk, 5);
                    }
                }
                
                processNextChunk();
            });
        }

        // 显示解析进度
        function showParseProgress(show = true) {
            const indicator = document.getElementById('parseIndicator');
            if (indicator) {
                if (show) {
                    indicator.classList.add('show');
                } else {
                    indicator.classList.remove('show');
                }
            }
        }

        // 更新解析进度
        function updateParseProgress(progress) {
            const progressBar = document.querySelector('#parseIndicator .progress-bar-fill');
            const progressText = document.querySelector('#parseIndicator .progress-text');
            
            if (progressBar) {
                progressBar.style.width = `${progress.percentage}%`;
            }
            
            if (progressText) {
                progressText.textContent = `解析中... ${progress.current}/${progress.total} (${progress.percentage}%)`;
            }
        }

        function clearPreviewSelection() {
            selectedPreviewBlockIds.clear();
            selectedPreviewRange = null;
            syncPreviewSelectionStyles();
            updatePartialAIFixButtonState();
        }

        function syncPreviewSelectionStyles() {
            if (!preview) return;
            const elements = preview.querySelectorAll('.preview-block');
            elements.forEach((element) => {
                const blockId = element.dataset.blockId;
                if (blockId && selectedPreviewBlockIds.has(blockId)) {
                    element.classList.add('is-selected');
                } else {
                    element.classList.remove('is-selected');
                }
            });
        }

        function ensureMarkdownSelectionVisible(start, end) {
            if (!markdownInput) return;
            const textarea = markdownInput;
            const style = getComputedStyle(textarea);
            const lineHeight = parseFloat(style.lineHeight) || 20;
            const padding = lineHeight * 1.5;

            const before = textarea.value.slice(0, start);
            const selectionLines = textarea.value.slice(start, end).split('\n').length;

            const selectionTop = before.split('\n').length * lineHeight;
            const selectionBottom = selectionTop + (selectionLines * lineHeight);

            if (selectionTop < textarea.scrollTop) {
                textarea.scrollTop = Math.max(selectionTop - padding, 0);
            } else if (selectionBottom > textarea.scrollTop + textarea.clientHeight) {
                textarea.scrollTop = selectionBottom - textarea.clientHeight + padding;
            }
        }

        function highlightMarkdownRange(start, end) {
            if (!markdownInput) return;
            const previousActiveElement = document.activeElement;
            const safeStart = Math.max(0, Math.min(start, markdownInput.value.length));
            const safeEnd = Math.max(safeStart, Math.min(end, markdownInput.value.length));

            markdownInput.focus({ preventScroll: true });
            markdownInput.setSelectionRange(safeStart, safeEnd);
            ensureMarkdownSelectionVisible(safeStart, safeEnd);

            if (previousActiveElement && previousActiveElement !== markdownInput && typeof previousActiveElement.focus === 'function') {
                previousActiveElement.focus({ preventScroll: true });
            }
        }

        function syncMarkdownSelection() {
            if (!selectedPreviewBlockIds.size) {
                selectedPreviewRange = null;
                updatePartialAIFixButtonState();
                return;
            }

            const blocks = Array.from(selectedPreviewBlockIds)
                .map(id => previewBlocks.find(block => block.id === id))
                .filter(Boolean)
                .sort((a, b) => a.start - b.start);

            if (!blocks.length) {
                clearPreviewSelection();
                return;
            }

            const start = blocks[0].start;
            const end = blocks[blocks.length - 1].end;

            selectedPreviewRange = { start, end };
            highlightMarkdownRange(start, end);
            updatePartialAIFixButtonState();
        }

        function handlePreviewBlockClick(event) {
            if (!previewSupportsPartialSelection) {
                return;
            }

            const blockElement = event.target.closest('.preview-block');
            if (!blockElement) {
                if (!(event.ctrlKey || event.metaKey)) {
                    clearPreviewSelection();
                }
                return;
            }

            const blockId = blockElement.dataset.blockId;
            if (!blockId) return;

            const allowMulti = event.ctrlKey || event.metaKey;
            if (!allowMulti) {
                selectedPreviewBlockIds.clear();
            }

            if (selectedPreviewBlockIds.has(blockId) && allowMulti) {
                selectedPreviewBlockIds.delete(blockId);
            } else {
                selectedPreviewBlockIds.add(blockId);
            }

            syncPreviewSelectionStyles();
            syncMarkdownSelection();
        }

        function applyPreviewBlockMetadata(markdownText) {
            if (!preview) return;

            const tokens = marked.lexer(markdownText);
            const meta = [];
            let offset = 0;

            tokens.forEach((token) => {
                if (!token || typeof token.raw !== 'string') {
                    return;
                }

                const raw = token.raw;
                if (!raw.trim()) {
                    offset += raw.length;
                    return;
                }

                let start = markdownText.indexOf(raw, offset);
                if (start === -1) {
                    start = offset;
                }
                const end = start + raw.length;
                offset = end;
                meta.push({ start, end });
            });

            const elements = Array.from(preview.children).filter(node => node.nodeType === 1);

            if (!elements.length || !meta.length) {
                elements.forEach(el => {
                    el.classList.remove('preview-block', 'is-selected');
                    delete el.dataset.blockId;
                    delete el.dataset.mdStart;
                    delete el.dataset.mdEnd;
                });
                previewBlocks = [];
                previewSupportsPartialSelection = false;
                clearPreviewSelection();
                return;
            }

            const finalMeta = [];
            let metaIndex = 0;

            elements.forEach((element) => {
                let data = meta[metaIndex];
                while (data && data.end <= data.start && metaIndex < meta.length - 1) {
                    metaIndex++;
                    data = meta[metaIndex];
                }

                if (!data) {
                    return;
                }

                const blockId = `pb-${finalMeta.length}`;
                element.classList.add('preview-block');
                element.dataset.blockId = blockId;
                element.dataset.mdStart = data.start;
                element.dataset.mdEnd = data.end;
                element.classList.remove('is-selected');

                finalMeta.push({ id: blockId, start: data.start, end: data.end });
                metaIndex++;
            });

            if (!finalMeta.length || finalMeta.length !== elements.length) {
                elements.forEach(el => {
                    el.classList.remove('preview-block', 'is-selected');
                    delete el.dataset.blockId;
                    delete el.dataset.mdStart;
                    delete el.dataset.mdEnd;
                });
                previewBlocks = [];
                previewSupportsPartialSelection = false;
                clearPreviewSelection();
                return;
            }

            previewBlocks = finalMeta;
            previewSupportsPartialSelection = true;
            clearPreviewSelection();
        }

        function updatePartialAIFixButtonState() {
            const partialBtn = document.getElementById('partialAIFixBtn');
            if (!partialBtn) return;
            if (!canUseAIFix()) {
                partialBtn.disabled = true;
                return;
            }

            const enabled = previewSupportsPartialSelection && selectedPreviewRange && selectedPreviewRange.end > selectedPreviewRange.start;
            partialBtn.disabled = !enabled;
        }

        // 优化的预览更新函数
        function updatePreview() {
            if (!markdownInput || !preview) return;
            const markdownText = markdownInput.value;
            
            if (markdownText.trim() === '') {
                preview.innerHTML = `
                    <div class="preview-empty">
                        <div class="preview-empty-icon">📝</div>
                        <div class="preview-empty-title">开始创作您的文档</div>
                        <div class="preview-empty-subtitle">
                            在左侧输入框中输入Markdown内容<br>
                            或者使用下方的快速操作
                        </div>
                        <div class="preview-quick-actions" role="group" aria-label="快速操作">
                            <button class="quick-action-btn" onclick="loadExample('simple')" aria-label="加载简单示例">📄 简单示例</button>
                            <button class="quick-action-btn" onclick="loadExample('advanced')" aria-label="加载高级示例">🚀 高级示例</button>
                            <button class="quick-action-btn" onclick="uploadFile()" aria-label="上传Markdown文件">📁 上传文件</button>
                            <button class="quick-action-btn" onclick="loadFromLocal()" aria-label="加载本地草稿">📂 加载草稿</button>
                        </div>
                    </div>
                `;
                lastContentHash = '';
                previewBlocks = [];
                previewSupportsPartialSelection = false;
                clearPreviewSelection();
                return;
            }

            // 内容差异检测
            const currentHash = getContentHash(markdownText);
            if (currentHash === lastContentHash) {
                return; // 内容没有变化，跳过更新
            }
            lastContentHash = currentHash;
            
            
            const textLength = markdownText.length;
            
            try {
                // 长文档使用分片解析
                if (textLength > PERFORMANCE_CONFIG.LARGE_DOC_THRESHOLD) {
                    
                    // 超长文档警告
                    if (textLength > PERFORMANCE_CONFIG.HUGE_DOC_THRESHOLD) {
                        showToast('性能提示', '文档较长，解析可能需要一些时间', 'info', 3000);
                    }
                    
                    showParseProgress(true);
                    
                    parseMarkdownInChunks(markdownText, updateParseProgress)
                        .then(html => {
                            preview.innerHTML = html;
                            throttledRenderMath(preview);
                            applyPreviewBlockMetadata(markdownText);
                            showParseProgress(false);
                        })
                        .catch(error => {
                            console.error('分片解析失败:', error);
                            showParseProgress(false);
                            // 降级到标准解析
                            const html = renderMarkdownToHTML(markdownText);
                            preview.innerHTML = html;
                            throttledRenderMath(preview);
                            applyPreviewBlockMetadata(markdownText);
                        });
                    
                } else {
                    // 短文档直接解析
                    const html = renderMarkdownToHTML(markdownText);
                    preview.innerHTML = html;
                    throttledRenderMath(preview);
                    applyPreviewBlockMetadata(markdownText);
                }

            } catch (error) {
                preview.innerHTML = `
                    <div style="color: var(--warning); padding: 20px; text-align: center;">
                        <div style="font-size: 24px; margin-bottom: 10px;">⚠️</div>
                        <div><strong>解析错误</strong></div>
                        <div style="font-size: 14px; margin-top: 8px; opacity: 0.8;">${error.message}</div>
                    </div>
                `;
                showParseProgress(false);
            }
        }

        // 动态计算防抖延迟 - 根据文档长度调整
        function calculateDebounceDelay() {
            const textLength = markdownInput.value.length;
            if (textLength < 1000) return 300;        // 短文档: 300ms
            if (textLength < 5000) return 500;        // 中等文档: 500ms
            if (textLength < 10000) return 800;       // 长文档: 800ms
            return 1200;                              // 超长文档: 1200ms
        }

        // 防抖的预览更新（动态延迟）
        const debouncedUpdatePreview = debounce(updatePreview, 300, calculateDebounceDelay);

        // 防抖的字数统计更新（100ms延迟）
        const debouncedUpdateWordCount = debounce(updateWordCount, 100);

        // 防抖的自动保存（适度延迟降低写入频率）
        const debouncedAutoSave = debounce(autoSaveDraft, 800);

        // 实时预览功能初始化 - 移动到initializeApp中进行绑定

        // 示例内容库
        const examples = {
            simple: {
                title: '简单示例',
                content: `# 我的第一个文档

欢迎使用 **Markdown转Word** 转换器！

## 基础格式

### 文本样式
- **粗体文本**
- *斜体文本*  
- ~~删除线~~
- \`行内代码\`

### 列表
1. 有序列表项一
2. 有序列表项二
   - 嵌套无序列表
   - 另一个项目

### 引用
> 这是一个简单的引用块。
> 非常适合强调重要内容。

---
*文档创建于 ${new Date().toLocaleDateString()}*`
            },
            
            advanced: {
                title: '高级示例',
                content: `# 📝 高级文档示例

## 🚀 功能特色

这个转换器支持丰富的Markdown语法：

### 代码块
\`\`\`javascript
// 函数定义
function convertMarkdown() {
    console.log("正在转换Markdown...");
    return "转换完成！";
}

// 调用函数
convertMarkdown();
\`\`\`

### 任务列表
- [x] 支持基础Markdown语法
- [x] 支持数学公式渲染
- [ ] 添加更多导出格式
- [ ] 支持图片插入

### 链接和图片
访问 [Markdown官方文档](https://daringfireball.net/projects/markdown/) 了解更多语法。

### 水平分割线
---

### 表格增强
| 功能 | 状态 | 优先级 | 备注 |
|------|------|--------|------|
| 基础转换 | ✅ 完成 | 高 | 核心功能 |
| 样式优化 | 🔄 进行中 | 中 | 持续改进 |
| 插件支持 | 📅 计划中 | 低 | 未来版本 |

> 💡 **提示**: 这个转换器会保持原有的格式和样式！`
            },
            
            math: {
                title: '数学公式示例',
                content: `# 📐 数学公式示例

## 行内公式
质量-能量等价性：$E = mc^2$

圆的面积公式：$A = \\\\pi r^2$

## 块级公式

### 积分
$$\\\\int_{-\\\\infty}^{\\\\infty} e^{-x^2} dx = \\\\sqrt{\\\\pi}$$

### 矩阵
$$\\\\begin{pmatrix} a & b \\\\\\\\ c & d \\\\end{pmatrix}$$

### 求和
$$\\\\sum_{i=1}^{n} i = \\\\frac{n(n+1)}{2}$$

### 二次方程解
$$x = \\\\frac{-b \\\\pm \\\\sqrt{b^2 - 4ac}}{2a}$$

### 极限
$$\\\\lim_{x \\\\to \\\\infty} \\\\frac{1}{x} = 0$$

> 注意：数学公式使用KaTeX渲染，支持大部分LaTeX语法。`
            },
            
            table: {
                title: '表格示例',
                content: `# 📊 表格功能展示

## 基础表格
| 产品 | 价格 | 数量 |
|------|------|------|
| 苹果 | ¥5 | 10个 |
| 香蕉 | ¥3 | 20个 |
| 橙子 | ¥4 | 15个 |

## 对齐表格
| 左对齐 | 居中对齐 | 右对齐 |
|:-------|:-------:|-------:|
| 文本 | 数字 | 价格 |
| Apple | 100 | $50.00 |
| Banana | 200 | $30.00 |

## 复杂表格
| 功能模块 | 开发状态 | 完成度 | 负责人 | 预计时间 |
|----------|----------|--------|--------|----------|
| 用户认证 | ✅ 已完成 | 100% | 张三 | 2024-01 |
| 文件上传 | 🔄 开发中 | 80% | 李四 | 2024-02 |
| 数据分析 | 📋 待开始 | 0% | 王五 | 2024-03 |
| 系统优化 | 🔄 测试中 | 90% | 赵六 | 2024-01 |

## 数据统计表
| 月份 | 用户数 | 增长率 | 收入 |
|------|--------|--------|------|
| 1月 | 1,000 | - | ¥10,000 |
| 2月 | 1,200 | +20% | ¥12,000 |
| 3月 | 1,500 | +25% | ¥15,000 |
| **总计** | **3,700** | **+50%** | **¥37,000** |`
            }
        };

        // 加载示例内容
        function loadExample(type = 'simple') {
            const example = examples[type];
            if (!example) {
                showToast('错误', '示例类型不存在', 'error');
                return;
            }
            
            // 设置示例加载标志，避免计入配额
            isLoadingExample = true;
            
            markdownInput.value = example.content;
            updateWordCount();
            updatePreview();
            showToast('加载完成', `${example.title}已加载`);
            
            // 确保数学公式渲染
            if (type === 'math') {
                setTimeout(() => renderMath(preview), 200);
            }
            
            // 示例加载完成后重置标志
            setTimeout(() => {
                isLoadingExample = false;
            }, 100);
        }

        // 清空内容
        async function clearContent() {
            if (markdownInput.value.trim()) {
                const confirmed = await showConfirm(
                    '清空内容',
                    '确认清空所有内容？此操作无法撤销。',
                    '🗑️'
                );
                if (!confirmed) return;
            }
            
            // 设置示例加载标志，避免清空操作计入配额
            isLoadingExample = true;
            
            markdownInput.value = '';
            updatePreview();
            updateWordCount();
            localStorage.removeItem(AUTO_SAVE_KEY);
            localStorage.removeItem(AUTO_SAVE_TIMESTAMP_KEY);
            showToast('操作完成', '内容已清空');
            
            // 清空完成后重置标志
            setTimeout(() => {
                isLoadingExample = false;
            }, 100);
        }

        // 复制富文本内容
        function copyFormattedText() {
            const markdownText = markdownInput.value.trim();
            
            if (!markdownText) {
                showToast('提示', '请先输入Markdown内容！', 'warning');
                return;
            }
            
            // 权限检查：文档大小限制（复制功能相对宽松）
            const sizeCheck = checkDocumentSize(markdownText);
            if (!sizeCheck.allowed) {
                showUpgradePrompt(
                    '文档大小超限',
                    `${sizeCheck.message}\n升级账户以处理更大的文档！`,
                    'size'
                );
                return;
            }
            
            // 权限检查：数学公式权限
            const hasMath = /\$.*?\$|\\\(.*?\\\)|\\\[.*?\\\]|\$\$.*?\$\$/.test(markdownText);
            if (hasMath && !hasFeature('mathFormulas')) {
                showToast('权限不足', `${currentUser.name} 不支持数学公式功能，将跳过公式渲染`, 'warning');
            }

            try {
                // 解析markdown为HTML
                const html = renderMarkdownToHTML(markdownText);
                
                // 创建一个临时div来处理HTML
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;
                
                // 选择预览区域的内容
                const range = document.createRange();
                range.selectNodeContents(preview);
                
                // 清除之前的选择
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                
                // 尝试复制
                try {
                    // 现代浏览器使用 Clipboard API
                    if (navigator.clipboard && navigator.clipboard.write) {
                        // 创建 ClipboardItem，同时包含HTML和纯文本
                        const clipboardItems = new ClipboardItem({
                            'text/html': new Blob([html], { type: 'text/html' }),
                            'text/plain': new Blob([preview.textContent], { type: 'text/plain' })
                        });
                        
                        navigator.clipboard.write([clipboardItems]).then(() => {
                            showToast('复制成功', '富文本已复制到剪贴板');
                        }).catch(() => {
                            // 如果Clipboard API失败，回退到传统方法
                            fallbackCopy();
                        });
                    } else {
                        // 回退到传统复制方法
                        fallbackCopy();
                    }
                } catch (error) {
                    fallbackCopy();
                }
                
                function fallbackCopy() {
                    // 传统的复制方法
                    const successful = document.execCommand('copy');
                    if (successful) {
                        showToast('复制成功', '内容已复制到剪贴板');
                    } else {
                        showToast('复制失败', '请手动选择内容后复制', 'error');
                    }
                }
                
                // 清除选择
                selection.removeAllRanges();
                
            } catch (error) {
                console.error('复制失败:', error);
                showToast('复制失败', '请检查您的Markdown格式是否正确', 'error');
            }
        }

        // === 表格格式转换器 ===
        function openTableConverter() {
            const modal = document.getElementById('tableConverterModal');
            if (!modal) return;
            modal.style.display = 'block';
            setTimeout(() => modal.classList.add('show'), 10);
            switchTableConverterTab('html');
            ensureTableConverterBindings();
            refreshTablePreviewSkins();

            if (tableConverterKeyHandler) {
                window.removeEventListener('keydown', tableConverterKeyHandler);
            }
            tableConverterKeyHandler = (event) => {
                if (event.key === 'Escape') {
                    closeTableConverterModal();
                }
            };
            window.addEventListener('keydown', tableConverterKeyHandler);
            if (!modal.dataset.boundClose) {
                modal.addEventListener('click', (event) => {
                    if (event.target === modal) {
                        closeTableConverterModal();
                    }
                });
                modal.dataset.boundClose = 'true';
            }

            if (!tableExamplesInitialized) {
                prefillTableConverterExamples();
                tableExamplesInitialized = true;
            }
        }

        function closeTableConverterModal() {
            const modal = document.getElementById('tableConverterModal');
            if (!modal) return;
            modal.classList.remove('show');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 150);
            if (tableConverterKeyHandler) {
                window.removeEventListener('keydown', tableConverterKeyHandler);
                tableConverterKeyHandler = null;
            }
        }

        function switchTableConverterTab(tab) {
            document.querySelectorAll('.table-tab').forEach(btn => {
                const active = btn.dataset.tab === tab;
                btn.classList.toggle('active', active);
                btn.setAttribute('aria-selected', active ? 'true' : 'false');
            });

            document.querySelectorAll('.table-tab-panel').forEach(panel => {
                panel.classList.toggle('active', panel.dataset.tab === tab);
            });
        }

        function ensureTableConverterBindings() {
            if (tableEnhancementsBound) return;
            const pairs = [
                ['tableHtmlInput', 'tableHtmlInputCount'],
                ['tableTextInput', 'tableTextInputCount'],
                ['tableMarkdownInput', 'tableMarkdownInputCount']
            ];
            pairs.forEach(([inputId, countId]) => {
                const input = document.getElementById(inputId);
                if (!input) return;
                input.addEventListener('input', () => updateTableCharCount(inputId, countId));
                updateTableCharCount(inputId, countId);
            });
            tableEnhancementsBound = true;
        }

        function updateTableCharCount(inputId, counterId) {
            const input = document.getElementById(inputId);
            const counter = document.getElementById(counterId);
            if (!input || !counter) return;
            counter.textContent = `${input.value.length} 字符`;
        }

        function setTableWidthMode(mode) {
            tableFitMode = mode === 'auto' ? 'auto' : 'full';
            const fullBtn = document.getElementById('tableWidthFullBtn');
            const autoBtn = document.getElementById('tableWidthAutoBtn');
            if (fullBtn && autoBtn) {
                fullBtn.classList.toggle('active', tableFitMode === 'full');
                autoBtn.classList.toggle('active', tableFitMode === 'auto');
            }
            refreshTablePreviewSkins();
        }

        function toggleTableStriped() {
            tableStriped = !tableStriped;
            const toggle = document.getElementById('tableStripeToggle');
            if (toggle) {
                toggle.classList.toggle('active', tableStriped);
            }
            refreshTablePreviewSkins();
        }

        function quickSwitchAI(provider) {
            if (PRESET_AI_CONFIGS[provider]) {
                selectAIProvider(provider);
                updateAIStatusBar();
            } else {
                showToast('提示', '仅支持 Kimi 与 GLM 快速切换', 'warning');
            }
        }

        function tableCopyPlain(targetId) {
            const target = document.getElementById(targetId);
            if (!target || !target.textContent.trim()) {
                showToast('提示', '没有可复制的内容', 'warning');
                return;
            }
            const text = target.textContent.trim();
            const doCopy = async () => {
                try {
                    await navigator.clipboard.writeText(text);
                    showToast('复制成功', '纯文本已复制', 'success');
                } catch (error) {
                    const textarea = document.createElement('textarea');
                    textarea.value = text;
                    document.body.appendChild(textarea);
                    textarea.select();
                    const ok = document.execCommand('copy');
                    document.body.removeChild(textarea);
                    showToast(ok ? '复制成功' : '复制失败', ok ? '纯文本已复制' : '请手动复制', ok ? 'success' : 'error');
                }
            };
            doCopy();
        }

        function refreshTablePreviewSkins() {
            document.querySelectorAll('.table-preview-card').forEach(card => {
                card.classList.toggle('striped-table', tableStriped);
                card.classList.toggle('fit-auto', tableFitMode === 'auto');
                const tableEl = card.querySelector('table');
                if (tableEl) {
                    tableEl.style.width = tableFitMode === 'full' ? '100%' : 'auto';
                    tableEl.style.tableLayout = tableFitMode === 'full' ? 'fixed' : 'auto';
                }
            });
        }

        function tableDetectSeparator(firstRow) {
            const separators = ['\t', ',', '|', ';', ' '];
            let best = '\t';
            let max = 0;
            separators.forEach(sep => {
                const count = firstRow.split(sep).length - 1;
                if (count > max) {
                    max = count;
                    best = sep;
                }
            });
            return best;
        }

        function tableProcessBold(text) {
            return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        }

        function tableProcessBr(text) {
            return text.replace(/<br\s*\/?>/gi, '<br>');
        }

        // 去除加粗并保留换行的通用清洗
        function tableNormalizeCell(value) {
            let v = value || '';
            // 去掉 Markdown 粗体标记
            v = v.replace(/\*\*(.*?)\*\*/g, '$1');
            // 统一换行标记
            v = v.replace(/<br\s*\/?>/gi, '\n');

            // 通过 DOM 解析去掉粗体标签等格式
            const temp = document.createElement('div');
            temp.innerHTML = v;
            temp.querySelectorAll('strong, b').forEach(el => {
                el.replaceWith(el.textContent);
            });
            const text = temp.textContent || '';

            // 恢复换行并裁剪行内空白
            const parts = text.split('\n').map(part => part.trim()).filter(Boolean);
            return parts.join('<br>');
        }

        function renderTablePreview(targetId, tableData, hasHeader = true) {
            const target = document.getElementById(targetId);
            if (!target) return;
            if (!tableData || tableData.length === 0) {
                target.innerHTML = '';
                return;
            }

            let html = '<table><tbody>';
            tableData.forEach((row, rowIndex) => {
                html += '<tr>';
                row.forEach(cell => {
                    const tag = hasHeader && rowIndex === 0 ? 'th' : 'td';
                    const safeCell = sanitizeHTML(cell, { ALLOWED_TAGS: ['br'], ALLOWED_ATTR: [] });
                    html += `<${tag}>${safeCell}</${tag}>`;
                });
                html += '</tr>';
            });
            html += '</tbody></table>';

            target.innerHTML = html;
            const tableEl = target.querySelector('table');
            if (tableEl) {
                tableEl.style.width = tableFitMode === 'full' ? '100%' : 'auto';
                tableEl.style.tableLayout = tableFitMode === 'full' ? 'fixed' : 'auto';
            }
            target.classList.toggle('striped-table', tableStriped);
            target.classList.toggle('fit-auto', tableFitMode === 'auto');
        }

        function tableConvertHtml() {
            const input = document.getElementById('tableHtmlInput');
            if (!input) return;
            const htmlInput = input.value.trim();
            if (!htmlInput) {
                showToast('提示', '请先粘贴HTML表格', 'warning');
                return;
            }

            const temp = document.createElement('div');
            const safeInput = sanitizeHTML(htmlInput);
            temp.innerHTML = safeInput;
            const table = temp.querySelector('table');
            if (!table || !table.rows.length) {
                showToast('提示', '未检测到有效的HTML表格', 'warning');
                return;
            }

            const tableData = Array.from(table.rows).map(row => {
                return Array.from(row.cells).map(cell => tableNormalizeCell(cell.innerHTML.trim()));
            });

            renderTablePreview('tableHtmlPreview', tableData);
            showToast('转换完成', 'HTML表格已转换', 'success');
        }

        function tableConvertText() {
            const input = document.getElementById('tableTextInput');
            if (!input) return;
            const raw = input.value.trim();
            if (!raw) {
                showToast('提示', '请先粘贴纯文本表格', 'warning');
                return;
            }

            const rows = raw.split('\n').filter(r => r.trim());
            if (rows.length === 0) {
                showToast('提示', '未检测到有效的表格行', 'warning');
                return;
            }

            const separator = tableDetectSeparator(rows[0]);
            const tableData = rows.map(row => {
                const cells = separator === ' ' ? row.trim().split(/\s+/) : row.split(separator);
                return cells.map(cell => tableNormalizeCell(cell.trim()));
            });

            renderTablePreview('tableTextPreview', tableData);
            showToast('转换完成', '纯文本表格已转换', 'success');
        }

        function tableParseMarkdownRow(row) {
            let cleanRow = row.trim();
            if (cleanRow.startsWith('|')) cleanRow = cleanRow.slice(1);
            if (cleanRow.endsWith('|')) cleanRow = cleanRow.slice(0, -1);
            return cleanRow.split('|').map(cell => tableNormalizeCell(cell.trim()));
        }

        function tableConvertMarkdown() {
            const input = document.getElementById('tableMarkdownInput');
            if (!input) return;
            const raw = input.value.trim();
            if (!raw) {
                showToast('提示', '请先粘贴Markdown表格', 'warning');
                return;
            }

            const rows = raw.split('\n').filter(r => r.trim());
            if (rows.length < 2) {
                showToast('提示', 'Markdown表格至少需要标题行和数据行', 'warning');
                return;
            }

            const headerRow = rows[0];
            const dataRows = rows.slice(2); // 跳过分隔行
            if (dataRows.length === 0) {
                showToast('提示', '未检测到数据行，请补充内容后再试', 'warning');
                return;
            }

            const headers = tableParseMarkdownRow(headerRow);
            const tableData = [headers];
            dataRows.forEach(row => {
                tableData.push(tableParseMarkdownRow(row));
            });

            renderTablePreview('tableMarkdownPreview', tableData);
            showToast('转换完成', 'Markdown表格已转换', 'success');
        }

        function tableCopyResult(targetId) {
            const target = document.getElementById(targetId);
            if (!target || !target.innerHTML.trim()) {
                showToast('提示', '没有可复制的表格内容', 'warning');
                return;
            }

            const html = target.innerHTML;
            const text = target.textContent || '';

            const fallbackCopy = () => {
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(target);
                selection.removeAllRanges();
                selection.addRange(range);
                const ok = document.execCommand('copy');
                selection.removeAllRanges();
                if (ok) {
                    showToast('复制成功', '表格已复制到剪贴板');
                } else {
                    showToast('复制失败', '请手动选择表格后复制', 'error');
                }
            };

            if (navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem !== 'undefined') {
                try {
                    const item = new ClipboardItem({
                        'text/html': new Blob([html], { type: 'text/html' }),
                        'text/plain': new Blob([text], { type: 'text/plain' })
                    });
                    navigator.clipboard.write([item]).then(() => {
                        showToast('复制成功', '表格已复制到剪贴板');
                    }).catch(() => fallbackCopy());
                } catch (error) {
                    fallbackCopy();
                }
            } else {
                fallbackCopy();
            }
        }

        function tableReset(type) {
            const mapping = {
                html: { input: 'tableHtmlInput', preview: 'tableHtmlPreview' },
                text: { input: 'tableTextInput', preview: 'tableTextPreview' },
                markdown: { input: 'tableMarkdownInput', preview: 'tableMarkdownPreview' }
            };
            const config = mapping[type];
            if (!config) return;
            const inputEl = document.getElementById(config.input);
            const previewEl = document.getElementById(config.preview);
            if (inputEl) {
                inputEl.value = '';
                updateTableCharCount(config.input, `${config.input}Count`);
            }
            if (previewEl) previewEl.innerHTML = '';
            refreshTablePreviewSkins();
        }

        function prefillTableConverterExamples() {
            const textExample = `商品名称\t类别\t单价\t库存\t销售状态
产品A\t电子产品\t1299.99\t156\t正常销售
产品B\t家居用品\t299.50\t42\t促销中
产品C\t食品饮料\t58.80\t230\t正常销售
产品D\t办公用品\t125.00\t78\t缺货中`;

            const markdownExample = `| 商品名称 | 类别 | 单价 | 库存 | 销售状态 |
| -------- | ---- | ---- | ---- | -------- |
| 产品A | 电子产品 | 1299.99 | 156 | 正常销售 |
| 产品B | 家居用品 | 299.50 | 42 | 促销中 |
| 产品C | 食品饮料 | 58.80 | 230 | 正常销售 |
| **产品D** | 办公用品 | 125.00 | 78 | <br>缺货中<br>预计3天后到货 |`;

            const htmlExample = `<table>
  <tr>
    <th>商品名称</th>
    <th>类别</th>
    <th>单价</th>
    <th>库存</th>
    <th>销售状态</th>
  </tr>
  <tr>
    <td>产品A</td>
    <td>电子产品</td>
    <td>1299.99</td>
    <td>156</td>
    <td>正常销售</td>
  </tr>
  <tr>
    <td>产品B</td>
    <td>家居用品</td>
    <td>299.50</td>
    <td>42</td>
    <td>促销中</td>
  </tr>
  <tr>
    <td>产品C</td>
    <td>食品饮料</td>
    <td>58.80</td>
    <td>230</td>
    <td>正常销售</td>
  </tr>
  <tr>
    <td><strong>产品D</strong></td>
    <td>办公用品</td>
    <td>125.00</td>
    <td>78</td>
    <td>缺货中<br>预计3天后到货</td>
  </tr>
</table>`;

            const textInput = document.getElementById('tableTextInput');
            const mdInput = document.getElementById('tableMarkdownInput');
            const htmlInput = document.getElementById('tableHtmlInput');
            if (textInput) textInput.value = textExample;
            if (mdInput) mdInput.value = markdownExample;
            if (htmlInput) htmlInput.value = htmlExample;
            updateTableCharCount('tableTextInput', 'tableTextInputCount');
            updateTableCharCount('tableMarkdownInput', 'tableMarkdownInputCount');
            updateTableCharCount('tableHtmlInput', 'tableHtmlInputCount');
            refreshTablePreviewSkins();
        }

        // 提取文档标题（用于文件命名和文档属性）
        function extractDocumentTitle(markdownText) {
            const firstLine = markdownText.split('\n')[0].trim();
            if (firstLine.startsWith('#')) {
                return firstLine.replace(/^#+\s*/, '').trim() || '无标题文档';
            }
            return '无标题文档';
        }

        // 分析文档复杂度
        function analyzeDocumentComplexity(markdownText) {
            const size = markdownText.length;
            const lines = markdownText.split('\n').length;
            const hasTables = /\|/.test(markdownText);
            const hasCodeBlocks = /```/.test(markdownText);
            const hasMath = /\$.*?\$|\\\(.*?\\\)|\\\[.*?\\\]|\$\$.*?\$\$/.test(markdownText);
            
            return {
                size: size,
                lines: lines,
                isLarge: size > 10000 || lines > 500,
                hasTables: hasTables,
                hasCodeBlocks: hasCodeBlocks,
                hasMath: hasMath
            };
        }

        // 显示Word转换进度
        function showWordConversionProgress(show = true) {
            const indicator = document.getElementById('wordConversionIndicator');
            if (indicator) {
                if (show) {
                    indicator.classList.add('show');
                } else {
                    indicator.classList.remove('show');
                }
            }
        }

        // 更新Word转换进度
        function updateWordConversionProgress({ step, progress }) {
            const progressBar = document.querySelector('#wordConversionIndicator .progress-bar-fill');
            const progressText = document.querySelector('#wordConversionIndicator .progress-text');
            
            if (progressBar) {
                progressBar.style.width = `${progress}%`;
            }
            
            if (progressText) {
                progressText.textContent = `${step}... ${progress}%`;
            }
        }

        // 异步转换Word文档 - 优化用户体验
        async function downloadWord() {
            const markdownText = markdownInput.value.trim();
            
            if (!markdownText) {
                showToast('提示', '请先输入Markdown内容！', 'warning');
                return;
            }
            
            // 注意：配额检查已在预览生成时进行，此处无需重复检查
            
            // 权限检查2：检查文档大小
            const sizeCheck = checkDocumentSize(markdownText);
            if (!sizeCheck.allowed) {
                showUpgradePrompt(
                    '文档大小超限',
                    `${sizeCheck.message}\n升级账户以处理更大的文档！`,
                    'size'
                );
                return;
            }
            
            // 权限检查3：检查数学公式权限
            const hasMath = /\$.*?\$|\\\(.*?\\\)|\\\[.*?\\\]|\$\$.*?\$\$/.test(markdownText);
            if (hasMath && !hasFeature('mathFormulas')) {
                showUpgradePrompt(
                    '数学公式需要升级',
                    `检测到数学公式，但 ${currentUser.name} 不支持数学公式功能。\n升级到 VIP 或更高等级即可使用！`,
                    'math'
                );
                return;
            }

            // 预检查：文档大小和复杂度
            const complexity = analyzeDocumentComplexity(markdownText);
            if (complexity.isLarge) {
                const proceed = await showConfirm(
                    '大文档提醒', 
                    `检测到较大的文档（${complexity.size}字符），转换可能需要一些时间。是否继续？`,
                    '📄'
                );
                if (!proceed) return;
            }

            // 显示转换进度
            showWordConversionProgress(true);
            updateWordConversionProgress({ step: '解析', progress: 10 });

            try {
                // 提取文档标题
                const documentTitle = extractDocumentTitle(markdownText);
                
                // 异步解析markdown为HTML
                await new Promise(resolve => setTimeout(resolve, 50)); // 给UI一点时间更新
                updateWordConversionProgress({ step: '解析Markdown', progress: 20 });
                
                const html = renderMarkdownToHTML(markdownText);
                
                // 将HTML转换为纯文本并保持基本格式
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;
                
                updateWordConversionProgress({ step: '处理文档结构', progress: 40 });
                
                // 提取文档内容
                const children = [];
                
                // 处理各种元素
                Array.from(tempDiv.children).forEach(element => {
                    const tagName = element.tagName.toLowerCase();
                    const text = element.textContent.trim();
                    
                    if (!text) return;
                    
                    switch(tagName) {
                        case 'h1':
                            children.push(new docx.Paragraph({
                                children: [new docx.TextRun({
                                    text: text,
                                    color: "000000",
                                    bold: true,
                                    size: 32,
                                    font: "宋体"
                                })],
                                spacing: { after: 200 },
                                style: "Heading1"
                            }));
                            break;
                        case 'h2':
                            children.push(new docx.Paragraph({
                                children: [new docx.TextRun({
                                    text: text,
                                    color: "000000",
                                    bold: true,
                                    size: 28,
                                    font: "宋体"
                                })],
                                spacing: { after: 200 },
                                style: "Heading2"
                            }));
                            break;
                        case 'h3':
                            children.push(new docx.Paragraph({
                                children: [new docx.TextRun({
                                    text: text,
                                    color: "000000",
                                    bold: true,
                                    size: 24,
                                    font: "宋体"
                                })],
                                spacing: { after: 200 },
                                style: "Heading3"
                            }));
                            break;
                        case 'h4':
                            children.push(new docx.Paragraph({
                                children: [new docx.TextRun({
                                    text: text,
                                    color: "000000",
                                    bold: true,
                                    size: 20,
                                    font: "宋体"
                                })],
                                spacing: { after: 200 },
                                style: "Heading4"
                            }));
                            break;
                        case 'p':
                            // 处理段落中的格式（递归处理混合格式）
                            const runs = [];
                            
                            // 检查是否包含数学公式
                            const mathFormulas = /\$([^$]+)\$|\\\(([^)]+)\\\)|\\\[([^\]]+)\\\]|\$\$([^$]+)\$\$/g;
                            const hasMath = mathFormulas.test(element.innerHTML);
                            if (hasMath) {
                                // 添加数学公式提示
                                runs.push(new docx.TextRun({
                                    text: "[此段落包含数学公式，请在Word中手动添加公式] ",
                                    color: "000000",
                                    italics: true
                                }));
                            }
                            
                            const processNode = (node) => {
                                if (node.nodeType === Node.TEXT_NODE) {
                                    const textContent = node.textContent;
                                    if (textContent) {
                                        runs.push(new docx.TextRun(textContent));
                                    }
                                } else if (node.nodeType === Node.ELEMENT_NODE) {
                                    const tag = node.tagName.toLowerCase();
                                    
                                    // 特殊处理链接
                                    if (tag === 'a') {
                                        const href = node.getAttribute('href');
                                        const linkText = node.textContent;
                                        const displayText = href ? `${linkText} (${href})` : linkText;
                                        runs.push(new docx.TextRun({
                                            text: displayText,
                                            color: "000000",
                                            underline: {}
                                        }));
                                        return;
                                    }
                                    
                                    // 特殊处理图片
                                    if (tag === 'img') {
                                        const alt = node.getAttribute('alt') || '图片';
                                        const src = node.getAttribute('src') || '';
                                        runs.push(new docx.TextRun({
                                            text: `[图片: ${alt}${src ? ` - ${src}` : ''}] `,
                                            color: "000000",
                                            italics: true
                                        }));
                                        return;
                                    }
                                    
                                    // 递归处理嵌套标签
                                    if (node.childNodes.length > 0) {
                                        Array.from(node.childNodes).forEach(childNode => {
                                            if (childNode.nodeType === Node.TEXT_NODE) {
                                                const textContent = childNode.textContent;
                                                if (textContent) {
                                                    const runProps = {};
                                                    
                                                    // 根据父标签设置格式
                                                    switch(tag) {
                                                        case 'strong':
                                                        case 'b':
                                                            runProps.bold = true;
                                                            break;
                                                        case 'em':
                                                        case 'i':
                                                            runProps.italics = true;
                                                            break;
                                                        case 'code':
                                                            runProps.font = "Courier New";
                                                            runProps.highlight = "yellow";
                                                            break;
                                                        case 'u':
                                                            runProps.underline = {};
                                                            break;
                                                        case 's':
                                                        case 'del':
                                                            runProps.strike = true;
                                                            break;
                                                    }
                                                    
                                                    runs.push(new docx.TextRun({
                                                        text: textContent,
                                                        ...runProps
                                                    }));
                                                }
                                            } else if (childNode.nodeType === Node.ELEMENT_NODE) {
                                                // 处理嵌套格式（如粗体+斜体）
                                                const childTag = childNode.tagName.toLowerCase();
                                                const childText = childNode.textContent;
                                                if (childText) {
                                                    const runProps = {};
                                                    
                                                    // 继承父标签格式
                                                    if (tag === 'strong' || tag === 'b') runProps.bold = true;
                                                    if (tag === 'em' || tag === 'i') runProps.italics = true;
                                                    if (tag === 'code') {
                                                        runProps.font = "Courier New";
                                                        runProps.highlight = "yellow";
                                                    }
                                                    
                                                    // 添加子标签格式
                                                    if (childTag === 'strong' || childTag === 'b') runProps.bold = true;
                                                    if (childTag === 'em' || childTag === 'i') runProps.italics = true;
                                                    if (childTag === 'code') {
                                                        runProps.font = "Courier New";
                                                        runProps.highlight = "yellow";
                                                    }
                                                    if (childTag === 'u') runProps.underline = {};
                                                    if (childTag === 's' || childTag === 'del') runProps.strike = true;
                                                    
                                                    runs.push(new docx.TextRun({
                                                        text: childText,
                                                        ...runProps
                                                    }));
                                                }
                                            }
                                        });
                                    } else {
                                        // 没有子节点的元素
                                        const content = node.textContent;
                                        if (content) {
                                            const runProps = {};
                                            switch(tag) {
                                                case 'strong':
                                                case 'b':
                                                    runProps.bold = true;
                                                    break;
                                                case 'em':
                                                case 'i':
                                                    runProps.italics = true;
                                                    break;
                                                case 'code':
                                                    runProps.font = "Courier New";
                                                    runProps.highlight = "yellow";
                                                    break;
                                                case 'u':
                                                    runProps.underline = {};
                                                    break;
                                                case 's':
                                                case 'del':
                                                    runProps.strike = true;
                                                    break;
                                            }
                                            runs.push(new docx.TextRun({
                                                text: content,
                                                ...runProps
                                            }));
                                        }
                                    }
                                }
                            };
                            
                            // 处理所有子节点
                            Array.from(element.childNodes).forEach(processNode);
                            
                            // 如果没有runs，使用纯文本
                            if (runs.length === 0 && text) {
                                runs.push(new docx.TextRun(text));
                            }
                            
                            if (runs.length > 0) {
                                children.push(new docx.Paragraph({
                                    children: runs,
                                    spacing: { after: 120 }
                                }));
                            }
                            break;
                        case 'ul':
                            // 改进的无序列表处理，支持嵌套
                            const processULItems = (listElement, level = 0) => {
                                Array.from(listElement.children).forEach(li => {
                                    if (li.tagName.toLowerCase() === 'li') {
                                        // 获取当前项的直接文本内容
                                        const directText = Array.from(li.childNodes)
                                            .filter(node => node.nodeType === Node.TEXT_NODE || 
                                                   (node.nodeType === Node.ELEMENT_NODE && 
                                                    !['ul', 'ol'].includes(node.tagName.toLowerCase())))
                                            .map(node => node.textContent)
                                            .join('').trim();
                                        
                                        if (directText) {
                                            children.push(new docx.Paragraph({
                                                text: directText,
                                                bullet: {
                                                    level: level
                                                },
                                                spacing: { after: 80 }
                                            }));
                                        }
                                        
                                        // 处理嵌套列表
                                        const nestedLists = li.querySelectorAll(':scope > ul, :scope > ol');
                                        nestedLists.forEach(nestedList => {
                                            if (nestedList.tagName.toLowerCase() === 'ul') {
                                                processULItems(nestedList, level + 1);
                                            } else {
                                                processOLItems(nestedList, level + 1);
                                            }
                                        });
                                    }
                                });
                            };
                            processULItems(element);
                            break;
                        case 'ol':
                            // 改进的有序列表处理，支持嵌套
                            const processOLItems = (listElement, level = 0) => {
                                Array.from(listElement.children).forEach(li => {
                                    if (li.tagName.toLowerCase() === 'li') {
                                        // 获取当前项的直接文本内容
                                        const directText = Array.from(li.childNodes)
                                            .filter(node => node.nodeType === Node.TEXT_NODE || 
                                                   (node.nodeType === Node.ELEMENT_NODE && 
                                                    !['ul', 'ol'].includes(node.tagName.toLowerCase())))
                                            .map(node => node.textContent)
                                            .join('').trim();
                                        
                                        if (directText) {
                                            children.push(new docx.Paragraph({
                                                text: directText,
                                                numbering: {
                                                    reference: "default-numbering",
                                                    level: level
                                                },
                                                spacing: { after: 80 }
                                            }));
                                        }
                                        
                                        // 处理嵌套列表
                                        const nestedLists = li.querySelectorAll(':scope > ul, :scope > ol');
                                        nestedLists.forEach(nestedList => {
                                            if (nestedList.tagName.toLowerCase() === 'ul') {
                                                processULItems(nestedList, level + 1);
                                            } else {
                                                processOLItems(nestedList, level + 1);
                                            }
                                        });
                                    }
                                });
                            };
                            processOLItems(element);
                            break;
                        case 'blockquote':
                            children.push(new docx.Paragraph({
                                text: text,
                                indent: {
                                    left: 720
                                },
                                spacing: { after: 120 }
                            }));
                            break;
                        case 'pre':
                            // 处理代码块
                            const codeElement = element.querySelector('code');
                            const codeText = codeElement ? codeElement.textContent : text;
                            const codeLines = codeText.split('\n');
                            
                            // 添加代码块标题
                            children.push(new docx.Paragraph({
                                text: "代码块:",
                                spacing: { before: 120, after: 80 },
                                run: {
                                    bold: true,
                                    color: "000000"
                                }
                            }));
                            
                            // 为每行代码创建段落
                            codeLines.forEach((line, index) => {
                                children.push(new docx.Paragraph({
                                    text: line || " ", // 空行用空格占位
                                    spacing: { after: 0, before: 0 },
                                    run: {
                                        font: "Consolas",
                                        size: 18
                                    },
                                    shading: {
                                        type: docx.ShadingType.SOLID,
                                        color: "f8f8f8"
                                    },
                                    border: {
                                        left: {
                                            color: "cccccc",
                                            size: 1,
                                            type: docx.BorderStyle.SINGLE
                                        }
                                    },
                                    indent: {
                                        left: 360
                                    }
                                }));
                            });
                            
                            // 代码块后空行
                            children.push(new docx.Paragraph({
                                text: "",
                                spacing: { after: 120 }
                            }));
                            break;
                        case 'table':
                            // 增强表格处理
                            const rows = Array.from(element.querySelectorAll('tr'));
                            if (rows.length > 0) {
                                const tableRows = rows.map((row, rowIndex) => {
                                    const cells = Array.from(row.querySelectorAll('td, th'));
                                    const isHeader = row.querySelector('th') !== null || rowIndex === 0;
                                    
                                    return new docx.TableRow({
                                        children: cells.map(cell => new docx.TableCell({
                                            children: [new docx.Paragraph({
                                                text: cell.textContent.trim(),
                                                run: isHeader ? {
                                                    bold: true,
                                                    color: "2F5597"
                                                } : {}
                                            })],
                                            shading: isHeader ? {
                                                type: docx.ShadingType.SOLID,
                                                color: "F2F5FF"
                                            } : undefined,
                                            margins: {
                                                top: 120,
                                                bottom: 120,
                                                left: 120,
                                                right: 120
                                            }
                                        }))
                                    });
                                });
                                
                                children.push(new docx.Table({
                                    rows: tableRows,
                                    width: {
                                        size: 100,
                                        type: docx.WidthType.PERCENTAGE
                                    },
                                    borders: {
                                        top: { style: docx.BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                                        bottom: { style: docx.BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                                        left: { style: docx.BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                                        right: { style: docx.BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                                        insideHorizontal: { style: docx.BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                                        insideVertical: { style: docx.BorderStyle.SINGLE, size: 1, color: "CCCCCC" }
                                    }
                                }));
                                
                                // 表格后添加空行
                                children.push(new docx.Paragraph({
                                    text: "",
                                    spacing: { after: 200 }
                                }));
                            }
                            break;
                        default:
                            children.push(new docx.Paragraph({
                                text: text,
                                spacing: { after: 120 }
                            }));
                    }
                });

                // 如果没有内容，创建一个默认段落
                if (children.length === 0) {
                    children.push(new docx.Paragraph("文档内容"));
                }

                updateWordConversionProgress({ step: '构建文档', progress: 70 });
                await new Promise(resolve => setTimeout(resolve, 100)); // 异步间隔

                // 创建Word文档
                const doc = new docx.Document({
                    creator: "Markdown转Word转换器",
                    title: documentTitle,
                    description: "由Markdown转Word转换器生成",
                    styles: {
                        paragraphStyles: [
                            {
                                id: "Heading1",
                                name: "标题 1",
                                basedOn: "Normal",
                                next: "Normal",
                                quickFormat: true,
                                run: {
                                    size: 32,
                                    bold: true,
                                    color: "000000",
                                    font: "宋体"
                                },
                                paragraph: {
                                    spacing: {
                                        after: 240,
                                        before: 240
                                    },
                                    thematicBreak: false
                                }
                            },
                            {
                                id: "Heading2", 
                                name: "标题 2",
                                basedOn: "Normal",
                                next: "Normal",
                                quickFormat: true,
                                run: {
                                    size: 28,
                                    bold: true,
                                    color: "000000",
                                    font: "宋体"
                                },
                                paragraph: {
                                    spacing: {
                                        after: 200,
                                        before: 200
                                    },
                                    thematicBreak: false
                                }
                            },
                            {
                                id: "Heading3", 
                                name: "标题 3",
                                basedOn: "Normal",
                                next: "Normal",
                                quickFormat: true,
                                run: {
                                    size: 24,
                                    bold: true,
                                    color: "000000",
                                    font: "宋体"
                                },
                                paragraph: {
                                    spacing: {
                                        after: 160,
                                        before: 160
                                    },
                                    thematicBreak: false
                                }
                            },
                            {
                                id: "Heading4", 
                                name: "标题 4",
                                basedOn: "Normal",
                                next: "Normal",
                                quickFormat: true,
                                run: {
                                    size: 20,
                                    bold: true,
                                    color: "000000",
                                    font: "宋体"
                                },
                                paragraph: {
                                    spacing: {
                                        after: 120,
                                        before: 120
                                    }
                                }
                            },
                            {
                                id: "CodeBlock",
                                name: "代码块",
                                basedOn: "Normal",
                                run: {
                                    font: "Consolas",
                                    size: 18
                                },
                                paragraph: {
                                    shading: {
                                        type: docx.ShadingType.SOLID,
                                        color: "F8F8F8"
                                    },
                                    indent: {
                                        left: 360
                                    },
                                    spacing: {
                                        after: 120
                                    }
                                }
                            }
                        ]
                    },
                    numbering: {
                        config: [
                            {
                                reference: "default-numbering",
                                levels: [
                                    {
                                        level: 0,
                                        format: docx.LevelFormat.DECIMAL,
                                        text: "%1.",
                                        alignment: docx.AlignmentType.START,
                                        style: {
                                            paragraph: {
                                                indent: { left: 720, hanging: 360 }
                                            }
                                        }
                                    },
                                    {
                                        level: 1,
                                        format: docx.LevelFormat.DECIMAL,
                                        text: "%1.%2.",
                                        alignment: docx.AlignmentType.START,
                                        style: {
                                            paragraph: {
                                                indent: { left: 1080, hanging: 360 }
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    },
                    sections: [{
                        properties: {
                            page: {
                                margin: {
                                    top: 1440,    // 1 inch = 1440 twips
                                    right: 1440,
                                    bottom: 1440,
                                    left: 1440
                                }
                            }
                        },
                        children: children
                    }]
                });

                updateWordConversionProgress({ step: '生成文档', progress: 90 });
                
                // 异步生成并下载文件
                try {
                    const blob = await docx.Packer.toBlob(doc);
                    
                    updateWordConversionProgress({ step: '准备下载', progress: 95 });
                    await new Promise(resolve => setTimeout(resolve, 200));
                    
                    // 智能文件命名
                    const currentDate = new Date().toISOString().slice(0, 10);
                    const safeTitle = documentTitle
                        .replace(/[<>:"/\\|?*]/g, '-')  // 替换非法字符
                        .substring(0, 50);              // 限制长度
                    const fileName = `${safeTitle}-${currentDate}.docx`;
                    
                    saveAs(blob, fileName);
                    
                    updateWordConversionProgress({ step: '完成', progress: 100 });
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    showWordConversionProgress(false);
                    showToast('下载完成', `Word文档"${safeTitle}"已成功生成并下载`, 'success', 3000);
                    
                } catch (packError) {
                    console.error('Word生成失败:', packError);
                    showWordConversionProgress(false);
                    showToast('生成失败', `Word文档生成过程中出现错误: ${packError.message}`, 'error', 5000);
                }

            } catch (error) {
                console.error('转换失败:', error);
                showWordConversionProgress(false);
                rollbackUsage(); // 回滚配额
                
                // 增强错误处理
                let errorMessage = '请检查您的Markdown格式是否正确';
                if (error.message.includes('marked')) {
                    errorMessage = 'Markdown解析失败，请检查语法格式';
                } else if (error.message.includes('docx')) {
                    errorMessage = 'Word文档生成失败，请重试';
                } else if (error.name === 'TypeError') {
                    errorMessage = '文档结构异常，请简化内容后重试';
                }
                
                showToast('转换失败', errorMessage, 'error', 5000);
            }
        }

        // 上传Markdown文件
        function uploadFile() {
            document.getElementById('fileInput').click();
        }

        // 处理单个文件的通用函数
        function processFile(file, uploadType = '上传') {
            if (!file) return;

            // 检查文件类型
            const allowedTypes = ['.md', '.markdown', '.txt'];
            const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
            if (!allowedTypes.includes(fileExtension)) {
                showToast('文件类型错误', `请${uploadType} .md, .markdown 或 .txt 格式的文件`, 'error');
                return;
            }

            // 检查文件大小 (限制5MB)
            if (file.size > 5 * 1024 * 1024) {
                showToast('文件过大', '文件大小不能超过5MB', 'error');
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    // 设置示例加载标志，避免文件上传计入配额
                    isLoadingExample = true;
                    
                    markdownInput.value = e.target.result;
                    updateWordCount();
                    updatePreview();
                    showToast('上传成功', `文件 ${file.name} ${uploadType}成功`);
                    
                    // 上传完成后重置标志
                    setTimeout(() => {
                        isLoadingExample = false;
                    }, 100);
                } catch (error) {
                    console.error('文件处理错误:', error);
                    showToast('处理失败', '文件内容处理失败，请检查文件格式', 'error');
                }
            };
            reader.onerror = function() {
                showToast('读取失败', '文件读取失败，请重试', 'error');
            };
            reader.readAsText(file, 'UTF-8');
        }

        // 处理文件上传
        function handleFileUpload(event) {
            const file = event.target.files[0];
            processFile(file, '上传');
        }

        // 保存草稿到本地存储
        function saveToLocal() {
            const content = markdownInput.value;
            if (!content.trim()) {
                showToast('提示', '没有内容可保存！', 'warning');
                return;
            }
            
            const timestamp = new Date().toLocaleString();
            localStorage.setItem('markdown-draft', content);
            localStorage.setItem('markdown-draft-timestamp', timestamp);
            showToast('保存成功', `草稿已保存 (${timestamp})`);
        }

        // 从本地存储加载草稿
        async function loadFromLocal() {
            const savedContent = localStorage.getItem('markdown-draft');
            const timestamp = localStorage.getItem('markdown-draft-timestamp');
            
            if (!savedContent) {
                showToast('提示', '没有找到保存的草稿！', 'info');
                return;
            }
            
            if (markdownInput.value.trim()) {
                const confirmed = await showConfirm(
                    '加载草稿',
                    '当前有内容，是否确认加载草稿？这将覆盖当前内容。',
                    '📂'
                );
                if (!confirmed) return;
            }
            
            // 设置示例加载标志，避免草稿加载计入配额
            isLoadingExample = true;
            
            markdownInput.value = savedContent;
            updateWordCount();
            updatePreview();
            showToast('加载完成', `草稿加载成功 (${timestamp || '未知'})`);
            
            // 草稿加载完成后重置标志
            setTimeout(() => {
                isLoadingExample = false;
            }, 100);
        }

        // 自动保存功能已移除，避免弹窗问题

        // 添加拖拽上传支持（只有在认证后才添加）
        function initializeDragAndDrop() {
            const markdownInput = document.getElementById('markdownInput');
            const dragOverlay = document.getElementById('dragOverlay');
            if (!markdownInput || !dragOverlay) return;

            // 拖拽进入
            markdownInput.addEventListener('dragenter', function(e) {
                e.preventDefault();
                dragOverlay.classList.add('show');
            });

            // 拖拽悬停
            markdownInput.addEventListener('dragover', function(e) {
                e.preventDefault();
                dragOverlay.classList.add('show');
            });

            // 拖拽离开
            markdownInput.addEventListener('dragleave', function(e) {
                e.preventDefault();
                // 检查是否真的离开了拖拽区域
                const rect = this.getBoundingClientRect();
                if (e.clientX < rect.left || e.clientX > rect.right || 
                    e.clientY < rect.top || e.clientY > rect.bottom) {
                    dragOverlay.classList.remove('show');
                }
            });

            // 文件放置
            markdownInput.addEventListener('drop', function(e) {
                e.preventDefault();
                dragOverlay.classList.remove('show');
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    const file = files[0];
                    // 显示上传开始提示
                    showToast('开始上传', `正在读取文件 ${file.name}...`, 'info', 1000);
                    processFile(file, '拖拽上传');
                }
            });

            // 全局拖拽事件处理，防止页面刷新
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                document.addEventListener(eventName, function(e) {
                    e.preventDefault();
                }, false);
            });
        }

        // 自动保存功能已移除

        // 添加快捷键支持
        document.addEventListener('keydown', function(e) {
            // Ctrl+S 保存草稿
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                saveToLocal();
            }
            // Ctrl+O 打开文件
            if (e.ctrlKey && e.key === 'o') {
                e.preventDefault();
                uploadFile();
            }
            // Ctrl+D 下载Word
            if (e.ctrlKey && e.key === 'd') {
                e.preventDefault();
                downloadWord();
            }
            // Ctrl+Enter 复制富文本
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                copyFormattedText();
            }
            // Ctrl+/ 显示快捷键
            if (e.ctrlKey && e.key === '/') {
                e.preventDefault();
                showShortcuts();
            }
            // Ctrl+Q 退出登录
            if (e.ctrlKey && e.key === 'q') {
                e.preventDefault();
                showLogoutConfirm();
            }
        });

        // 显示快捷键帮助
        function showShortcuts() {
            const shortcuts = [
                { key: 'Ctrl + S', desc: '保存草稿到本地存储' },
                { key: 'Ctrl + O', desc: '打开并上传文件' },
                { key: 'Ctrl + D', desc: '下载Word文档' },
                { key: 'Ctrl + Enter', desc: '复制富文本内容' },
                { key: 'Ctrl + Q', desc: '退出登录' },
                { key: 'Ctrl + /', desc: '显示快捷键帮助' },
                { key: 'Esc', desc: '关闭对话框' }
            ];
            
            const shortcutsList = shortcuts.map(item => 
                `<div style="display: flex; justify-content: space-between; margin: 8px 0; padding: 6px 0; border-bottom: 1px solid var(--border-color);">
                    <code style="background: var(--preview-bg); padding: 2px 6px; border-radius: 4px; font-weight: 600;">${item.key}</code>
                    <span style="color: var(--text-secondary);">${item.desc}</span>
                </div>`
            ).join('');
            
            showConfirm(
                '⌨️ 键盘快捷键',
                `<div style="text-align: left; max-width: 400px;">${shortcutsList}</div>`,
                '💡'
            );
        }

        // 主题管理功能
        let currentTheme = 'amber'; // 默认暖阳琥珀主题
        
        function toggleTheme(event) {
            const themes = [
                { name: 'amber', text: '暖阳琥珀', dataTheme: null, bg: '#f67062' },
                { name: 'classic', text: '浅林绿意', dataTheme: 'classic', bg: '#3aa58f' },
                { name: 'noir', text: '现代黑金', dataTheme: 'noir', bg: '#111827' },
                { name: 'aurora', text: '极光幻彩', dataTheme: 'aurora', bg: '#7f5af0' }
            ];
            
            const currentIndex = themes.findIndex(theme => theme.name === currentTheme);
            const nextIndex = (currentIndex + 1) % themes.length;
            const nextTheme = themes[nextIndex];
            
            // 获取鼠标位置
            const rect = event.target.getBoundingClientRect();
            const x = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
            const y = ((rect.top + rect.height / 2) / window.innerHeight) * 100;
            
            // 设置过渡效果的起始位置和颜色
            const transition = document.getElementById('themeTransition');
            const themeToggle = event.target.closest('.theme-toggle');
            
            transition.style.setProperty('--mouse-x', x + '%');
            transition.style.setProperty('--mouse-y', y + '%');
            transition.style.setProperty('--new-bg', nextTheme.bg);
            
            // 添加切换动画类
            themeToggle.classList.add('switching');
            
            // 开始过渡动画
            transition.classList.add('active');
            
            // 延迟切换主题，让过渡动画先开始
            setTimeout(() => {
                currentTheme = nextTheme.name;
                
                // 更新body的data-theme属性
                if (nextTheme.dataTheme) {
                    document.body.setAttribute('data-theme', nextTheme.dataTheme);
                } else {
                    document.body.removeAttribute('data-theme');
                }
                
                // 更新按钮文本
                document.getElementById('themeText').textContent = nextTheme.text;
                
                // 保存到localStorage
                localStorage.setItem('selectedTheme', currentTheme);
            }, 200);
            
            // 结束过渡动画
            setTimeout(() => {
                transition.classList.remove('active');
                themeToggle.classList.remove('switching');
                showToast('主题已切换', `已切换到${nextTheme.text}主题`);
            }, 600);
        }
        
        function loadSavedTheme() {
            const savedTheme = localStorage.getItem('selectedTheme');
            if (savedTheme && savedTheme !== 'amber') {
                currentTheme = savedTheme;
                const themes = [
                    { name: 'amber', text: '暖阳琥珀', dataTheme: null },
                    { name: 'classic', text: '浅林绿意', dataTheme: 'classic' },
                    { name: 'noir', text: '现代黑金', dataTheme: 'noir' },
                    { name: 'aurora', text: '极光幻彩', dataTheme: 'aurora' }
                ];
                
                const theme = themes.find(t => t.name === savedTheme);
                if (theme) {
                    if (theme.dataTheme) {
                        document.body.setAttribute('data-theme', theme.dataTheme);
                    } else {
                        document.body.removeAttribute('data-theme');
                    }
                    document.getElementById('themeText').textContent = theme.text;
                }
            }
        }

        // 页面加载时检查认证状态
        window.addEventListener('load', function() {
            checkAuthentication();
            // 加载保存的主题（在认证后）
            setTimeout(() => {
                loadSavedTheme();
            }, 100);
            
            // 初始化自定义AI配置功能
            setTimeout(() => {
                initializeCustomAIConfigs();
            }, 500);
            
            // 额外的安全检查：确保实时预览功能正常工作
            setTimeout(() => {
                ensurePreviewFunctionality();
            }, 2000);
        });
        
        // 初始化自定义AI配置功能
        function initializeCustomAIConfigs() {
            // 只有在用户已登录时才初始化
            const isAuthenticated = sessionStorage.getItem('authenticated') === 'true';
            if (!isAuthenticated) return;
            
            // 确保AI配置界面的服务商选择器包含自定义配置
            try {
                updateProviderSelector();
                console.log('✅ 自定义AI配置功能已初始化');
            } catch (error) {
                console.warn('⚠️ 自定义AI配置初始化失败:', error);
            }
        }
        
        // 确保实时预览功能正常工作的安全检查
        function ensurePreviewFunctionality() {
            // 只有在用户已登录时才进行检查
            const isAuthenticated = sessionStorage.getItem('authenticated') === 'true';
            if (!isAuthenticated) return;
            
            const markdownInput = document.getElementById('markdownInput');
            if (!markdownInput) return;
            
            // 检查事件绑定是否成功
            let hasInputListener = false;
            try {
                // 简单的测试：检查是否有input事件监听器
                const listeners = getEventListeners && getEventListeners(markdownInput);
                hasInputListener = listeners && listeners.input && listeners.input.length > 0;
            } catch (error) {
                // 在某些浏览器中getEventListeners可能不可用，改用其他方法检查
                hasInputListener = false;
            }
            
            // 如果没有监听器或不确定，尝试重新初始化
            if (!hasInputListener) {
                console.warn('🔧 检测到实时预览可能未正确初始化，尝试修复...');
                initializeEventBindings();
                
                // 显示用户友好的提示
                setTimeout(() => {
                    showToast('系统检查', '已自动优化实时预览功能', 'info', 2000);
                }, 500);
            } else {
                console.log('✅ 实时预览功能运行正常');
            }
        }
