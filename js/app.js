(function () {
    'use strict';

    const STORAGE = {
        settings: 'md2word.personal.settings.v3',
        autosave: 'md2word.personal.autosave.v3',
        split: 'md2word.personal.split.v3',
        ai: 'md2word.personal.ai.v3',
        viewLegacy: 'md2word.personal.view.v5',
        viewDesktop: 'md2word.personal.view.desktop.v5.1',
        viewMobile: 'md2word.personal.view.mobile.v5.1'
    };

    const DEFAULT_SETTINGS = Object.freeze({
        theme: 'amber',
        editorFontSize: 15,
        autosave: true,
        restoreDraftOnStart: false,
        repairLooseMath: true,
        syncScroll: false,
        wordFont: '宋体',
        wordFontSize: 11,
        wordLineSpacing: 1.5,
        wordMarginCm: 2.54
    });

    const AI_PRESETS = Object.freeze({
        custom: { type: 'openai', endpoint: '', model: '' },
        kimi: { type: 'openai', endpoint: 'https://api.moonshot.ai/v1/chat/completions', model: 'kimi-k2.5' },
        glm: { type: 'openai', endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', model: 'glm-4.7-flashx' },
        deepseek: { type: 'openai', endpoint: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-v4-flash' },
        openai: { type: 'openai', endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-5-mini' },
        gemini: { type: 'gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-3.6-flash' }
    });

    const THEME_ORDER = Object.freeze(['amber', 'forest', 'noir', 'aurora']);
    const THEME_LABELS = Object.freeze({
        amber: '暖阳琥珀',
        forest: '经典浅林',
        noir: '现代黑金',
        aurora: '极光幻彩'
    });
    const AI_PROVIDER_LABELS = Object.freeze({
        custom: '自定义',
        kimi: 'Kimi',
        glm: 'GLM',
        deepseek: 'DeepSeek',
        openai: 'OpenAI',
        gemini: 'Gemini'
    });
    const FALLBACK_ACCESS = Object.freeze({
        sessionKey: 'md2word.fusion.auth.v5.1',
        users: Object.freeze({
            basic123: Object.freeze({ level: 'basic', name: '基础用户', icon: '🆓', label: '基础版' }),
            '517517': Object.freeze({ level: 'advanced', name: '高级用户', icon: '⭐', label: '高级版' }),
            lingling: Object.freeze({ level: 'super_admin', name: '超级管理员', icon: '👑', label: '管理版' })
        })
    });

    const FORMULA_EXAMPLE = String.raw`# 化学结构示例

在化学逻辑上是可以成立的，目标结构也写对了：

\[
\text{玻片–O–Si–(CH}_2)_3\text{–S–S–(CH}_2)_2\text{–NH–CO–C(Br)(CH}_3)_2
\]

行内公式同样支持，例如 \(k = A e^{-E_a/(RT)}\)。

## 支持的边界

- 行内：\`$x_1$\` 或 \`\\(x_1\\)\`
- 独立：\`$$...$$\` 或 \`\\[...\\]\`
- 从 AI 文本中复制来的独立 \`[ ... ]\` 块，在内部明显含 TeX 时也会自动修复。

> 公式会在 Markdown 解析前被保护，因此反斜杠不会再被 Marked 当成普通转义吃掉。`;

    const state = {
        settings: { ...DEFAULT_SETTINGS },
        renderTimer: null,
        renderGeneration: 0,
        renderResult: null,
        currentFileName: '未命名.md',
        documentName: '未命名',
        dirty: false,
        draftDirty: false,
        lastDraftSavedAt: null,
        fileOrigin: 'new',
        fileSyncedAt: null,
        autosaveTimer: null,
        pendingDraft: null,
        lastDestructiveSnapshot: null,
        statusTimer: null,
        syncLock: false,
        dragDepth: 0,
        splitterDrag: null,
        aiAbortController: null,
        aiTarget: null,
        aiConfig: null,
        tableMarkdown: '',
        themeMedia: null,
        activeTool: '',
        currentUser: null,
        authReady: false,
        initialized: false,
        exporting: false,
        exportReport: null,
        viewportMode: ''
    };

    const dom = {};

    function byId(id) {
        return document.getElementById(id);
    }

    function queryAll(selector, root = document) {
        return Array.from(root.querySelectorAll(selector));
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function safeJsonParse(raw, fallback) {
        if (!raw) return fallback;
        try {
            return JSON.parse(raw);
        } catch (_error) {
            return fallback;
        }
    }

    function localStorageGet(key) {
        try {
            return window.localStorage.getItem(key);
        } catch (_error) {
            return null;
        }
    }

    function localStorageSet(key, value) {
        try {
            window.localStorage.setItem(key, value);
            return true;
        } catch (_error) {
            return false;
        }
    }

    function localStorageRemove(key) {
        try {
            window.localStorage.removeItem(key);
            return true;
        } catch (_error) {
            return false;
        }
    }

    function nextFrame() {
        return new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }

    function debounce(fn, wait) {
        let timer = null;
        return function debounced(...args) {
            window.clearTimeout(timer);
            timer = window.setTimeout(() => fn.apply(this, args), wait);
        };
    }

    function initialize() {
        if (state.initialized) return;
        state.initialized = true;
        cacheDom();
        state.viewportMode = getViewportMode();
        syncDocumentNameInput();
        loadSettings();
        loadAIConfig();
        applySettings();
        checkDependencies();
        bindEvents();
        prepareAutosave();
        restoreSplitPosition();
        restoreView();
        updateStats();
        updateSaveStatus();
        renderPreview({ immediate: true });
        updateTableOutput();
        updateAIToolSummary();
        updateExportReadiness();
        initializeAccessGate();
    }

    function cacheDom() {
        Object.assign(dom, {
            app: byId('app'),
            dependencyBanner: byId('dependencyBanner'),
            dependencyMessage: byId('dependencyMessage'),
            markdownInput: byId('markdownInput'),
            preview: byId('preview'),
            workspace: byId('workspace'),
            editorFrame: byId('editorFrame'),
            dropOverlay: byId('dropOverlay'),
            splitter: byId('splitter'),
            fileInput: byId('fileInput'),
            saveDot: byId('saveDot'),
            saveStatus: byId('saveStatus'),
            fileSaveStatus: byId('fileSaveStatus'),
            documentNameInput: byId('documentNameInput'),
            mathStatus: byId('mathStatus'),
            mathStatusText: byId('mathStatusText'),
            outlineSelect: byId('outlineSelect'),
            formulaInspector: byId('formulaInspector'),
            formulaInspectorContent: byId('formulaInspectorContent'),
            applyMathNormalization: byId('applyMathNormalization'),
            syncScrollToggle: byId('syncScrollToggle'),
            settingsSyncScrollToggle: byId('settingsSyncScrollToggle'),
            renderStatus: byId('renderStatus'),
            statusMessage: byId('statusMessage'),
            statusMessageText: byId('statusMessageText'),
            undoDocumentButton: byId('undoDocumentButton'),
            charCount: byId('charCount'),
            wordCount: byId('wordCount'),
            lineCount: byId('lineCount'),
            readTime: byId('readTime'),
            toastRegion: byId('toastRegion'),
            settingsDialog: byId('settingsDialog'),
            settingsForm: byId('settingsForm'),
            settingsNav: byId('settingsNav'),
            toolDrawer: byId('toolDrawer'),
            toolDrawerTitle: byId('toolDrawerTitle'),
            tableToolPanel: byId('tableToolPanel'),
            aiToolPanel: byId('aiToolPanel'),
            exportCheckToolPanel: byId('exportCheckToolPanel'),
            exportCheckSummary: byId('exportCheckSummary'),
            exportCheckDetail: byId('exportCheckDetail'),
            exportCheckList: byId('exportCheckList'),
            exportReadinessChip: byId('exportReadinessChip'),
            forceExportButton: byId('forceExportButton'),
            aiProgress: byId('aiProgress'),
            aiResultPanel: byId('aiResultPanel'),
            aiConflict: byId('aiConflict'),
            applyAiResultButton: byId('applyAiResultButton'),
            downloadWordButton: byId('downloadWordButton'),
            downloadWordIcon: byId('downloadWordIcon'),
            downloadWordLabel: byId('downloadWordLabel'),
            exportIssueBadge: byId('exportIssueBadge'),
            toolbarMoreMenu: byId('toolbarMoreMenu'),
            passwordOverlay: byId('passwordOverlay'),
            passwordForm: byId('passwordForm'),
            passwordInput: byId('passwordInput'),
            passwordToggle: byId('passwordToggle'),
            pasteShareCodeButton: byId('pasteShareCodeButton'),
            passwordError: byId('passwordError'),
            userStatus: byId('userStatus'),
            userIcon: byId('userIcon'),
            userName: byId('userName'),
            userLevel: byId('userLevel'),
            themeText: byId('themeText')
        });
    }

    function bindEvents() {
        dom.markdownInput.addEventListener('input', onEditorInput);
        dom.markdownInput.addEventListener('keydown', onEditorKeydown);
        dom.documentNameInput.addEventListener('input', onDocumentNameInput);
        dom.documentNameInput.addEventListener('blur', normalizeDocumentNameInput);
        dom.documentNameInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                dom.documentNameInput.blur();
            }
        });
        dom.markdownInput.addEventListener('scroll', () => syncScrollFrom(dom.markdownInput, dom.preview));
        dom.preview.addEventListener('scroll', () => syncScrollFrom(dom.preview, dom.markdownInput));
        dom.preview.addEventListener('click', handlePreviewMathActivation);
        dom.preview.addEventListener('keydown', handlePreviewMathActivation);
        dom.fileInput.addEventListener('change', onFileChosen);
        dom.outlineSelect.addEventListener('change', navigateOutline);
        dom.syncScrollToggle.addEventListener('change', () => {
            state.settings.syncScroll = dom.syncScrollToggle.checked;
            if (dom.settingsSyncScrollToggle) dom.settingsSyncScrollToggle.checked = state.settings.syncScroll;
            persistSettings();
            setStatusMessage(state.settings.syncScroll ? '已开启编辑与预览同步滚动。' : '已关闭同步滚动。', { duration: 2600 });
        });
        dom.mathStatus.addEventListener('click', () => toggleFormulaInspector());
        byId('themeButton').addEventListener('click', toggleTheme);
        byId('settingsButton').addEventListener('click', () => openSettings('interface'));
        byId('tableInput').addEventListener('input', updateTableOutput);
        byId('aiProvider').addEventListener('change', applyAIPreset);
        dom.applyMathNormalization.addEventListener('click', applyMathNormalization);
        document.addEventListener('click', handleDelegatedClick);
        document.addEventListener('keydown', onGlobalKeydown);
        document.addEventListener('click', (event) => {
            if (dom.toolbarMoreMenu && dom.toolbarMoreMenu.open && !dom.toolbarMoreMenu.contains(event.target)) closeToolbarMoreMenu();
        });
        bindViewSwitch();
        bindSplitter();
        bindDragAndDrop();
        bindSettingsDialog();
        bindAccessEvents();
        window.addEventListener('resize', debounce(() => {
            sanitizeSplitPosition();
            const nextMode = getViewportMode();
            if (nextMode !== state.viewportMode) {
                state.viewportMode = nextMode;
                restoreView();
            }
            closeToolbarMoreMenu();
            if (state.settings.theme === 'system') applyTheme();
        }, 120));

        state.themeMedia = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
        if (state.themeMedia && typeof state.themeMedia.addEventListener === 'function') {
            state.themeMedia.addEventListener('change', () => {
                if (state.settings.theme === 'system') applyTheme();
            });
        }
    }

    function handleDelegatedClick(event) {
        const settingsTab = event.target.closest('[data-settings-tab]');
        if (settingsTab) {
            activateSettingsTab(settingsTab.dataset.settingsTab, { focus: true });
            return;
        }

        const commandButton = event.target.closest('[data-command]');
        if (commandButton) {
            closeToolbarMoreMenu();
            applyEditorCommand(commandButton.dataset.command);
            return;
        }

        const actionButton = event.target.closest('[data-action]');
        if (!actionButton) return;
        const action = actionButton.dataset.action;
        if (action === 'locate-source') {
            locateSourceRange(Number(actionButton.dataset.sourceStart), Number(actionButton.dataset.sourceEnd));
            return;
        }
        const handlers = {
            reload: () => window.location.reload(),
            'new-document': newDocument,
            'open-file': openFilePicker,
            'save-markdown': saveMarkdownFile,
            'clear-document': clearDocument,
            'load-formula-example': loadFormulaExample,
            'restore-draft': restorePendingDraft,
            'copy-rich': copyRichText,
            'download-word': () => downloadWord(),
            'rerun-export-check': () => openExportCheck(buildExportReport()),
            'run-export-anyway': () => downloadWord({ force: true }),
            'open-table': openTableTool,
            'run-ai-direct': runAIDirect,
            'close-tool-drawer': closeToolDrawer,
            'copy-table': copyTableMarkdown,
            'insert-table': insertTableMarkdown,
            'cancel-ai': cancelAIRequest,
            'copy-ai-result': copyAIResult,
            'apply-ai-result': applyAIResult,
            'open-settings-ai': () => openSettings('ai'),
            'open-settings': () => openSettings('interface'),
            'close-settings': () => closeDialog(dom.settingsDialog, 'cancel'),
            'reset-settings': resetSettings,
            'close-formula-inspector': () => toggleFormulaInspector(false),
            'undo-document': undoDocumentChange,
            'clear-status': clearStatusMessage,
            logout: logoutAccess
        };
        closeToolbarMoreMenu();
        if (handlers[action]) handlers[action]();
    }

    function closeToolbarMoreMenu() {
        if (dom.toolbarMoreMenu) dom.toolbarMoreMenu.open = false;
    }

    function checkDependencies() {
        const missing = [];
        if (!window.marked || typeof window.marked.parse !== 'function') missing.push('Marked.js');
        if (!window.DOMPurify || typeof window.DOMPurify.sanitize !== 'function') missing.push('DOMPurify');
        if (!window.katex || typeof window.katex.renderToString !== 'function') missing.push('KaTeX（公式会显示源码）');
        if (!window.Md2WordMath) missing.push('本地公式引擎');
        if (!window.Md2WordPreflight || typeof window.Md2WordPreflight.analyze !== 'function') missing.push('导出检查器');
        if (!window.docx) missing.push('docx（Word 导出不可用）');
        if (typeof window.saveAs !== 'function') missing.push('FileSaver（将使用浏览器下载降级）');

        if (missing.length) {
            dom.dependencyMessage.textContent = `未加载：${missing.join('、')}。请检查网络后刷新。`;
            dom.dependencyBanner.hidden = false;
        } else {
            dom.dependencyBanner.hidden = true;
        }
    }

    function getAccessConfig() {
        const config = window.MD2WORD_ACCESS;
        if (!config || !config.users || typeof config.users !== 'object') return FALLBACK_ACCESS;
        return { sessionKey: config.sessionKey || FALLBACK_ACCESS.sessionKey, users: config.users };
    }

    function bindAccessEvents() {
        if (!dom.passwordForm) return;
        dom.passwordForm.addEventListener('submit', verifyAccessPassword);
        dom.passwordToggle.addEventListener('click', toggleAccessPassword);
        dom.pasteShareCodeButton.addEventListener('click', pasteShareCode);
        dom.passwordInput.addEventListener('input', () => { dom.passwordError.hidden = true; });
    }

    function initializeAccessGate() {
        if (state.authReady) return;
        state.authReady = true;
        const config = getAccessConfig();
        let restored = null;
        try {
            const session = safeJsonParse(sessionStorage.getItem(config.sessionKey), null);
            if (session && session.password && config.users[session.password]) {
                restored = { password: session.password, ...config.users[session.password] };
            }
        } catch (_error) {
            restored = null;
        }
        if (restored) unlockApp(restored, false);
        else lockApp();
    }

    function lockApp() {
        document.body.classList.add('auth-locked');
        dom.app.setAttribute('aria-hidden', 'true');
        dom.passwordOverlay.hidden = false;
        dom.passwordOverlay.classList.remove('is-leaving');
        dom.passwordInput.value = '';
        dom.passwordInput.type = 'password';
        dom.passwordToggle.textContent = '👁️';
        dom.passwordToggle.setAttribute('aria-label', '显示密码');
        window.setTimeout(() => dom.passwordInput.focus(), 80);
    }

    function unlockApp(user, animate = true) {
        state.currentUser = user;
        updateUserStatus();
        dom.app.setAttribute('aria-hidden', 'false');
        document.body.classList.remove('auth-locked');

        if (animate) {
            dom.passwordOverlay.classList.add('is-leaving');
            window.setTimeout(() => {
                dom.passwordOverlay.hidden = true;
                dom.passwordOverlay.classList.remove('is-leaving');
                dom.markdownInput.focus();
            }, 360);
        } else {
            dom.passwordOverlay.hidden = true;
        }
    }

    function normalizeSharedPassword(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (/^PWD:/i.test(raw)) return raw.slice(4).split('|')[0].trim();
        return raw.split(/\r?\n/)[0].trim();
    }

    function verifyAccessPassword(event) {
        event.preventDefault();
        const password = normalizeSharedPassword(dom.passwordInput.value);
        const config = getAccessConfig();
        const user = config.users[password];
        if (!user) {
            showAccessError('密码不正确，请检查后重试。');
            dom.passwordInput.select();
            return;
        }
        try {
            sessionStorage.setItem(config.sessionKey, JSON.stringify({ password, authenticatedAt: Date.now() }));
        } catch (_error) {
            // 浏览器禁用会话存储时，本次页面仍可继续使用。
        }
        unlockApp({ password, ...user }, true);
    }

    function showAccessError(message) {
        dom.passwordError.textContent = message;
        dom.passwordError.hidden = false;
        dom.passwordError.style.animation = 'none';
        requestAnimationFrame(() => { dom.passwordError.style.animation = ''; });
    }

    function toggleAccessPassword() {
        const visible = dom.passwordInput.type === 'text';
        dom.passwordInput.type = visible ? 'password' : 'text';
        dom.passwordToggle.textContent = visible ? '👁️' : '🙈';
        dom.passwordToggle.setAttribute('aria-label', visible ? '显示密码' : '隐藏密码');
        dom.passwordInput.focus();
    }

    async function pasteShareCode() {
        let value = '';
        try {
            if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') value = await navigator.clipboard.readText();
        } catch (_error) {
            value = '';
        }
        if (!value) value = window.prompt('请粘贴分享码或访问密码：') || '';
        const password = normalizeSharedPassword(value);
        if (!password) {
            showAccessError('没有读取到有效的分享码。');
            return;
        }
        dom.passwordInput.value = password;
        dom.passwordInput.focus();
        dom.passwordInput.select();
        dom.passwordError.hidden = true;
    }

    function logoutAccess() {
        const config = getAccessConfig();
        try { sessionStorage.removeItem(config.sessionKey); } catch (_error) { /* ignore */ }
        state.currentUser = null;
        closeDialog(dom.settingsDialog, 'logout');
        closeToolDrawer();
        clearStatusMessage();
        lockApp();
    }

    function updateUserStatus() {
        const user = state.currentUser;
        if (!user || !dom.userStatus) return;
        dom.userIcon.textContent = user.icon || '👤';
        dom.userName.textContent = user.name || '用户';
        dom.userLevel.textContent = user.label || user.level || '个人版';
        const settingsCurrentUser = byId('settingsCurrentUser');
        if (settingsCurrentUser) settingsCurrentUser.textContent = `${user.icon || '👤'} ${user.name || '用户'} · ${user.label || user.level || '个人版'}`;
    }

    function loadSettings() {
        const stored = safeJsonParse(localStorageGet(STORAGE.settings), {});
        const legacyTheme = stored.theme === 'light' ? 'amber' : stored.theme === 'dark' ? 'noir' : stored.theme;
        const allowedThemes = new Set([...THEME_ORDER, 'system']);
        state.settings = {
            ...DEFAULT_SETTINGS,
            ...stored,
            theme: allowedThemes.has(legacyTheme) ? legacyTheme : DEFAULT_SETTINGS.theme,
            editorFontSize: clamp(Number(stored.editorFontSize ?? DEFAULT_SETTINGS.editorFontSize), 12, 24),
            restoreDraftOnStart: Boolean(stored.restoreDraftOnStart),
            wordFontSize: clamp(Number(stored.wordFontSize ?? DEFAULT_SETTINGS.wordFontSize), 9, 18),
            wordLineSpacing: clamp(Number(stored.wordLineSpacing ?? DEFAULT_SETTINGS.wordLineSpacing), 1, 2.5),
            wordMarginCm: clamp(Number(stored.wordMarginCm ?? DEFAULT_SETTINGS.wordMarginCm), 1, 4)
        };
    }

    function persistSettings() {
        localStorageSet(STORAGE.settings, JSON.stringify(state.settings));
    }

    function applySettings() {
        applyTheme();
        document.documentElement.style.setProperty('--editor-font-size', `${state.settings.editorFontSize}px`);
        dom.syncScrollToggle.checked = Boolean(state.settings.syncScroll);
        if (dom.settingsSyncScrollToggle) dom.settingsSyncScrollToggle.checked = Boolean(state.settings.syncScroll);
    }

    function applyTheme() {
        const prefersDark = state.themeMedia
            ? state.themeMedia.matches
            : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const resolved = state.settings.theme === 'system'
            ? (prefersDark ? 'noir' : 'amber')
            : (THEME_ORDER.includes(state.settings.theme) ? state.settings.theme : 'amber');
        document.documentElement.dataset.theme = resolved;
        if (dom.themeText) dom.themeText.textContent = THEME_LABELS[resolved] || '暖阳琥珀';
        const button = byId('themeButton');
        if (button) button.title = `当前：${THEME_LABELS[resolved] || resolved}，点击切换下一套主题`;
    }

    function toggleTheme() {
        const current = document.documentElement.dataset.theme || 'amber';
        const index = Math.max(0, THEME_ORDER.indexOf(current));
        state.settings.theme = THEME_ORDER[(index + 1) % THEME_ORDER.length];
        persistSettings();
        applyTheme();
        populateSettingsForm();
    }

    function openSettings(section = 'interface') {
        populateSettingsForm();
        activateSettingsTab(section);
        showDialog(dom.settingsDialog);
        requestAnimationFrame(() => {
            const active = dom.settingsNav && dom.settingsNav.querySelector('[aria-selected="true"]');
            if (active) active.focus({ preventScroll: true });
        });
    }

    function activateSettingsTab(section = 'interface', options = {}) {
        const tabs = queryAll('[data-settings-tab]', dom.settingsDialog);
        const panels = queryAll('[data-settings-panel]', dom.settingsDialog);
        const valid = tabs.some((tab) => tab.dataset.settingsTab === section) ? section : 'interface';
        tabs.forEach((tab) => {
            const active = tab.dataset.settingsTab === valid;
            tab.classList.toggle('active', active);
            tab.setAttribute('aria-selected', String(active));
            tab.tabIndex = active ? 0 : -1;
            if (active && options.focus) tab.focus();
        });
        panels.forEach((panel) => {
            const active = panel.dataset.settingsPanel === valid;
            panel.hidden = !active;
            panel.classList.toggle('active', active);
        });
    }

    function populateSettingsForm() {
        byId('themeSelect').value = state.settings.theme;
        byId('editorFontSize').value = state.settings.editorFontSize;
        byId('autosaveToggle').checked = Boolean(state.settings.autosave);
        byId('restoreDraftOnStartToggle').checked = Boolean(state.settings.restoreDraftOnStart);
        byId('repairLooseMathToggle').checked = Boolean(state.settings.repairLooseMath);
        byId('settingsSyncScrollToggle').checked = Boolean(state.settings.syncScroll);
        byId('wordFont').value = state.settings.wordFont;
        byId('wordFontSize').value = state.settings.wordFontSize;
        byId('wordLineSpacing').value = String(state.settings.wordLineSpacing);
        byId('wordMarginCm').value = state.settings.wordMarginCm;
        populateAISettings();
    }

    function bindSettingsDialog() {
        dom.settingsForm.addEventListener('submit', (event) => {
            event.preventDefault();
            if (event.submitter && event.submitter.value === 'cancel') {
                closeDialog(dom.settingsDialog, 'cancel');
                return;
            }
            state.settings = {
                ...state.settings,
                theme: byId('themeSelect').value,
                editorFontSize: clamp(Number(byId('editorFontSize').value), 12, 24),
                autosave: byId('autosaveToggle').checked,
                restoreDraftOnStart: byId('restoreDraftOnStartToggle').checked,
                repairLooseMath: byId('repairLooseMathToggle').checked,
                syncScroll: byId('settingsSyncScrollToggle').checked,
                wordFont: byId('wordFont').value,
                wordFontSize: clamp(Number(byId('wordFontSize').value), 9, 18),
                wordLineSpacing: clamp(Number(byId('wordLineSpacing').value), 1, 2.5),
                wordMarginCm: clamp(Number(byId('wordMarginCm').value), 1, 4)
            };
            state.aiConfig = collectAIConfigFromSettings();
            persistSettings();
            persistAIConfig();
            applySettings();
            updateSaveStatus();
            updateAIToolSummary();
            renderPreview({ immediate: true, force: true });
            closeDialog(dom.settingsDialog, 'save');
            setStatusMessage('设置已保存。', { duration: 2600 });
        });

        if (dom.settingsNav) {
            dom.settingsNav.addEventListener('keydown', (event) => {
                const tabs = queryAll('[data-settings-tab]', dom.settingsNav);
                const current = tabs.indexOf(document.activeElement);
                if (current < 0 || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                let next = current;
                if (event.key === 'Home') next = 0;
                else if (event.key === 'End') next = tabs.length - 1;
                else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
                else next = (current + 1) % tabs.length;
                activateSettingsTab(tabs[next].dataset.settingsTab, { focus: true });
            });
        }
    }

    function resetSettings() {
        state.settings = { ...DEFAULT_SETTINGS };
        state.aiConfig = { provider: 'custom', endpoint: '', model: '', key: '', mode: 'format', extraPrompt: '' };
        persistSettings();
        persistAIConfig();
        applySettings();
        populateSettingsForm();
        updateSaveStatus();
        updateAIToolSummary();
        renderPreview({ immediate: true, force: true });
        setStatusMessage('已恢复默认设置。', { duration: 2600 });
    }

    function showDialog(dialog) {
        if (!dialog) return;
        if (typeof dialog.showModal === 'function') {
            if (!dialog.open) dialog.showModal();
        } else {
            dialog.setAttribute('open', '');
        }
    }

    function closeDialog(dialog, value = '') {
        if (!dialog) return;
        if (typeof dialog.close === 'function' && dialog.open) dialog.close(value);
        else dialog.removeAttribute('open');
    }

    function getEmptyPreviewHtml() {
        const draftAction = state.pendingDraft && state.pendingDraft.content && state.pendingDraft.content.trim()
            ? `<button type="button" class="secondary-button" data-action="restore-draft">恢复本地草稿 · ${escapeHtml(formatDateTime(state.pendingDraft.updatedAt))}</button>`
            : '';
        return `
            <div class="preview-empty">
                <div class="preview-empty-card">
                    <div class="preview-empty-icon" aria-hidden="true">✦</div>
                    <h3>空白启动，按你的节奏开始</h3>
                    <p>粘贴 Markdown 后会立即预览。示例不会自动载入，本地草稿也只在你主动恢复时进入编辑器。</p>
                    <div class="preview-empty-actions">
                        <button type="button" class="secondary-button" data-action="open-file">打开 Markdown</button>
                        <button type="button" class="secondary-button" data-action="load-formula-example">加载公式示例</button>
                        ${draftAction}
                    </div>
                </div>
            </div>`;
    }

    function escapeHtml(value) {
        if (window.Md2WordMath && typeof window.Md2WordMath.escapeHtml === 'function') return window.Md2WordMath.escapeHtml(String(value));
        return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
    }

    function deriveDocumentName(fileName) {
        return sanitizeFileName(String(fileName || '未命名').replace(/\.(?:md|markdown|txt|docx)$/i, ''));
    }

    function syncDocumentNameInput() {
        if (!dom.documentNameInput) return;
        dom.documentNameInput.value = state.documentName || deriveDocumentName(state.currentFileName);
    }

    function setDocumentIdentity(fileName, options = {}) {
        const proposedName = options.documentName || deriveDocumentName(fileName);
        state.documentName = sanitizeFileName(proposedName);
        state.currentFileName = ensureExtension(state.documentName, '.md');
        if (options.origin) state.fileOrigin = options.origin;
        if (Object.prototype.hasOwnProperty.call(options, 'syncedAt')) state.fileSyncedAt = options.syncedAt;
        syncDocumentNameInput();
    }

    function onDocumentNameInput() {
        const value = String(dom.documentNameInput.value || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 80);
        state.documentName = value.trim() || '未命名';
        state.currentFileName = ensureExtension(state.documentName, '.md');
        state.dirty = true;
        state.draftDirty = true;
        updateSaveStatus();
        scheduleAutosave();
        updateExportReadiness();
    }

    function normalizeDocumentNameInput() {
        const normalized = sanitizeFileName(dom.documentNameInput ? dom.documentNameInput.value : state.documentName);
        const changed = normalized !== state.documentName;
        state.documentName = normalized;
        state.currentFileName = ensureExtension(normalized, '.md');
        syncDocumentNameInput();
        if (changed) {
            state.dirty = true;
            state.draftDirty = true;
            scheduleAutosave();
        }
        updateSaveStatus();
        return normalized;
    }

    function onEditorInput() {
        state.dirty = true;
        state.draftDirty = true;
        updateStats();
        updateSaveStatus();
        scheduleRender();
        scheduleAutosave();
    }

    function scheduleRender() {
        window.clearTimeout(state.renderTimer);
        const length = dom.markdownInput.value.length;
        const delay = length > 80000 ? 360 : length > 25000 ? 220 : 110;
        dom.renderStatus.textContent = '等待渲染…';
        state.renderTimer = window.setTimeout(() => renderPreview({ force: true }), delay);
    }

    function renderPreview(options = {}) {
        const { immediate = false } = options;
        if (!immediate && state.renderTimer) {
            window.clearTimeout(state.renderTimer);
            state.renderTimer = null;
        }

        const text = dom.markdownInput.value;
        const generation = ++state.renderGeneration;
        const startedAt = performance.now();
        const previousRatio = getScrollRatio(dom.preview);

        if (!text.trim()) {
            const emptyHtml = getEmptyPreviewHtml();
            dom.preview.innerHTML = emptyHtml;
            state.renderResult = {
                html: emptyHtml,
                mathCount: 0,
                errors: [],
                warnings: [],
                looseDelimiterFixes: 0,
                normalizedMarkdown: text,
                segments: []
            };
            updateMathStatus();
            buildOutline();
            updateExportReadiness();
            dom.renderStatus.textContent = '等待输入';
            return state.renderResult;
        }

        if (!window.Md2WordMath || !window.marked) {
            dom.preview.innerHTML = '<div class="math-error">核心解析依赖未加载，请刷新页面。</div>';
            dom.renderStatus.textContent = '解析器未加载';
            state.renderResult = null;
            updateMathStatus();
            updateExportReadiness();
            return null;
        }

        try {
            const sanitize = (html) => {
                if (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
                    return window.DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, ADD_ATTR: ['target', 'rel', 'data-math-index', 'data-math-start', 'data-math-end', 'data-math-source', 'data-math-display', 'role', 'tabindex'] });
                }
                return html;
            };

            const result = window.Md2WordMath.renderMarkdownWithMath(text, {
                marked: window.marked,
                katex: window.katex,
                sanitize
            }, { repairLooseDelimiters: state.settings.repairLooseMath });

            if (generation !== state.renderGeneration) return state.renderResult;
            dom.preview.innerHTML = result.html;
            state.renderResult = result;
            decoratePreviewLinks();
            buildOutline();
            updateMathStatus();
            updateExportReadiness();
            requestAnimationFrame(() => setScrollRatio(dom.preview, previousRatio));

            const elapsed = Math.max(1, Math.round(performance.now() - startedAt));
            dom.renderStatus.textContent = `已渲染 · ${elapsed} ms`;
            return result;
        } catch (error) {
            console.error('Markdown 渲染失败:', error);
            dom.preview.innerHTML = `<div class="math-error"><strong>预览解析失败</strong><code>${escapeHtml(error.message || String(error))}</code></div>`;
            dom.renderStatus.textContent = '渲染失败';
            state.renderResult = null;
            updateMathStatus();
            updateExportReadiness();
            toast('预览解析失败', error.message || String(error), 'error', 6500);
            return null;
        }
    }

    function decoratePreviewLinks() {
        queryAll('a', dom.preview).forEach((link) => {
            const href = link.getAttribute('href') || '';
            if (/^(https?:)?\/\//i.test(href)) {
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
            }
        });
    }

    function updateMathStatus() {
        const result = state.renderResult || { mathCount: 0, errors: [], warnings: [], looseDelimiterFixes: 0 };
        const count = Number(result.mathCount || 0);
        const errors = Array.isArray(result.errors) ? result.errors.length : 0;
        const fixes = Number(result.looseDelimiterFixes || 0);
        dom.mathStatus.classList.remove('ok', 'warning', 'error');
        dom.mathStatusText.textContent = `公式 ${count} · 渲染错误 ${errors} · 边界修复 ${fixes}`;
        if (errors) dom.mathStatus.classList.add('error');
        else if ((result.warnings && result.warnings.length) || fixes) dom.mathStatus.classList.add('warning');
        else if (count) dom.mathStatus.classList.add('ok');
        if (!dom.formulaInspector.hidden) renderFormulaInspector();
    }

    function toggleFormulaInspector(force) {
        const shouldOpen = typeof force === 'boolean' ? force : dom.formulaInspector.hidden;
        dom.formulaInspector.hidden = !shouldOpen;
        dom.mathStatus.setAttribute('aria-expanded', String(shouldOpen));
        if (shouldOpen) renderFormulaInspector();
    }

    function resolveSourceRange(item) {
        const source = dom.markdownInput.value;
        if (!item) return null;
        const start = Number(item.start);
        const end = Number(item.end);
        if (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end >= start && end <= source.length) {
            const slice = source.slice(start, end);
            if (!item.content || slice.includes(item.content) || slice === item.raw) return { start, end };
        }
        const raw = String(item.raw || '');
        if (raw) {
            const rawIndex = source.indexOf(raw);
            if (rawIndex >= 0) return { start: rawIndex, end: rawIndex + raw.length };
        }
        const content = String(item.content || '');
        if (content) {
            const contentIndex = source.indexOf(content);
            if (contentIndex >= 0) return { start: contentIndex, end: contentIndex + content.length };
        }
        return Number.isFinite(start) ? { start: clamp(start, 0, source.length), end: clamp(Number.isFinite(end) ? end : start, 0, source.length) } : null;
    }

    function sourceLineColumn(offset) {
        const source = dom.markdownInput.value;
        const safe = clamp(Number(offset) || 0, 0, source.length);
        const lines = source.slice(0, safe).split('\n');
        return { line: lines.length, column: lines[lines.length - 1].length + 1 };
    }

    function locateSourceRange(start, end) {
        const source = dom.markdownInput.value;
        if (!Number.isFinite(start)) return;
        const safeStart = clamp(Math.round(start), 0, source.length);
        const safeEnd = clamp(Number.isFinite(end) ? Math.round(end) : safeStart, safeStart, source.length);
        setView(getViewportMode() === 'mobile' ? 'editor' : 'split');
        requestAnimationFrame(() => {
            dom.markdownInput.focus({ preventScroll: true });
            dom.markdownInput.setSelectionRange(safeStart, safeEnd);
            const totalLines = Math.max(1, source.split('\n').length - 1);
            const beforeLines = source.slice(0, safeStart).split('\n').length - 1;
            const ratio = beforeLines / totalLines;
            const maxScroll = Math.max(0, dom.markdownInput.scrollHeight - dom.markdownInput.clientHeight);
            dom.markdownInput.scrollTop = Math.max(0, ratio * maxScroll - dom.markdownInput.clientHeight * 0.28);
            const editorPanel = byId('editorPanel');
            if (editorPanel) {
                editorPanel.classList.remove('source-pulse');
                void editorPanel.offsetWidth;
                editorPanel.classList.add('source-pulse');
                window.setTimeout(() => editorPanel.classList.remove('source-pulse'), 1200);
            }
            const location = sourceLineColumn(safeStart);
            setStatusMessage(`已定位到第 ${location.line} 行，第 ${location.column} 列。`, { duration: 3600 });
        });
    }

    function handlePreviewMathActivation(event) {
        if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
        const target = event.target.closest('.math-error[data-math-start]');
        if (!target || !dom.preview.contains(target)) return;
        if (event.type === 'keydown') event.preventDefault();
        locateSourceRange(Number(target.dataset.mathStart), Number(target.dataset.mathEnd));
    }

    function renderFormulaInspector() {
        const result = state.renderResult || {
            mathCount: 0, errors: [], warnings: [], looseDelimiterFixes: 0, segments: [], normalizedMarkdown: dom.markdownInput.value
        };
        const errors = result.errors || [];
        const warnings = result.warnings || [];
        const segments = result.segments || [];
        const items = [];

        errors.forEach((error) => {
            const segment = segments[error.index] || error;
            const range = resolveSourceRange(segment);
            const locate = range ? `<button type="button" class="diagnostic-locate" data-action="locate-source" data-source-start="${range.start}" data-source-end="${range.end}">定位源码</button>` : '';
            items.push(`<div class="diagnostic-item error"><div class="diagnostic-copy"><strong>公式 ${Number(error.index) + 1} 渲染失败</strong><div>${escapeHtml(error.message)}</div><code>${escapeHtml(error.content)}</code></div><div class="diagnostic-actions">${locate}</div></div>`);
        });
        warnings.forEach((warning) => {
            const start = Number(warning.start != null ? warning.start : warning.index);
            const end = Number(warning.end != null ? warning.end : start + String(warning.delimiter || '').length);
            const locate = Number.isFinite(start) ? `<button type="button" class="diagnostic-locate" data-action="locate-source" data-source-start="${start}" data-source-end="${end}">定位源码</button>` : '';
            items.push(`<div class="diagnostic-item warning"><div class="diagnostic-copy"><strong>发现未闭合边界</strong><div>边界 ${escapeHtml(warning.delimiter || '未知')}，请补齐结束标记。</div></div><div class="diagnostic-actions">${locate}</div></div>`);
        });
        if (!errors.length && !warnings.length && segments.length) {
            segments.slice(0, 8).forEach((segment) => {
                const range = resolveSourceRange(segment);
                const locate = range ? `<button type="button" class="diagnostic-locate" data-action="locate-source" data-source-start="${range.start}" data-source-end="${range.end}">定位</button>` : '';
                items.push(`<div class="diagnostic-item"><div class="diagnostic-copy"><strong>公式 ${segment.index + 1} · ${segment.display ? '独立公式' : '行内公式'}</strong><code>${escapeHtml(segment.content)}</code></div><div class="diagnostic-actions">${locate}</div></div>`);
            });
            if (segments.length > 8) items.push(`<div class="diagnostic-item muted">另有 ${segments.length - 8} 个公式未在列表中展开。</div>`);
        }
        if (!items.length) items.push('<div class="diagnostic-item muted">当前文档未检测到公式。</div>');

        dom.formulaInspectorContent.innerHTML = `
            <div class="diagnostics-summary">
                <div class="diagnostic-stat"><strong>${result.mathCount || 0}</strong><span>识别公式</span></div>
                <div class="diagnostic-stat"><strong>${errors.length}</strong><span>渲染错误</span></div>
                <div class="diagnostic-stat"><strong>${result.looseDelimiterFixes || 0}</strong><span>边界修复</span></div>
            </div>
            <div class="diagnostics-list">${items.join('')}</div>`;
        dom.applyMathNormalization.hidden = !(result.looseDelimiterFixes && result.normalizedMarkdown !== dom.markdownInput.value);
    }

    function applyMathNormalization() {
        if (!state.renderResult || !state.renderResult.normalizedMarkdown) return;
        takeDocumentSnapshot('公式边界标准化');
        dom.markdownInput.value = state.renderResult.normalizedMarkdown;
        state.dirty = true;
        onEditorInput();
        toggleFormulaInspector(false);
        setStatusMessage('已把松散 [ … ] 公式边界写回为标准 \\[ … \\]。', { undo: true, duration: 9000 });
    }

    function buildOutline() {
        const headings = queryAll('h1, h2, h3, h4, h5, h6', dom.preview);
        dom.outlineSelect.innerHTML = '';
        if (!headings.length) {
            dom.outlineSelect.add(new Option('无标题', ''));
            dom.outlineSelect.disabled = true;
            return;
        }
        dom.outlineSelect.disabled = false;
        dom.outlineSelect.add(new Option(`大纲（${headings.length}）`, ''));
        const used = new Set();
        headings.forEach((heading, index) => {
            const level = Number(heading.tagName.slice(1));
            const base = slugify(heading.textContent || `heading-${index + 1}`) || `heading-${index + 1}`;
            let id = base;
            let suffix = 2;
            while (used.has(id) || document.getElementById(id)) {
                id = `${base}-${suffix}`;
                suffix += 1;
            }
            used.add(id);
            heading.id = id;
            const indent = '\u00a0'.repeat(Math.max(0, level - 1) * 2);
            dom.outlineSelect.add(new Option(`${indent}${heading.textContent.trim()}`, id));
        });
    }

    function slugify(value) {
        return String(value).trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80);
    }

    function navigateOutline() {
        const id = dom.outlineSelect.value;
        if (!id) return;
        const target = dom.preview.querySelector(`#${cssEscape(id)}`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        dom.outlineSelect.value = '';
    }

    function cssEscape(value) {
        if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
        return String(value).replace(/([ #;.?+*~':"!^$[\]()=>|/@])/g, '\\$1');
    }

    function updateStats() {
        const text = dom.markdownInput.value;
        const chars = text.length;
        const lines = text ? text.split('\n').length : 1;
        const latinWords = (text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length;
        const cjkChars = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g) || []).length;
        const words = latinWords + cjkChars;
        const minutes = words ? Math.max(1, Math.ceil(words / 380)) : 0;
        dom.charCount.textContent = chars.toLocaleString();
        dom.wordCount.textContent = words.toLocaleString();
        dom.lineCount.textContent = lines.toLocaleString();
        dom.readTime.textContent = minutes.toLocaleString();
    }

    function prepareAutosave() {
        const payload = safeJsonParse(localStorageGet(STORAGE.autosave), null);
        if (!payload || typeof payload.content !== 'string' || !payload.content.trim()) {
            state.pendingDraft = null;
            return;
        }
        state.pendingDraft = payload;
        if (state.settings.restoreDraftOnStart) restorePendingDraft({ silent: true });
    }

    function scheduleAutosave() {
        window.clearTimeout(state.autosaveTimer);
        if (!state.settings.autosave) {
            updateSaveStatus();
            return;
        }
        state.draftDirty = true;
        updateSaveStatus();
        state.autosaveTimer = window.setTimeout(saveAutosave, 650);
    }

    function saveAutosave() {
        if (!state.settings.autosave) return;
        const content = dom.markdownInput.value;
        if (!content.trim()) {
            localStorageRemove(STORAGE.autosave)
            state.pendingDraft = null;
            state.draftDirty = false;
            state.lastDraftSavedAt = null;
            updateSaveStatus();
            return;
        }
        const payload = {
            content,
            fileName: state.currentFileName,
            documentName: state.documentName,
            updatedAt: Date.now(),
            fileDirty: state.dirty,
            fileOrigin: state.fileOrigin,
            fileSyncedAt: state.fileSyncedAt
        };
        try {
            if (!localStorageSet(STORAGE.autosave, JSON.stringify(payload))) throw new Error('localStorage unavailable');
            state.pendingDraft = payload;
            state.draftDirty = false;
            state.lastDraftSavedAt = payload.updatedAt;
            updateSaveStatus();
        } catch (error) {
            console.warn('自动保存失败:', error);
            state.draftDirty = true;
            updateSaveStatus();
            toast('自动保存失败', '浏览器本地空间可能已满。', 'error');
        }
    }

    function restorePendingDraft(options = {}) {
        const payload = state.pendingDraft || safeJsonParse(localStorageGet(STORAGE.autosave), null);
        if (!payload || typeof payload.content !== 'string' || !payload.content.trim()) {
            setStatusMessage('没有可恢复的本地草稿。', { duration: 2600 });
            return;
        }
        if (dom.markdownInput.value.trim()) takeDocumentSnapshot('恢复草稿前的内容');
        dom.markdownInput.value = payload.content;
        setDocumentIdentity(payload.fileName || '未命名.md', {
            documentName: payload.documentName,
            origin: payload.fileOrigin || 'draft',
            syncedAt: payload.fileSyncedAt || null
        });
        state.dirty = typeof payload.fileDirty === 'boolean' ? payload.fileDirty : true;
        state.draftDirty = false;
        state.lastDraftSavedAt = payload.updatedAt || null;
        state.pendingDraft = payload;
        updateStats();
        updateSaveStatus();
        renderPreview({ immediate: true, force: true });
        if (!options.silent) setStatusMessage(`已恢复浏览器草稿 · ${formatDateTime(payload.updatedAt)}`, { undo: Boolean(state.lastDestructiveSnapshot), duration: 8000 });
    }

    function updateSaveStatus() {
        const hasContent = Boolean(dom.markdownInput.value.trim());
        dom.saveDot.classList.remove('dirty', 'saved', 'disabled');

        if (!state.settings.autosave) {
            dom.saveStatus.textContent = '浏览器草稿：自动保存已关闭';
            dom.saveStatus.dataset.state = 'disabled';
            dom.saveDot.classList.add('disabled');
        } else if (!hasContent && state.pendingDraft && !state.settings.restoreDraftOnStart) {
            dom.saveStatus.textContent = `浏览器草稿：可恢复 ${formatTime(state.pendingDraft.updatedAt)}`;
            dom.saveStatus.dataset.state = 'recoverable';
            dom.saveDot.classList.add('saved');
        } else if (!hasContent) {
            dom.saveStatus.textContent = '浏览器草稿：空白文档';
            dom.saveStatus.dataset.state = 'idle';
        } else if (state.draftDirty) {
            dom.saveStatus.textContent = '浏览器草稿：等待自动保存…';
            dom.saveStatus.dataset.state = 'saving';
            dom.saveDot.classList.add('dirty');
        } else if (state.lastDraftSavedAt || (state.pendingDraft && state.pendingDraft.updatedAt)) {
            const savedAt = state.lastDraftSavedAt || state.pendingDraft.updatedAt;
            dom.saveStatus.textContent = `浏览器草稿：已保存 ${formatTime(savedAt)}`;
            dom.saveStatus.dataset.state = 'saved';
            dom.saveDot.classList.add('saved');
        } else {
            dom.saveStatus.textContent = '浏览器草稿：自动保存已启用';
            dom.saveStatus.dataset.state = 'idle';
        }

        if (!hasContent) {
            dom.fileSaveStatus.textContent = 'Markdown 文件：尚未下载';
            dom.fileSaveStatus.dataset.state = 'idle';
        } else if (state.dirty) {
            if (state.fileOrigin === 'opened') dom.fileSaveStatus.textContent = '源文件已打开 · 当前修改未下载';
            else if (state.fileOrigin === 'downloaded') dom.fileSaveStatus.textContent = 'Markdown 文件：下载后有新修改';
            else dom.fileSaveStatus.textContent = 'Markdown 文件：当前修改尚未下载';
            dom.fileSaveStatus.dataset.state = 'dirty';
        } else if (state.fileOrigin === 'opened') {
            dom.fileSaveStatus.textContent = '源文件：已打开（浏览器不会覆盖原文件）';
            dom.fileSaveStatus.dataset.state = 'opened';
        } else if (state.fileOrigin === 'downloaded' && state.fileSyncedAt) {
            dom.fileSaveStatus.textContent = `Markdown 文件：已下载 ${formatTime(state.fileSyncedAt)}`;
            dom.fileSaveStatus.dataset.state = 'saved';
        } else {
            dom.fileSaveStatus.textContent = 'Markdown 文件：尚未下载';
            dom.fileSaveStatus.dataset.state = 'idle';
        }
    }

    function formatTime(value) {
        try {
            return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value));
        } catch (_error) {
            return new Date(value).toLocaleTimeString();
        }
    }

    function formatDateTime(value) {
        try {
            return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
        } catch (_error) {
            return new Date(value).toLocaleString();
        }
    }

    function takeDocumentSnapshot(reason = '上一步') {
        state.lastDestructiveSnapshot = {
            content: dom.markdownInput.value,
            fileName: state.currentFileName,
            documentName: state.documentName,
            dirty: state.dirty,
            draftDirty: state.draftDirty,
            fileOrigin: state.fileOrigin,
            fileSyncedAt: state.fileSyncedAt,
            lastDraftSavedAt: state.lastDraftSavedAt,
            selectionStart: dom.markdownInput.selectionStart,
            selectionEnd: dom.markdownInput.selectionEnd,
            reason,
            createdAt: Date.now()
        };
    }

    function loadFormulaExample() {
        if (dom.markdownInput.value.trim()) takeDocumentSnapshot('加载示例前的内容');
        dom.markdownInput.value = FORMULA_EXAMPLE;
        setDocumentIdentity('公式示例.md', { origin: 'new', syncedAt: null });
        state.dirty = true;
        state.draftDirty = true;
        onEditorInput();
        dom.markdownInput.focus();
        setStatusMessage('已加载公式示例。', { undo: Boolean(state.lastDestructiveSnapshot), duration: 8000 });
    }

    function clearDocument() {
        if (!dom.markdownInput.value) {
            setStatusMessage('当前文档已经是空白。', { duration: 2200 });
            return;
        }
        takeDocumentSnapshot('清空前的内容');
        dom.markdownInput.value = '';
        setDocumentIdentity('未命名.md', { origin: 'new', syncedAt: null });
        state.dirty = false;
        state.draftDirty = false;
        state.lastDraftSavedAt = null;
        localStorageRemove(STORAGE.autosave)
        state.pendingDraft = null;
        updateStats();
        updateSaveStatus();
        renderPreview({ immediate: true, force: true });
        dom.markdownInput.focus();
        setStatusMessage('内容已清空。', { undo: true, duration: 9000 });
    }

    function newDocument() {
        if (dom.markdownInput.value.trim()) takeDocumentSnapshot('新建前的内容');
        dom.markdownInput.value = '';
        setDocumentIdentity('未命名.md', { origin: 'new', syncedAt: null });
        state.dirty = false;
        state.draftDirty = false;
        state.lastDraftSavedAt = null;
        localStorageRemove(STORAGE.autosave)
        state.pendingDraft = null;
        updateStats();
        updateSaveStatus();
        renderPreview({ immediate: true, force: true });
        dom.markdownInput.focus();
        setStatusMessage('已新建空白文档。', { undo: Boolean(state.lastDestructiveSnapshot), duration: 9000 });
    }

    function undoDocumentChange() {
        const snapshot = state.lastDestructiveSnapshot;
        if (!snapshot) return;
        dom.markdownInput.value = snapshot.content;
        setDocumentIdentity(snapshot.fileName || '未命名.md', {
            documentName: snapshot.documentName,
            origin: snapshot.fileOrigin || 'new',
            syncedAt: snapshot.fileSyncedAt || null
        });
        state.dirty = Boolean(snapshot.dirty);
        state.draftDirty = Boolean(snapshot.draftDirty);
        state.lastDraftSavedAt = snapshot.lastDraftSavedAt || null;
        updateStats();
        updateSaveStatus();
        renderPreview({ immediate: true, force: true });
        dom.markdownInput.focus();
        dom.markdownInput.setSelectionRange(snapshot.selectionStart || 0, snapshot.selectionEnd || 0);
        state.lastDestructiveSnapshot = null;
        scheduleAutosave();
        setStatusMessage(`已撤销：${snapshot.reason}。`, { duration: 3200 });
    }

    function applyEditorCommand(command) {
        const input = dom.markdownInput;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const selected = input.value.slice(start, end);
        const commands = {
            heading: () => prefixSelectedLines('## '),
            bold: () => wrapSelection('**', '**', '重点内容'),
            italic: () => wrapSelection('*', '*', '强调内容'),
            quote: () => prefixSelectedLines('> '),
            'unordered-list': () => prefixSelectedLines('- '),
            'ordered-list': () => prefixSelectedLines((_line, index) => `${index + 1}. `),
            code: () => selected.includes('\n') ? wrapSelection('```\n', '\n```', '代码') : wrapSelection('`', '`', '代码'),
            'inline-math': () => wrapSelection('\\(', '\\)', 'x_1'),
            'display-math': () => wrapSelection('\n\\[\n', '\n\\]\n', String.raw`\text{示例}_2`)
        };
        if (commands[command]) commands[command]();
    }

    function wrapSelection(before, after, placeholder) {
        const input = dom.markdownInput;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const selected = input.value.slice(start, end) || placeholder;
        input.setRangeText(`${before}${selected}${after}`, start, end, 'end');
        const selectionStart = start + before.length;
        input.setSelectionRange(selectionStart, selectionStart + selected.length);
        input.focus();
        onEditorInput();
    }

    function prefixSelectedLines(prefix) {
        const input = dom.markdownInput;
        const value = input.value;
        const selectionStart = input.selectionStart;
        const selectionEnd = input.selectionEnd;
        const blockStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
        let blockEnd = value.indexOf('\n', selectionEnd);
        if (blockEnd === -1) blockEnd = value.length;
        const block = value.slice(blockStart, blockEnd);
        const lines = block.split('\n');
        const transformed = lines.map((line, index) => `${typeof prefix === 'function' ? prefix(line, index) : prefix}${line}`).join('\n');
        input.setRangeText(transformed, blockStart, blockEnd, 'select');
        input.focus();
        onEditorInput();
    }

    function handleTabKey(event) {
        const input = dom.markdownInput;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        if (start === end && !event.shiftKey) {
            input.setRangeText('    ', start, end, 'end');
            onEditorInput();
            return;
        }
        const value = input.value;
        const blockStart = value.lastIndexOf('\n', start - 1) + 1;
        let blockEnd = value.indexOf('\n', end);
        if (blockEnd === -1) blockEnd = value.length;
        const block = value.slice(blockStart, blockEnd);
        const transformed = block.split('\n').map((line) => event.shiftKey ? line.replace(/^( {1,4}|\t)/, '') : `    ${line}`).join('\n');
        input.setRangeText(transformed, blockStart, blockEnd, 'select');
        onEditorInput();
    }

    function onEditorKeydown(event) {
        if (event.key === 'Tab') {
            event.preventDefault();
            handleTabKey(event);
        }
    }

    function onGlobalKeydown(event) {
        if (document.body.classList.contains('auth-locked')) return;
        if (event.key === 'Escape') {
            closeToolbarMoreMenu();
            return;
        }
        const modifier = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();
        if (modifier && key === 's') {
            event.preventDefault();
            saveMarkdownFile();
        } else if (modifier && key === 'o') {
            event.preventDefault();
            openFilePicker();
        } else if (modifier && key === 'd') {
            event.preventDefault();
            downloadWord();
        } else if (modifier && event.key === 'Enter') {
            event.preventDefault();
            copyRichText();
        } else if (modifier && key === 'b' && document.activeElement === dom.markdownInput) {
            event.preventDefault();
            applyEditorCommand('bold');
        } else if (modifier && key === 'i' && document.activeElement === dom.markdownInput) {
            event.preventDefault();
            applyEditorCommand('italic');
        } else if (modifier && key === '/') {
            event.preventDefault();
            openSettings('shortcuts');
        } else if (modifier && key === 'n') {
            event.preventDefault();
            newDocument();
        } else if (event.altKey && key === 'm') {
            event.preventDefault();
            applyEditorCommand('display-math');
        }
    }

    function openFilePicker() {
        dom.fileInput.value = '';
        dom.fileInput.click();
    }

    function onFileChosen(event) {
        const file = event.target.files && event.target.files[0];
        if (file) loadFile(file);
    }

    function loadFile(file) {
        const allowed = /\.(md|markdown|txt)$/i.test(file.name) || /^text\//i.test(file.type || '');
        if (!allowed) {
            toast('无法打开文件', '请选择 .md、.markdown 或 .txt 文件。', 'error');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast('文件过大', '当前前端版本将单文件限制为 10 MB。', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            if (dom.markdownInput.value.trim()) takeDocumentSnapshot('打开文件前的内容');
            dom.markdownInput.value = String(reader.result || '');
            setDocumentIdentity(file.name, { origin: 'opened', syncedAt: Date.now() });
            state.dirty = false;
            state.draftDirty = true;
            updateStats();
            renderPreview({ immediate: true, force: true });
            saveAutosave();
            updateSaveStatus();
            dom.markdownInput.focus();
            setStatusMessage(`已打开 ${file.name} · ${formatBytes(file.size)}`, { undo: Boolean(state.lastDestructiveSnapshot), duration: 7000 });
        };
        reader.onerror = () => toast('读取文件失败', reader.error ? reader.error.message : '未知错误', 'error');
        reader.readAsText(file, 'utf-8');
    }

    function formatBytes(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    }

    function bindDragAndDrop() {
        const target = dom.editorFrame;
        target.addEventListener('dragenter', (event) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            state.dragDepth += 1;
            dom.dropOverlay.classList.add('visible');
        });
        target.addEventListener('dragover', (event) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
        });
        target.addEventListener('dragleave', (event) => {
            if (!hasFiles(event)) return;
            state.dragDepth = Math.max(0, state.dragDepth - 1);
            if (!state.dragDepth) dom.dropOverlay.classList.remove('visible');
        });
        target.addEventListener('drop', (event) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            state.dragDepth = 0;
            dom.dropOverlay.classList.remove('visible');
            const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
            if (file) loadFile(file);
        });
    }

    function hasFiles(event) {
        return event.dataTransfer && Array.from(event.dataTransfer.types || []).includes('Files');
    }

    function saveMarkdownFile() {
        const text = dom.markdownInput.value;
        if (!text.trim()) {
            setStatusMessage('没有可保存的 Markdown 内容。', { tone: 'warning', duration: 3000 });
            return;
        }
        normalizeDocumentNameInput();
        const suggested = ensureExtension(sanitizeFileName(state.documentName), '.md');
        const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
        downloadBlob(blob, suggested);
        setDocumentIdentity(suggested, { origin: 'downloaded', syncedAt: Date.now() });
        state.dirty = false;
        state.draftDirty = true;
        saveAutosave();
        updateSaveStatus();
        setStatusMessage(`Markdown 已下载：${suggested}`, { duration: 3200 });
    }

    function downloadBlob(blob, fileName) {
        if (typeof window.saveAs === 'function') {
            window.saveAs(blob, fileName);
            return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function sanitizeFileName(value) {
        const cleaned = String(value || '').replace(/\.(md|markdown|txt|docx)$/i, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80);
        return cleaned || '未命名';
    }

    function ensureExtension(value, extension) {
        const base = String(value || '');
        return base.toLowerCase().endsWith(extension.toLowerCase()) ? base : `${base}${extension}`;
    }

    function extractTitle(markdown) {
        const heading = String(markdown || '').match(/^#\s+(.+)$/m);
        if (heading) return heading[1].replace(/[*_`~]/g, '').trim();
        return state.documentName || sanitizeFileName(state.currentFileName || '未命名');
    }

    function bindViewSwitch() {
        queryAll('#viewSwitch [data-view]').forEach((button) => {
            button.addEventListener('click', () => setView(button.dataset.view));
        });
    }

    function getViewportMode() {
        return window.innerWidth <= 680 ? 'mobile' : 'desktop';
    }

    function getViewStorageKey(mode = getViewportMode()) {
        return mode === 'mobile' ? STORAGE.viewMobile : STORAGE.viewDesktop;
    }

    function restoreView() {
        const mode = getViewportMode();
        const key = getViewStorageKey(mode);
        let stored = localStorageGet(key);
        if (!stored && mode === 'desktop') {
            const legacy = localStorageGet(STORAGE.viewLegacy);
            if (['editor', 'split', 'preview'].includes(legacy)) stored = legacy;
        }
        const fallback = mode === 'mobile' ? 'editor' : 'split';
        setView(['editor', 'split', 'preview'].includes(stored) ? stored : fallback, { persist: false });
    }

    function setView(view, options = {}) {
        if (!['editor', 'split', 'preview'].includes(view)) return;
        dom.workspace.dataset.view = view;
        queryAll('#viewSwitch [data-view]').forEach((button) => {
            const active = button.dataset.view === view;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        if (options.persist !== false) localStorageSet(getViewStorageKey(), view);
        if (view === 'preview') renderPreview({ immediate: true, force: true });
    }

    function readSplitPosition() {
        return safeJsonParse(localStorageGet(STORAGE.split), {});
    }

    function persistSplitPosition(partial) {
        localStorageSet(STORAGE.split, JSON.stringify({ ...readSplitPosition(), ...partial }));
    }

    function updateSplitterAria(value, mobile) {
        dom.splitter.setAttribute('aria-valuenow', String(Math.round(value)));
        dom.splitter.setAttribute('aria-orientation', mobile ? 'horizontal' : 'vertical');
    }

    function bindSplitter() {
        dom.splitter.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            const rect = dom.workspace.getBoundingClientRect();
            const mobile = window.innerWidth <= 820;
            state.splitterDrag = { pointerId: event.pointerId, rect, mobile };
            dom.splitter.setPointerCapture(event.pointerId);
            dom.splitter.classList.add('dragging');
        });
        dom.splitter.addEventListener('pointermove', (event) => {
            if (!state.splitterDrag || state.splitterDrag.pointerId !== event.pointerId) return;
            const { rect, mobile } = state.splitterDrag;
            if (mobile) {
                const percent = clamp(((event.clientY - rect.top) / rect.height) * 100, 28, 72);
                dom.workspace.style.gridTemplateRows = `${percent}% 9px minmax(300px, 1fr)`;
                persistSplitPosition({ mobilePercent: percent });
                updateSplitterAria(percent, true);
            } else {
                const percent = clamp(((event.clientX - rect.left) / rect.width) * 100, 24, 76);
                document.documentElement.style.setProperty('--editor-width', `${percent}%`);
                persistSplitPosition({ desktopPercent: percent });
                updateSplitterAria(percent, false);
            }
        });
        const finish = (event) => {
            if (!state.splitterDrag) return;
            if (event && state.splitterDrag.pointerId === event.pointerId && dom.splitter.hasPointerCapture(event.pointerId)) dom.splitter.releasePointerCapture(event.pointerId);
            state.splitterDrag = null;
            dom.splitter.classList.remove('dragging');
        };
        dom.splitter.addEventListener('pointerup', finish);
        dom.splitter.addEventListener('pointercancel', finish);
        dom.splitter.addEventListener('dblclick', resetSplitPosition);
        dom.splitter.addEventListener('keydown', (event) => {
            const stored = readSplitPosition();
            if (window.innerWidth <= 820) {
                if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
                event.preventDefault();
                const next = clamp(Number(stored.mobilePercent || 50) + (event.key === 'ArrowDown' ? 2 : -2), 28, 72);
                dom.workspace.style.gridTemplateRows = `${next}% 9px minmax(300px, 1fr)`;
                persistSplitPosition({ mobilePercent: next });
                updateSplitterAria(next, true);
            } else {
                if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
                event.preventDefault();
                const next = clamp(Number(stored.desktopPercent || 50) + (event.key === 'ArrowRight' ? 2 : -2), 24, 76);
                document.documentElement.style.setProperty('--editor-width', `${next}%`);
                persistSplitPosition({ desktopPercent: next });
                updateSplitterAria(next, false);
            }
        });
    }

    function resetSplitPosition() {
        document.documentElement.style.setProperty('--editor-width', '50%');
        dom.workspace.style.gridTemplateRows = window.innerWidth <= 820 ? '50% 9px minmax(300px, 1fr)' : '';
        persistSplitPosition({ desktopPercent: 50, mobilePercent: 50 });
        updateSplitterAria(50, window.innerWidth <= 820);
        setStatusMessage('分栏已恢复为均分。', { duration: 2400 });
    }

    function restoreSplitPosition() {
        const stored = readSplitPosition();
        const desktop = Number.isFinite(Number(stored.desktopPercent)) ? clamp(Number(stored.desktopPercent), 24, 76) : 50;
        document.documentElement.style.setProperty('--editor-width', `${desktop}%`);
        if (window.innerWidth <= 820) {
            const mobile = Number.isFinite(Number(stored.mobilePercent)) ? clamp(Number(stored.mobilePercent), 28, 72) : 50;
            dom.workspace.style.gridTemplateRows = `${mobile}% 9px minmax(300px, 1fr)`;
            updateSplitterAria(mobile, true);
        } else {
            updateSplitterAria(desktop, false);
        }
    }

    function sanitizeSplitPosition() {
        if (window.innerWidth > 820) {
            dom.workspace.style.gridTemplateRows = '';
            const stored = readSplitPosition();
            updateSplitterAria(clamp(Number(stored.desktopPercent || 50), 24, 76), false);
        } else {
            restoreSplitPosition();
        }
    }

    function getScrollRatio(element) {
        const max = element.scrollHeight - element.clientHeight;
        return max > 0 ? element.scrollTop / max : 0;
    }

    function setScrollRatio(element, ratio) {
        const max = element.scrollHeight - element.clientHeight;
        element.scrollTop = Math.max(0, max * clamp(Number(ratio) || 0, 0, 1));
    }

    function syncScrollFrom(source, target) {
        if (!state.settings.syncScroll || dom.workspace.dataset.view !== 'split' || state.syncLock) return;
        state.syncLock = true;
        setScrollRatio(target, getScrollRatio(source));
        requestAnimationFrame(() => { state.syncLock = false; });
    }

    async function copyRichText() {
        if (!dom.markdownInput.value.trim()) {
            setStatusMessage('没有可复制的内容。', { tone: 'warning', duration: 2800 });
            return;
        }
        renderPreview({ immediate: true, force: true });
        const clone = dom.preview.cloneNode(true);
        queryAll('[data-action]', clone).forEach((element) => element.remove());
        const html = clone.innerHTML;
        const plainClone = clone.cloneNode(true);
        queryAll('.math-node', plainClone).forEach((element) => {
            const latex = window.Md2WordMath.decodeMathSource(element);
            element.replaceWith(document.createTextNode(window.Md2WordMath.latexToPlainText(latex)));
        });
        const plain = plainClone.innerText || plainClone.textContent || '';

        try {
            if (navigator.clipboard && window.ClipboardItem) {
                const item = new ClipboardItem({
                    'text/html': new Blob([html], { type: 'text/html' }),
                    'text/plain': new Blob([plain], { type: 'text/plain' })
                });
                await navigator.clipboard.write([item]);
            } else {
                fallbackCopyRich(html);
            }
            setStatusMessage('富文本已复制，可直接粘贴到 Word、WPS 或邮件编辑器。', { duration: 3500 });
        } catch (error) {
            console.warn('富文本复制失败，降级为纯文本:', error);
            try {
                await navigator.clipboard.writeText(plain);
                setStatusMessage('浏览器未允许富文本，已复制纯文本。', { tone: 'warning', duration: 3800 });
            } catch (fallbackError) {
                console.error(fallbackError);
                toast('复制失败', '请检查浏览器剪贴板权限。', 'error');
            }
        }
    }

    function fallbackCopyRich(html) {
        const holder = document.createElement('div');
        holder.contentEditable = 'true';
        holder.style.position = 'fixed';
        holder.style.left = '-9999px';
        holder.innerHTML = html;
        document.body.appendChild(holder);
        const range = document.createRange();
        range.selectNodeContents(holder);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        const ok = document.execCommand('copy');
        selection.removeAllRanges();
        holder.remove();
        if (!ok) throw new Error('execCommand(copy) failed');
    }

    function openToolDrawer(panel, title) {
        state.activeTool = panel;
        dom.toolDrawer.hidden = false;
        dom.toolDrawerTitle.textContent = title;
        dom.tableToolPanel.hidden = panel !== 'table';
        dom.aiToolPanel.hidden = panel !== 'ai';
        dom.exportCheckToolPanel.hidden = panel !== 'export';
        requestAnimationFrame(() => dom.toolDrawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    }

    function closeToolDrawer() {
        state.activeTool = '';
        dom.toolDrawer.hidden = true;
        dom.tableToolPanel.hidden = true;
        dom.aiToolPanel.hidden = true;
        dom.exportCheckToolPanel.hidden = true;
    }

    function openTableTool() {
        updateTableOutput();
        openToolDrawer('table', '表格转换与插入');
        byId('tableInput').focus();
    }

    function updateTableOutput() {
        const input = byId('tableInput').value;
        state.tableMarkdown = convertTableInput(input);
        byId('tableOutput').textContent = state.tableMarkdown || '等待输入…';
    }

    function convertTableInput(input) {
        const text = String(input || '').trim();
        if (!text) return '';
        const lines = text.split(/\r?\n/).filter((line) => line.trim());
        if (!lines.length) return '';
        if (lines.length >= 2 && lines.some((line) => line.includes('|')) && /^\s*\|?\s*:?-{3,}/.test(lines[1])) return lines.join('\n');

        let rows;
        if (text.includes('\t')) rows = lines.map((line) => line.split('\t'));
        else if (lines.some((line) => line.includes(','))) rows = lines.map(parseCsvLine);
        else rows = lines.map((line) => line.trim().split(/\s{2,}/));

        const width = Math.max(...rows.map((row) => row.length));
        rows = rows.map((row) => Array.from({ length: width }, (_item, index) => (row[index] || '').trim()));
        if (!rows[0].some(Boolean)) rows[0] = rows[0].map((_cell, index) => `列 ${index + 1}`);
        const escapeCell = (cell) => String(cell).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
        const header = `| ${rows[0].map(escapeCell).join(' | ')} |`;
        const separator = `| ${rows[0].map(() => '---').join(' | ')} |`;
        const body = rows.slice(1).map((row) => `| ${row.map(escapeCell).join(' | ')} |`);
        return [header, separator, ...body].join('\n');
    }

    function parseCsvLine(line) {
        const cells = [];
        let current = '';
        let quoted = false;
        for (let i = 0; i < line.length; i += 1) {
            const char = line[i];
            if (char === '"') {
                if (quoted && line[i + 1] === '"') { current += '"'; i += 1; }
                else quoted = !quoted;
            } else if (char === ',' && !quoted) {
                cells.push(current);
                current = '';
            } else current += char;
        }
        cells.push(current);
        return cells;
    }

    async function copyTableMarkdown() {
        if (!state.tableMarkdown) {
            setStatusMessage('请先粘贴表格数据。', { tone: 'warning', duration: 2800 });
            return;
        }
        try {
            await navigator.clipboard.writeText(state.tableMarkdown);
            setStatusMessage('表格 Markdown 已复制。', { duration: 2600 });
        } catch (_error) {
            toast('复制失败', '请检查剪贴板权限。', 'error');
        }
    }

    function insertTableMarkdown() {
        if (!state.tableMarkdown) {
            setStatusMessage('请先粘贴表格数据。', { tone: 'warning', duration: 2800 });
            return;
        }
        const start = dom.markdownInput.selectionStart;
        const end = dom.markdownInput.selectionEnd;
        dom.markdownInput.setRangeText(`\n${state.tableMarkdown}\n`, start, end, 'end');
        closeToolDrawer();
        dom.markdownInput.focus();
        onEditorInput();
        setStatusMessage('表格已插入到光标位置。', { duration: 2600 });
    }

    function loadAIConfig() {
        const stored = safeJsonParse(localStorageGet(STORAGE.ai), null);
        state.aiConfig = {
            provider: stored && stored.provider ? stored.provider : 'custom',
            endpoint: stored && typeof stored.endpoint === 'string' ? stored.endpoint : '',
            model: stored && typeof stored.model === 'string' ? stored.model : '',
            key: stored && typeof stored.key === 'string' ? stored.key : '',
            mode: stored && stored.mode ? stored.mode : 'format',
            extraPrompt: stored && typeof stored.extraPrompt === 'string' ? stored.extraPrompt : ''
        };
    }

    function persistAIConfig() {
        localStorageSet(STORAGE.ai, JSON.stringify(state.aiConfig));
    }

    function populateAISettings() {
        const config = state.aiConfig || {};
        byId('aiProvider').value = config.provider || 'custom';
        byId('aiEndpoint').value = config.endpoint || '';
        byId('aiModel').value = config.model || '';
        byId('aiKey').value = config.key || '';
        byId('aiMode').value = config.mode || 'format';
        byId('aiExtraPrompt').value = config.extraPrompt || '';
    }

    function applyAIPreset() {
        const provider = byId('aiProvider').value;
        const preset = AI_PRESETS[provider] || AI_PRESETS.custom;
        if (provider !== 'custom') {
            byId('aiEndpoint').value = preset.endpoint;
            byId('aiModel').value = preset.model;
        }
    }

    function collectAIConfigFromSettings() {
        return {
            provider: byId('aiProvider').value,
            endpoint: byId('aiEndpoint').value.trim(),
            model: byId('aiModel').value.trim(),
            key: byId('aiKey').value.trim(),
            mode: byId('aiMode').value,
            extraPrompt: byId('aiExtraPrompt').value.trim()
        };
    }

    function updateAIToolSummary() {
        const config = state.aiConfig || {};
        const ready = Boolean(config.endpoint && config.model && config.key);
        byId('aiToolConfigSummary').textContent = ready
            ? `${AI_PROVIDER_LABELS[config.provider] || 'AI'} · ${config.model} · ${modeLabel(config.mode)}`
            : '尚未配置接口、模型或 API Key';
    }

    function modeLabel(mode) {
        return { format: '格式修复', polish: '格式与润色', structure: '结构优化' }[mode] || '格式修复';
    }

    function buildAIPrompt(mode, extraPrompt) {
        const modeInstruction = {
            format: '只修复 Markdown 语法、段落结构、列表、表格和 LaTeX 公式边界，不改写事实内容。',
            polish: '修复 Markdown 与 LaTeX 格式，并在不改变事实和专业术语的前提下润色语言。',
            structure: '在保持事实、数据、代码和公式不变的前提下，重组层级、改善表达并修复格式。'
        }[mode] || '';
        return [
            '你是 Markdown 文档修复器。',
            modeInstruction,
            '必须完整保留代码块、链接、数字、化学名称、实验条件和公式含义。',
            '所有独立 LaTeX 公式统一使用 \\[ ... \\] 或 $$ ... $$，行内公式使用 \\( ... \\) 或 $...$。',
            '不要在最终结果外添加解释，不要使用 ```markdown 包裹，直接返回可用 Markdown。',
            extraPrompt ? `附加要求：${extraPrompt}` : ''
        ].filter(Boolean).join('\n');
    }

    function getAITarget() {
        const input = dom.markdownInput;
        const hasSelection = input.selectionEnd > input.selectionStart;
        const start = hasSelection ? input.selectionStart : 0;
        const end = hasSelection ? input.selectionEnd : input.value.length;
        const original = input.value.slice(start, end);
        return { start, end, original, selection: hasSelection, forceApply: false };
    }

    async function runAIDirect() {
        if (state.aiAbortController) {
            setStatusMessage('AI 请求正在进行中。', { tone: 'warning', duration: 2600 });
            return;
        }
        const target = getAITarget();
        if (!target.original.trim()) {
            setStatusMessage('请先输入或选中需要修复的 Markdown。', { tone: 'warning', duration: 3000 });
            return;
        }
        const config = state.aiConfig || {};
        if (!config.endpoint || !config.model || !config.key) {
            openSettings('ai');
            setStatusMessage('请先在统一设置中完成 AI 接口、模型和 API Key 配置。', { tone: 'warning', duration: 5200 });
            return;
        }

        state.aiTarget = target;
        byId('aiToolSummary').textContent = target.selection
            ? `正在处理选中的 ${target.original.length.toLocaleString()} 个字符`
            : `正在处理整篇文档，共 ${target.original.length.toLocaleString()} 个字符`;
        byId('aiOriginal').value = target.original;
        byId('aiResult').value = '';
        dom.aiResultPanel.hidden = true;
        dom.aiConflict.hidden = true;
        dom.applyAiResultButton.textContent = '应用到编辑器';
        updateAIToolSummary();
        openToolDrawer('ai', 'AI 直接修复');
        state.aiAbortController = new AbortController();
        setAIProgress(true);
        const preset = AI_PRESETS[config.provider] || AI_PRESETS.custom;
        const systemPrompt = buildAIPrompt(config.mode, config.extraPrompt);

        try {
            let result;
            if (preset.type === 'gemini') result = await callGemini(config, systemPrompt, target.original, state.aiAbortController.signal);
            else result = await callOpenAICompatible(config, systemPrompt, target.original, state.aiAbortController.signal);
            result = cleanAIResult(result);
            if (!result.trim()) throw new Error('接口返回了空内容');
            byId('aiResult').value = result;
            dom.aiResultPanel.hidden = false;
            setStatusMessage('AI 修复完成，请在工具区检查后应用。', { duration: 4000 });
        } catch (error) {
            if (error.name === 'AbortError') setStatusMessage('AI 请求已取消。', { duration: 2600 });
            else {
                console.error('AI 修复失败:', error);
                toast('AI 修复失败', friendlyAIError(error), 'error', 6500);
            }
        } finally {
            state.aiAbortController = null;
            setAIProgress(false);
        }
    }

    async function callOpenAICompatible(config, systemPrompt, source, signal) {
        const response = await fetch(config.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.key}` },
            body: JSON.stringify({
                model: config.model,
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: source }],
                stream: false
            }),
            signal
        });
        const data = await parseResponseBody(response);
        if (!response.ok) throw new Error(extractAPIError(data, response.status));
        const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (Array.isArray(content)) return content.map((item) => item.text || '').join('');
        return String(content || '');
    }

    async function callGemini(config, systemPrompt, source, signal) {
        const endpoint = config.endpoint.replace(/\/$/, '');
        const url = endpoint.includes(':generateContent')
            ? endpoint
            : `${endpoint}/models/${encodeURIComponent(config.model)}:generateContent`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.key },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n以下是待处理 Markdown：\n\n${source}` }] }],
                generationConfig: { temperature: 0.2 }
            }),
            signal
        });
        const data = await parseResponseBody(response);
        if (!response.ok) throw new Error(extractAPIError(data, response.status));
        const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
        return Array.isArray(parts) ? parts.map((part) => part.text || '').join('') : '';
    }

    async function parseResponseBody(response) {
        const text = await response.text();
        try { return JSON.parse(text); } catch (_error) { return { raw: text }; }
    }

    function extractAPIError(data, status) {
        return (data && data.error && (data.error.message || data.error.msg)) || (data && data.message) || (data && data.raw) || `HTTP ${status}`;
    }

    function cleanAIResult(value) {
        let text = String(value || '').trim();
        const fenced = text.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
        if (fenced) text = fenced[1].trim();
        return text;
    }

    function friendlyAIError(error) {
        const message = error && error.message ? error.message : String(error);
        if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return '浏览器无法访问该接口。常见原因是跨域限制、网络代理或接口地址错误。';
        if (/401|unauthorized|invalid.*key/i.test(message)) return 'API Key 无效或没有该模型权限。';
        if (/429|rate.*limit|quota/i.test(message)) return '接口限流或额度不足，请稍后再试。';
        return message.slice(0, 320);
    }

    function setAIProgress(active) {
        dom.aiProgress.hidden = !active;
        queryAll('[data-action="run-ai-direct"]').forEach((button) => { button.disabled = active; });
    }

    function cancelAIRequest() {
        if (state.aiAbortController) state.aiAbortController.abort();
    }

    async function copyAIResult() {
        const value = byId('aiResult').value;
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            setStatusMessage('AI 修复结果已复制。', { duration: 2600 });
        } catch (_error) {
            toast('复制失败', '请检查剪贴板权限。', 'error');
        }
    }

    function applyAIResult() {
        const replacement = byId('aiResult').value;
        if (!replacement || !state.aiTarget) return;
        const current = dom.markdownInput.value.slice(state.aiTarget.start, state.aiTarget.end);
        if (current !== state.aiTarget.original && !state.aiTarget.forceApply) {
            state.aiTarget.forceApply = true;
            dom.aiConflict.hidden = false;
            dom.applyAiResultButton.textContent = '仍然覆盖原范围';
            return;
        }
        takeDocumentSnapshot('应用 AI 结果前的内容');
        dom.markdownInput.setRangeText(replacement, state.aiTarget.start, state.aiTarget.end, 'end');
        dom.markdownInput.focus();
        state.dirty = true;
        onEditorInput();
        closeToolDrawer();
        setStatusMessage('AI 结果已应用，请在预览中确认公式与结构。', { undo: true, duration: 9000 });
    }

    function buildExportReport() {
        const missingCore = [];
        if (!window.Md2WordMath || typeof window.Md2WordMath.renderMarkdownWithMath !== 'function') missingCore.push('公式与 Markdown 预处理引擎');
        if (!window.marked || typeof window.marked.parse !== 'function') missingCore.push('Marked.js');
        if (!window.Md2WordPreflight || typeof window.Md2WordPreflight.analyze !== 'function') missingCore.push('导出检查器');
        if (missingCore.length) {
            const issue = {
                id: 'preflight-unavailable', severity: 'error', type: 'dependency',
                title: '核心导出依赖未加载', message: `缺少：${missingCore.join('、')}。请检查网络并刷新页面。`,
                start: null, end: null, line: null, column: null, locatable: false
            };
            return Object.freeze({
                issues: Object.freeze([issue]), errors: Object.freeze([issue]), warnings: Object.freeze([]),
                errorCount: 1, warningCount: 0, total: 1, readiness: 'error', checkedAt: Date.now()
            });
        }
        return window.Md2WordPreflight.analyze(dom.markdownInput.value, state.renderResult);
    }

    function updateExportReadiness(report = null) {
        const next = report || buildExportReport();
        state.exportReport = next;
        if (!dom.downloadWordButton || state.exporting) return next;
        const hasContent = Boolean(dom.markdownInput.value.trim());
        const readiness = hasContent ? next.readiness : 'empty';
        dom.downloadWordButton.dataset.readiness = readiness;
        dom.downloadWordButton.classList.remove('export-ready', 'export-warning', 'export-error');
        dom.exportIssueBadge.hidden = true;
        dom.exportIssueBadge.textContent = '';
        dom.downloadWordIcon.textContent = '📄';
        dom.downloadWordLabel.textContent = '下载 Word';

        if (!hasContent) {
            dom.downloadWordButton.title = '请先输入内容，再导出 DOCX（Ctrl+D）';
        } else if (next.errorCount) {
            dom.downloadWordButton.classList.add('export-error');
            dom.downloadWordIcon.textContent = '⛔';
            dom.exportIssueBadge.textContent = `${next.errorCount} 错误`;
            dom.exportIssueBadge.hidden = false;
            dom.downloadWordButton.title = `导出前发现 ${next.errorCount} 个错误和 ${next.warningCount} 个提醒；点击查看`;
        } else if (next.warningCount) {
            dom.downloadWordButton.classList.add('export-warning');
            dom.downloadWordIcon.textContent = '⚠️';
            dom.exportIssueBadge.textContent = `${next.warningCount} 提醒`;
            dom.exportIssueBadge.hidden = false;
            dom.downloadWordButton.title = `导出前有 ${next.warningCount} 个提醒；点击查看`;
        } else {
            dom.downloadWordButton.classList.add('export-ready');
            dom.downloadWordButton.title = '文档检查通过，导出 DOCX（Ctrl+D）';
        }
        return next;
    }

    function openExportCheck(report = null) {
        const next = updateExportReadiness(report || buildExportReport());
        renderExportCheck(next);
        openToolDrawer('export', '导出前检查');
    }

    function renderExportCheck(report) {
        const issues = Array.isArray(report.issues) ? report.issues : [];
        dom.exportReadinessChip.className = 'export-readiness-chip';
        if (report.errorCount) {
            dom.exportReadinessChip.textContent = `${report.errorCount} 错误`;
            dom.exportReadinessChip.classList.add('error');
            dom.exportCheckSummary.textContent = `发现 ${report.errorCount} 个需要优先处理的问题`;
            dom.exportCheckDetail.textContent = `另有 ${report.warningCount} 个提醒。可定位修改，也可以确认后仍然导出。`;
        } else if (report.warningCount) {
            dom.exportReadinessChip.textContent = `${report.warningCount} 提醒`;
            dom.exportReadinessChip.classList.add('warning');
            dom.exportCheckSummary.textContent = '文档可以导出，但有兼容性提醒';
            dom.exportCheckDetail.textContent = '部分结果在 Word 中可能与网页预览不同。';
        } else {
            dom.exportReadinessChip.textContent = '检查通过';
            dom.exportReadinessChip.classList.add('ready');
            dom.exportCheckSummary.textContent = '文档可以导出';
            dom.exportCheckDetail.textContent = '未发现会明显影响 Word 结果的问题。';
        }

        if (!issues.length) {
            dom.exportCheckList.innerHTML = '<div class="export-check-empty">检查通过：公式边界、代码围栏、图片、表格和标题层级均未发现明显问题。</div>';
        } else {
            dom.exportCheckList.innerHTML = issues.map((issue) => {
                const location = issue.line ? `<span class="export-issue-location">第 ${issue.line} 行${issue.column ? ` · 第 ${issue.column} 列` : ''}</span>` : '';
                const locate = issue.locatable ? `<button type="button" class="diagnostic-locate" data-action="locate-source" data-source-start="${issue.start}" data-source-end="${issue.end}">定位修改</button>` : '';
                return `<article class="export-check-item ${issue.severity}"><div class="export-check-copy"><div class="export-check-title-row"><strong>${escapeHtml(issue.title)}</strong>${location}</div><p>${escapeHtml(issue.message)}</p></div><div class="diagnostic-actions">${locate}</div></article>`;
            }).join('');
        }
        dom.forceExportButton.textContent = issues.length ? '仍然导出' : '立即导出';
    }

    async function downloadWord(options = {}) {
        if (state.exporting) return;
        const markdown = dom.markdownInput.value.trim();
        if (!markdown) {
            setStatusMessage('没有可导出的内容。', { tone: 'warning', duration: 2800 });
            return;
        }
        if (!window.docx) {
            toast('Word 导出依赖未加载', '请检查网络并刷新页面。', 'error');
            return;
        }

        normalizeDocumentNameInput();
        dom.renderStatus.textContent = '正在执行导出前检查…';
        const renderResult = renderPreview({ immediate: true, force: true });
        await nextFrame();
        const report = updateExportReadiness(buildExportReport());
        if (!options.force && report.issues.length) {
            openExportCheck(report);
            setStatusMessage(`导出前发现 ${report.errorCount} 个错误、${report.warningCount} 个提醒。`, { tone: report.errorCount ? 'error' : 'warning', duration: 6000 });
            dom.renderStatus.textContent = '等待确认导出检查';
            return;
        }

        if (state.activeTool === 'export') closeToolDrawer();
        showExportProgress(true, '正在转换标题、列表、表格与公式…');
        try {
            const children = convertPreviewToDocxChildren(dom.preview);
            if (!children.length) throw new Error('没有可写入 Word 的内容');

            const title = state.documentName || extractTitle(markdown) || '未命名文档';
            const margin = cmToTwip(state.settings.wordMarginCm);
            const line = Math.round(240 * state.settings.wordLineSpacing);
            const fontSize = Math.round(state.settings.wordFontSize * 2);
            const doc = new window.docx.Document({
                creator: 'AI智能Markdown转Word转换器 · 融合体验版 v5.1.1',
                title,
                description: '由浏览器本地生成；公式转换为可编辑文本与上下标',
                styles: {
                    default: {
                        document: { run: { font: state.settings.wordFont, size: fontSize, color: '172033' }, paragraph: { spacing: { line, after: 120 } } }
                    },
                    paragraphStyles: createWordParagraphStyles(fontSize, line)
                },
                sections: [{
                    properties: { page: { margin: { top: margin, right: margin, bottom: margin, left: margin } } },
                    children
                }]
            });

            showExportProgress(true, '正在打包 DOCX 文件…');
            const blob = await window.docx.Packer.toBlob(doc);
            const fileName = `${sanitizeFileName(state.documentName || title)}.docx`;
            downloadBlob(blob, fileName);
            const mathCount = renderResult ? Number(renderResult.mathCount || 0) : 0;
            const mathErrors = renderResult && renderResult.errors ? renderResult.errors.length : 0;
            showExportProgress(false);
            setStatusMessage(`Word 已生成：${fileName} · 公式 ${mathCount} 个，渲染错误 ${mathErrors} 个。`, { duration: 6500 });
        } catch (error) {
            console.error('Word 导出失败:', error);
            showExportProgress(false);
            toast('Word 导出失败', error.message || String(error), 'error', 6500);
        }
    }

    function createWordParagraphStyles(baseSize, line) {
        const font = state.settings.wordFont;
        return [
            {
                id: 'Heading1', name: '标题 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                run: { font, size: Math.max(baseSize + 16, 32), bold: true, color: '111827' },
                paragraph: { spacing: { before: 280, after: 180, line } }
            },
            {
                id: 'Heading2', name: '标题 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                run: { font, size: Math.max(baseSize + 10, 28), bold: true, color: '172033' },
                paragraph: { spacing: { before: 240, after: 150, line } }
            },
            {
                id: 'Heading3', name: '标题 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                run: { font, size: Math.max(baseSize + 6, 24), bold: true, color: '172033' },
                paragraph: { spacing: { before: 200, after: 120, line } }
            },
            {
                id: 'Heading4', name: '标题 4', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                run: { font, size: Math.max(baseSize + 3, 22), bold: true, color: '172033' },
                paragraph: { spacing: { before: 160, after: 100, line } }
            }
        ];
    }

    function convertPreviewToDocxChildren(previewRoot) {
        const output = [];
        Array.from(previewRoot.children).forEach((element) => {
            output.push(...convertBlockElement(element, 0));
        });
        return output;
    }

    function convertBlockElement(element, listLevel = 0) {
        const d = window.docx;
        if (!(element instanceof Element)) return [];
        if (element.classList.contains('preview-empty')) return [];
        const tag = element.tagName.toLowerCase();

        if (/^h[1-6]$/.test(tag)) {
            const level = Number(tag.slice(1));
            return [new d.Paragraph({
                children: collectDocxRuns(element),
                style: level <= 4 ? `Heading${level}` : undefined,
                heading: level <= 6 && d.HeadingLevel ? d.HeadingLevel[`HEADING_${level}`] : undefined,
                spacing: { before: level === 1 ? 260 : 180, after: 120 }
            })];
        }

        if (tag === 'p') {
            const runs = collectDocxRuns(element);
            if (!runs.length) return [];
            const onlyDisplayMath = isDisplayMathParagraph(element);
            return [new d.Paragraph({
                children: runs,
                alignment: onlyDisplayMath && d.AlignmentType ? d.AlignmentType.CENTER : undefined,
                spacing: { after: onlyDisplayMath ? 180 : 120 }
            })];
        }

        if (tag === 'ul' || tag === 'ol') {
            const ordered = tag === 'ol';
            const blocks = [];
            Array.from(element.children).filter((child) => child.tagName && child.tagName.toLowerCase() === 'li').forEach((li, index) => {
                const clone = li.cloneNode(true);
                queryAll(':scope > ul, :scope > ol', clone).forEach((nested) => nested.remove());
                const prefix = ordered ? `${index + 1}. ` : '• ';
                blocks.push(new d.Paragraph({
                    children: [new d.TextRun({ text: prefix, bold: ordered }), ...collectDocxRuns(clone)],
                    indent: { left: 600 + listLevel * 420, hanging: 300 },
                    spacing: { after: 70 }
                }));
                Array.from(li.children).filter((child) => ['ul', 'ol'].includes(child.tagName.toLowerCase())).forEach((nested) => {
                    blocks.push(...convertBlockElement(nested, listLevel + 1));
                });
            });
            return blocks;
        }

        if (tag === 'blockquote') {
            const blocks = [];
            const children = Array.from(element.children);
            if (children.length) {
                children.forEach((child) => {
                    const converted = convertBlockElement(child, listLevel);
                    converted.forEach((paragraph) => {
                        if (paragraph && paragraph.options) {
                            // docx internals are not stable; leave existing object untouched.
                        }
                        blocks.push(paragraph);
                    });
                });
            } else {
                blocks.push(new d.Paragraph({ children: collectDocxRuns(element) }));
            }
            return blocks.map((paragraph, index) => {
                if (!(paragraph instanceof d.Paragraph)) return paragraph;
                // Rebuild a predictable quote paragraph from visible text for consistent borders.
                if (index === 0) {
                    return new d.Paragraph({
                        children: collectDocxRuns(element),
                        indent: { left: 480 },
                        border: {
                            left: { color: '2563EB', size: 18, style: d.BorderStyle.SINGLE, space: 8 }
                        },
                        shading: { type: d.ShadingType.CLEAR, fill: 'EEF4FF' },
                        spacing: { before: 80, after: 120 }
                    });
                }
                return paragraph;
            }).slice(0, 1);
        }

        if (tag === 'pre') {
            const code = element.textContent.replace(/\n$/, '');
            return code.split('\n').map((line, index) => new d.Paragraph({
                children: [new d.TextRun({
                    text: line || ' ',
                    font: 'Consolas',
                    size: Math.max(18, Math.round(state.settings.wordFontSize * 2 - 2)),
                    color: '1F2937'
                })],
                shading: { type: d.ShadingType.CLEAR, fill: 'F3F4F6' },
                border: index === 0 ? {
                    top: { color: 'D1D5DB', size: 4, style: d.BorderStyle.SINGLE },
                    left: { color: 'D1D5DB', size: 4, style: d.BorderStyle.SINGLE },
                    right: { color: 'D1D5DB', size: 4, style: d.BorderStyle.SINGLE }
                } : index === code.split('\n').length - 1 ? {
                    bottom: { color: 'D1D5DB', size: 4, style: d.BorderStyle.SINGLE },
                    left: { color: 'D1D5DB', size: 4, style: d.BorderStyle.SINGLE },
                    right: { color: 'D1D5DB', size: 4, style: d.BorderStyle.SINGLE }
                } : {
                    left: { color: 'D1D5DB', size: 4, style: d.BorderStyle.SINGLE },
                    right: { color: 'D1D5DB', size: 4, style: d.BorderStyle.SINGLE }
                },
                indent: { left: 240, right: 240 },
                spacing: { before: 0, after: index === code.split('\n').length - 1 ? 140 : 0 }
            }));
        }

        if (tag === 'table') {
            return [convertTableToDocx(element)];
        }

        if (tag === 'hr') {
            return [new d.Paragraph({
                text: '',
                border: { bottom: { color: 'C5CFDA', size: 6, style: d.BorderStyle.SINGLE, space: 8 } },
                spacing: { before: 120, after: 160 }
            })];
        }

        if (tag === 'img') {
            return [new d.Paragraph({ children: collectDocxRuns(element) })];
        }

        const nestedBlocks = [];
        Array.from(element.children).forEach((child) => nestedBlocks.push(...convertBlockElement(child, listLevel)));
        if (nestedBlocks.length) return nestedBlocks;
        const runs = collectDocxRuns(element);
        return runs.length ? [new d.Paragraph({ children: runs, spacing: { after: 120 } })] : [];
    }

    function isDisplayMathParagraph(element) {
        const meaningful = Array.from(element.childNodes).filter((node) => {
            if (node.nodeType === Node.TEXT_NODE) return Boolean(node.textContent.trim());
            return node.nodeType === Node.ELEMENT_NODE;
        });
        return meaningful.length === 1
            && meaningful[0].nodeType === Node.ELEMENT_NODE
            && meaningful[0].classList.contains('math-display');
    }

    function collectDocxRuns(root, inherited = {}) {
        const d = window.docx;
        const runs = [];

        function visit(node, style) {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;
                if (text) runs.push(new d.TextRun({ text, ...style }));
                return;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            const element = node;

            if (element.classList.contains('math-node')) {
                const latex = window.Md2WordMath.decodeMathSource(element);
                const mathSegments = window.Md2WordMath.latexToWordSegments(latex);
                mathSegments.forEach((segment) => {
                    runs.push(new d.TextRun({
                        text: segment.text,
                        font: state.settings.wordFont,
                        bold: Boolean(segment.bold),
                        italics: Boolean(segment.italics),
                        subScript: Boolean(segment.subScript),
                        superScript: Boolean(segment.superScript)
                    }));
                });
                return;
            }

            const tag = element.tagName.toLowerCase();
            if (tag === 'br') {
                runs.push(new d.TextRun({ text: '', break: 1, ...style }));
                return;
            }
            if (tag === 'img') {
                const imageRun = createImageRun(element);
                if (imageRun) runs.push(imageRun);
                else {
                    const alt = element.getAttribute('alt') || '图片';
                    const src = element.getAttribute('src') || '';
                    runs.push(new d.TextRun({ text: `[图片：${alt}${src ? ` — ${src}` : ''}]`, italics: true, color: '667085' }));
                }
                return;
            }
            if (tag === 'a') {
                const text = element.textContent || element.getAttribute('href') || '';
                const href = element.getAttribute('href') || '';
                runs.push(new d.TextRun({ text: href && href !== text ? `${text} (${href})` : text, color: '2563EB', underline: {} }));
                return;
            }

            const nextStyle = { ...style };
            if (tag === 'strong' || tag === 'b') nextStyle.bold = true;
            if (tag === 'em' || tag === 'i') nextStyle.italics = true;
            if (tag === 'u') nextStyle.underline = {};
            if (tag === 's' || tag === 'del') nextStyle.strike = true;
            if (tag === 'code') {
                nextStyle.font = 'Consolas';
                nextStyle.highlight = 'lightGray';
            }
            Array.from(element.childNodes).forEach((child) => visit(child, nextStyle));
        }

        visit(root, inherited);
        return mergeAdjacentTextRuns(runs);
    }

    function mergeAdjacentTextRuns(runs) {
        // Keep docx objects as-is. The function is a future extension point and
        // intentionally does not inspect private docx internals.
        return runs;
    }

    function createImageRun(element) {
        const d = window.docx;
        if (!d.ImageRun) return null;
        const src = element.getAttribute('src') || '';
        const match = src.match(/^data:image\/(png|jpe?g|gif);base64,(.+)$/i);
        if (!match) return null;
        try {
            const binary = atob(match[2]);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
            const width = clamp(Number(element.getAttribute('width') || element.naturalWidth || 520), 40, 560);
            const naturalWidth = Number(element.naturalWidth || width);
            const naturalHeight = Number(element.naturalHeight || width * 0.65);
            const height = Math.max(30, Math.round(width * (naturalHeight / Math.max(1, naturalWidth))));
            return new d.ImageRun({ data: bytes, transformation: { width, height } });
        } catch (_error) {
            return null;
        }
    }

    function convertTableToDocx(tableElement) {
        const d = window.docx;
        const rows = Array.from(tableElement.querySelectorAll('tr'));
        const docRows = rows.map((row, rowIndex) => {
            const cells = Array.from(row.children).filter((cell) => ['td', 'th'].includes(cell.tagName.toLowerCase()));
            return new d.TableRow({
                children: cells.map((cell) => {
                    const header = cell.tagName.toLowerCase() === 'th' || rowIndex === 0;
                    return new d.TableCell({
                        children: [new d.Paragraph({
                            children: collectDocxRuns(cell, header ? { bold: true, color: '1D4ED8' } : {}),
                            spacing: { after: 0 }
                        })],
                        shading: header ? { type: d.ShadingType.CLEAR, fill: 'EAF1FF' } : undefined,
                        margins: { top: 100, bottom: 100, left: 110, right: 110 }
                    });
                })
            });
        });
        return new d.Table({
            rows: docRows,
            width: { size: 100, type: d.WidthType.PERCENTAGE },
            borders: {
                top: { style: d.BorderStyle.SINGLE, size: 4, color: 'C5CFDA' },
                bottom: { style: d.BorderStyle.SINGLE, size: 4, color: 'C5CFDA' },
                left: { style: d.BorderStyle.SINGLE, size: 4, color: 'C5CFDA' },
                right: { style: d.BorderStyle.SINGLE, size: 4, color: 'C5CFDA' },
                insideHorizontal: { style: d.BorderStyle.SINGLE, size: 3, color: 'DBE2EA' },
                insideVertical: { style: d.BorderStyle.SINGLE, size: 3, color: 'DBE2EA' }
            }
        });
    }

    function cmToTwip(cm) {
        return Math.round(Number(cm || 2.54) * 566.929);
    }

    function showExportProgress(visible, text = '') {
        state.exporting = visible;
        dom.downloadWordButton.disabled = visible;
        dom.downloadWordButton.setAttribute('aria-busy', String(visible));
        if (visible) {
            dom.downloadWordIcon.textContent = '⏳';
            dom.downloadWordLabel.textContent = '生成中…';
            dom.exportIssueBadge.hidden = true;
        } else {
            updateExportReadiness();
        }
        if (text) dom.renderStatus.textContent = text;
        else if (!visible && dom.markdownInput.value.trim()) dom.renderStatus.textContent = '导出完成';
    }

    function setStatusMessage(message, options = {}) {
        const { tone = 'info', duration = 3600, undo = false } = options;
        window.clearTimeout(state.statusTimer);
        dom.statusMessage.hidden = false;
        dom.statusMessage.dataset.tone = tone;
        dom.statusMessageText.textContent = message;
        dom.undoDocumentButton.hidden = !undo || !state.lastDestructiveSnapshot;
        if (duration > 0) state.statusTimer = window.setTimeout(clearStatusMessage, duration);
    }

    function clearStatusMessage() {
        window.clearTimeout(state.statusTimer);
        state.statusTimer = null;
        dom.statusMessage.hidden = true;
        dom.statusMessageText.textContent = '';
        dom.undoDocumentButton.hidden = true;
        dom.statusMessage.dataset.tone = '';
    }

    function toast(title, message = '', type = 'info', duration = 3600) {
        if (type !== 'error') {
            setStatusMessage([title, message].filter(Boolean).join('：'), { tone: type, duration });
            return;
        }
        setStatusMessage([title, message].filter(Boolean).join('：'), { tone: 'error', duration });
        const element = document.createElement('div');
        element.className = 'toast toast-error';
        element.innerHTML = `
            <span class="toast-icon" aria-hidden="true">!</span>
            <div class="toast-content"><div class="toast-title"></div>${message ? '<div class="toast-message"></div>' : ''}</div>
            <button type="button" class="toast-close" aria-label="关闭">×</button>`;
        element.querySelector('.toast-title').textContent = title;
        const messageElement = element.querySelector('.toast-message');
        if (messageElement) messageElement.textContent = message;
        const close = () => {
            element.classList.remove('visible');
            window.setTimeout(() => element.remove(), 190);
        };
        element.querySelector('.toast-close').addEventListener('click', close);
        dom.toastRegion.appendChild(element);
        requestAnimationFrame(() => element.classList.add('visible'));
        window.setTimeout(close, duration);
    }

    window.addEventListener('DOMContentLoaded', initialize, { once: true });

    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        window.__MD2WORD__ = {
            renderPreview,
            convertTableInput,
            convertPreviewToDocxChildren,
            buildExportReport,
            updateExportReadiness,
            openExportCheck,
            locateSourceRange,
            activateSettingsTab,
            setView,
            getViewportMode,
            getState: () => ({ ...state }),
            resetSplitPosition,
            toggleFormulaInspector
        };
    }
})();
