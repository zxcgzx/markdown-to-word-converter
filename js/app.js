(function () {
    'use strict';

    const STORAGE = {
        settings: 'md2word.personal.settings.v3',
        autosave: 'md2word.personal.autosave.v3',
        split: 'md2word.personal.split.v3',
        ai: 'md2word.personal.ai.v3',
        viewLegacy: 'md2word.personal.view.v5',
        viewDesktop: 'md2word.personal.view.desktop.v5.1',
        viewMobile: 'md2word.personal.view.mobile.v5.1',
        rememberedAccess: 'md2word.fusion.remembered.v5.2'
    };

    const DEFAULT_SETTINGS = Object.freeze({
        theme: 'amber',
        editorFontSize: 15,
        uiDensity: 'standard',
        previewPerformanceMode: 'auto',
        autosave: true,
        restoreDraftOnStart: false,
        repairLooseMath: true,
        syncScroll: false,
        wordFont: '宋体',
        wordFontSize: 11,
        wordLineSpacing: 1.5,
        wordPaperSize: 'a4',
        wordOrientation: 'portrait',
        wordMarginCm: 2.54,
        wordMarginTopCm: 2.54,
        wordMarginRightCm: 2.54,
        wordMarginBottomCm: 2.54,
        wordMarginLeftCm: 2.54,
        embedRemoteImages: true,
        professionalStyle: 'business',
        coverEnabled: false,
        coverStyle: 'minimal',
        documentSubtitle: '',
        documentAuthor: '',
        documentOrganization: '',
        documentDate: '',
        documentVersion: 'V1.0',
        documentNumber: '',
        documentClassification: '',
        tocEnabled: false,
        tocTitle: '目录',
        tocDepth: 3,
        headingNumbering: 'none',
        headerEnabled: false,
        headerText: '{title}',
        footerText: '',
        firstPageDifferent: true,
        pageNumberEnabled: true,
        pageNumberFormat: 'current',
        pageNumberAlignment: 'center',
        wordHeadingFont: '',
        wordFirstLineChars: 0,
        wordParagraphAfterPt: 6,
        wordTableStyle: 'clean',
        repeatTableHeader: true,
        keepTableRows: true,
        captionMode: 'manual'
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
        rememberedKey: 'md2word.fusion.remembered.v5.2',
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
- 高置信度裸行内 TeX，例如 \`(C_\eta=1%C_{\text{curtail}})\`，会自动识别，并把数值百分号修正为 \`\%\`。

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
        viewportMode: '',
        authBusy: false,
        commandPaletteOpen: false,
        commandResults: [],
        commandActiveIndex: 0,
        commandPreviousFocus: null,
        focusMode: false,
        previewStale: false,
        activePerformanceMode: 'realtime',
        lastImageExport: null
    };

    const dom = {};

    function byId(id) {
        return document.getElementById(id);
    }

    function queryAll(selector, root = document) {
        return Array.from(root.querySelectorAll(selector));
    }

    function getFocusableElements(container) {
        if (!container) return [];
        return queryAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], summary, [tabindex]:not([tabindex="-1"])', container)
            .filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true' && element.getClientRects().length > 0);
    }

    function trapFocusWithin(event, container) {
        if (event.key !== 'Tab') return;
        const focusable = getFocusableElements(container);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
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
            a4Preview: byId('a4Preview'),
            previewPanel: byId('previewPanel'),
            previewRefreshButton: byId('previewRefreshButton'),
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
            assetToolPanel: byId('assetToolPanel'),
            templateToolPanel: byId('templateToolPanel'),
            professionalToolPanel: byId('professionalToolPanel'),
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
            passwordInputWrapper: byId('passwordInputWrapper'),
            passwordToggle: byId('passwordToggle'),
            pasteShareCodeButton: byId('pasteShareCodeButton'),
            passwordError: byId('passwordError'),
            passwordErrorText: byId('passwordErrorText'),
            capsLockHint: byId('capsLockHint'),
            rememberDeviceToggle: byId('rememberDeviceToggle'),
            shareCodePanel: byId('shareCodePanel'),
            shareCodeInput: byId('shareCodeInput'),
            shareCodeHint: byId('shareCodeHint'),
            importShareCodeButton: byId('importShareCodeButton'),
            authSubmitButton: byId('authSubmitButton'),
            authSubmitLabel: byId('authSubmitLabel'),
            authThemeButton: byId('authThemeButton'),
            authThemeText: byId('authThemeText'),
            commandPalette: byId('commandPalette'),
            commandPaletteInput: byId('commandPaletteInput'),
            commandPaletteList: byId('commandPaletteList'),
            commandPaletteCount: byId('commandPaletteCount'),
            commandPaletteEmpty: byId('commandPaletteEmpty'),
            commandButton: byId('commandButton'),
            focusModeButton: byId('focusModeButton'),
            focusModeExitButton: byId('focusModeExitButton'),
            settingsRememberedDeviceStatus: byId('settingsRememberedDeviceStatus'),
            clearRememberedAccessButton: byId('clearRememberedAccessButton'),
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
        if (dom.authThemeButton) dom.authThemeButton.addEventListener('click', toggleTheme);
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
        bindCommandPalette();
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
            'open-command-palette': openCommandPalette,
            'close-command-palette': closeCommandPalette,
            'toggle-focus-mode': toggleFocusMode,
            'exit-focus-mode': () => setFocusMode(false),
            'clear-remembered-access': clearRememberedAccess,
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
        if (!window.Md2WordAssets) missing.push('图片素材模块');
        if (!window.Md2WordPublishing) missing.push('A4 预览与模板模块');
        if (!window.Md2WordProfessional) missing.push('专业 Word 交付模块');
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
        return {
            sessionKey: config.sessionKey || FALLBACK_ACCESS.sessionKey,
            rememberedKey: config.rememberedKey || STORAGE.rememberedAccess,
            users: config.users
        };
    }

    function delay(ms) {
        return new Promise((resolve) => window.setTimeout(resolve, ms));
    }

    function readRememberedAccess() {
        const config = getAccessConfig();
        const key = config.rememberedKey || STORAGE.rememberedAccess;
        const raw = localStorageGet(key);
        const remembered = safeJsonParse(raw, null);
        if (!remembered || !remembered.password || !config.users[remembered.password]) {
            if (raw) localStorageRemove(key);
            return null;
        }
        return remembered;
    }

    function writeRememberedAccess(password) {
        const config = getAccessConfig();
        return localStorageSet(config.rememberedKey || STORAGE.rememberedAccess, JSON.stringify({
            password,
            rememberedAt: Date.now(),
            version: 1
        }));
    }

    function clearRememberedAccess(options = {}) {
        const config = getAccessConfig();
        localStorageRemove(config.rememberedKey || STORAGE.rememberedAccess);
        if (dom.rememberDeviceToggle) dom.rememberDeviceToggle.checked = false;
        updateRememberedDeviceStatus();
        if (!options.silent && !document.body.classList.contains('auth-locked')) {
            setStatusMessage('已清除本机自动进入状态。当前会话仍可继续使用。', { duration: 3200 });
        }
    }

    function updateRememberedDeviceStatus() {
        const remembered = readRememberedAccess();
        const config = getAccessConfig();
        const user = remembered && config.users[remembered.password];
        if (dom.settingsRememberedDeviceStatus) {
            dom.settingsRememberedDeviceStatus.textContent = user
                ? `已为 ${user.name || '当前身份'} 保存自动进入状态。`
                : '当前设备未保存自动进入状态。';
        }
        if (dom.clearRememberedAccessButton) {
            dom.clearRememberedAccessButton.disabled = !remembered;
            dom.clearRememberedAccessButton.setAttribute('aria-disabled', String(!remembered));
        }
        if (dom.rememberDeviceToggle && document.body.classList.contains('auth-locked')) {
            dom.rememberDeviceToggle.checked = Boolean(remembered);
        }
    }

    function bindAccessEvents() {
        if (!dom.passwordForm) return;
        dom.passwordForm.addEventListener('submit', verifyAccessPassword);
        dom.passwordToggle.addEventListener('click', toggleAccessPassword);
        dom.pasteShareCodeButton.addEventListener('click', toggleShareCodePanel);
        dom.importShareCodeButton.addEventListener('click', importShareCode);
        dom.shareCodeInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                importShareCode();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                toggleShareCodePanel(false);
                dom.passwordInput.focus();
            }
        });
        dom.passwordInput.addEventListener('input', clearAccessError);
        dom.passwordInput.addEventListener('keydown', updateCapsLockHint);
        dom.passwordInput.addEventListener('keyup', updateCapsLockHint);
        dom.passwordInput.addEventListener('blur', () => {
            if (dom.capsLockHint) dom.capsLockHint.hidden = true;
        });
        dom.passwordOverlay.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && dom.shareCodePanel && !dom.shareCodePanel.hidden) {
                event.preventDefault();
                toggleShareCodePanel(false);
                dom.passwordInput.focus();
                return;
            }
            trapFocusWithin(event, dom.passwordOverlay);
        });
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

        if (!restored) {
            const remembered = readRememberedAccess();
            if (remembered && config.users[remembered.password]) {
                restored = { password: remembered.password, ...config.users[remembered.password] };
                try {
                    sessionStorage.setItem(config.sessionKey, JSON.stringify({
                        password: remembered.password,
                        authenticatedAt: Date.now(),
                        source: 'remembered-device'
                    }));
                } catch (_error) {
                    // 浏览器禁用会话存储时，本次页面仍可继续使用。
                }
            }
        }

        updateRememberedDeviceStatus();
        if (restored) unlockApp(restored, false);
        else lockApp();
    }

    function setAuthSubmitState(nextState = 'idle') {
        state.authBusy = nextState === 'loading' || nextState === 'success';
        if (!dom.authSubmitButton) return;
        dom.authSubmitButton.dataset.state = nextState;
        dom.authSubmitButton.disabled = state.authBusy;
        dom.authSubmitButton.setAttribute('aria-busy', String(nextState === 'loading'));
        if (dom.authSubmitLabel) {
            dom.authSubmitLabel.textContent = nextState === 'loading'
                ? '正在验证…'
                : nextState === 'success'
                    ? '验证成功'
                    : '进入工作台';
        }
    }

    function lockApp() {
        closeCommandPalette({ restoreFocus: false });
        setFocusMode(false, { silent: true });
        document.body.classList.add('auth-locked');
        dom.app.setAttribute('aria-hidden', 'true');
        dom.passwordOverlay.hidden = false;
        dom.passwordOverlay.removeAttribute('aria-hidden');
        dom.passwordOverlay.classList.remove('is-leaving');
        dom.passwordInput.value = '';
        dom.passwordInput.type = 'password';
        dom.passwordToggle.dataset.visible = 'false';
        dom.passwordToggle.setAttribute('aria-label', '显示密码');
        dom.passwordToggle.setAttribute('title', '显示密码');
        dom.passwordInput.setAttribute('aria-invalid', 'false');
        if (dom.passwordInputWrapper) dom.passwordInputWrapper.classList.remove('is-invalid');
        if (dom.capsLockHint) dom.capsLockHint.hidden = true;
        if (dom.passwordError) dom.passwordError.hidden = true;
        toggleShareCodePanel(false);
        setAuthSubmitState('idle');
        updateRememberedDeviceStatus();
        window.setTimeout(() => dom.passwordInput.focus(), 100);
    }

    function unlockApp(user, animate = true) {
        state.currentUser = user;
        updateUserStatus();
        dom.app.setAttribute('aria-hidden', 'false');
        document.body.classList.remove('auth-locked');

        const complete = () => {
            dom.passwordOverlay.hidden = true;
            dom.passwordOverlay.setAttribute('aria-hidden', 'true');
            dom.passwordOverlay.classList.remove('is-leaving');
            setAuthSubmitState('idle');
            dom.markdownInput.focus();
        };

        if (animate) {
            dom.passwordOverlay.classList.add('is-leaving');
            window.setTimeout(complete, 330);
        } else {
            complete();
        }
    }

    function parseSharedAccess(value) {
        const raw = String(value || '').trim();
        if (!raw) return { ok: false, error: '请输入访问密码。' };
        const firstLine = raw.split(/\r?\n/).find((line) => line.trim())?.trim() || '';
        if (!/^PWD:/i.test(firstLine)) return { ok: true, password: firstLine };

        const parts = firstLine.slice(4).split('|').map((part) => part.trim());
        const password = parts[0] || '';
        const level = parts[1] || '';
        const expires = parts[2] || '';
        if (!password) return { ok: false, error: '分享码中没有访问密码。' };
        if (parts.length > 3) return { ok: false, error: '分享码格式无法识别，请检查分隔符。' };

        if (expires) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(expires)) {
                return { ok: false, error: '分享码有效期格式应为 YYYY-MM-DD。' };
            }
            const [year, month, day] = expires.split('-').map(Number);
            const deadline = new Date(year, month - 1, day, 23, 59, 59, 999);
            const validDate = deadline.getFullYear() === year
                && deadline.getMonth() === month - 1
                && deadline.getDate() === day;
            if (!validDate) return { ok: false, error: '分享码有效期无效。' };
            if (Date.now() > deadline.getTime()) return { ok: false, error: `该分享码已于 ${expires} 过期。` };
        }
        return { ok: true, password, level, expires };
    }

    function normalizeSharedPassword(value) {
        const parsed = parseSharedAccess(value);
        return parsed.ok ? parsed.password : '';
    }

    async function verifyAccessPassword(event) {
        event.preventDefault();
        if (state.authBusy) return;
        clearAccessError();
        const parsed = parseSharedAccess(dom.passwordInput.value);
        if (!parsed.ok) {
            showAccessError(parsed.error);
            dom.passwordInput.focus();
            return;
        }

        setAuthSubmitState('loading');
        await delay(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 190);

        const config = getAccessConfig();
        const user = config.users[parsed.password];
        if (!user) {
            setAuthSubmitState('idle');
            showAccessError('密码不正确，请重新检查。');
            dom.passwordInput.select();
            return;
        }
        if (parsed.level && parsed.level !== user.level && parsed.level !== user.label) {
            setAuthSubmitState('idle');
            showAccessError('分享码中的身份信息与访问密码不匹配。');
            return;
        }

        try {
            sessionStorage.setItem(config.sessionKey, JSON.stringify({
                password: parsed.password,
                authenticatedAt: Date.now(),
                source: 'password'
            }));
        } catch (_error) {
            // 浏览器禁用会话存储时，本次页面仍可继续使用。
        }

        const rememberRequested = Boolean(dom.rememberDeviceToggle && dom.rememberDeviceToggle.checked);
        const rememberSaved = rememberRequested ? writeRememberedAccess(parsed.password) : true;
        if (!rememberRequested) clearRememberedAccess({ silent: true });
        updateRememberedDeviceStatus();
        setAuthSubmitState('success');
        await delay(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 230);
        unlockApp({ password: parsed.password, ...user }, true);
        if (rememberRequested && !rememberSaved) {
            window.setTimeout(() => setStatusMessage('浏览器未允许保存自动进入状态，本次会话仍可正常使用。', { tone: 'warning', duration: 5200 }), 360);
        }
    }

    function clearAccessError() {
        if (dom.passwordError) dom.passwordError.hidden = true;
        if (dom.passwordInputWrapper) dom.passwordInputWrapper.classList.remove('is-invalid');
        if (dom.passwordInput) dom.passwordInput.setAttribute('aria-invalid', 'false');
    }

    function showAccessError(message) {
        setAuthSubmitState('idle');
        if (dom.passwordErrorText) dom.passwordErrorText.textContent = message;
        else dom.passwordError.textContent = message;
        dom.passwordError.hidden = false;
        if (dom.passwordInputWrapper) dom.passwordInputWrapper.classList.add('is-invalid');
        dom.passwordInput.setAttribute('aria-invalid', 'true');
        dom.passwordError.style.animation = 'none';
        requestAnimationFrame(() => { dom.passwordError.style.animation = ''; });
    }

    function toggleAccessPassword() {
        const visible = dom.passwordInput.type === 'text';
        dom.passwordInput.type = visible ? 'password' : 'text';
        dom.passwordToggle.dataset.visible = String(!visible);
        dom.passwordToggle.setAttribute('aria-label', visible ? '显示密码' : '隐藏密码');
        dom.passwordToggle.setAttribute('title', visible ? '显示密码' : '隐藏密码');
        dom.passwordInput.focus();
    }

    function updateCapsLockHint(event) {
        if (!dom.capsLockHint || typeof event.getModifierState !== 'function') return;
        dom.capsLockHint.hidden = !event.getModifierState('CapsLock');
    }

    function setShareCodeHint(message, stateName = '') {
        if (!dom.shareCodeHint || !dom.shareCodePanel) return;
        dom.shareCodeHint.textContent = message;
        dom.shareCodePanel.dataset.state = stateName;
    }

    async function toggleShareCodePanel(force) {
        if (!dom.shareCodePanel) return;
        const shouldOpen = typeof force === 'boolean' ? force : dom.shareCodePanel.hidden;
        dom.shareCodePanel.hidden = !shouldOpen;
        dom.pasteShareCodeButton.setAttribute('aria-expanded', String(shouldOpen));
        if (!shouldOpen) {
            dom.shareCodePanel.dataset.state = '';
            return;
        }

        setShareCodeHint('可直接粘贴密码；带日期的分享码会自动检查有效期。');
        let clipboardValue = '';
        try {
            if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
                clipboardValue = (await navigator.clipboard.readText()).trim();
            }
        } catch (_error) {
            clipboardValue = '';
        }
        if (clipboardValue) dom.shareCodeInput.value = clipboardValue;
        requestAnimationFrame(() => {
            dom.shareCodeInput.focus();
            if (clipboardValue) dom.shareCodeInput.select();
        });
    }

    function importShareCode() {
        const parsed = parseSharedAccess(dom.shareCodeInput.value);
        if (!parsed.ok) {
            setShareCodeHint(parsed.error, 'error');
            dom.shareCodeInput.focus();
            return;
        }
        const config = getAccessConfig();
        const user = config.users[parsed.password];
        if (!user) {
            setShareCodeHint('分享码中的访问密码无效。', 'error');
            dom.shareCodeInput.select();
            return;
        }
        if (parsed.level && parsed.level !== user.level && parsed.level !== user.label) {
            setShareCodeHint('分享码中的身份信息与访问密码不匹配。', 'error');
            return;
        }

        dom.passwordInput.value = parsed.password;
        clearAccessError();
        setShareCodeHint(`已导入 ${user.name || '本地身份'}，可直接进入工作台。`, 'success');
        window.setTimeout(() => {
            toggleShareCodePanel(false);
            dom.passwordInput.focus();
            dom.passwordInput.select();
        }, 360);
    }

    function logoutAccess() {
        const config = getAccessConfig();
        try { sessionStorage.removeItem(config.sessionKey); } catch (_error) { /* ignore */ }
        state.currentUser = null;
        closeCommandPalette({ restoreFocus: false });
        setFocusMode(false, { silent: true });
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
        updateRememberedDeviceStatus();
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
            uiDensity: ['compact', 'standard', 'spacious'].includes(stored.uiDensity) ? stored.uiDensity : DEFAULT_SETTINGS.uiDensity,
            previewPerformanceMode: ['auto', 'realtime', 'balanced', 'manual'].includes(stored.previewPerformanceMode) ? stored.previewPerformanceMode : DEFAULT_SETTINGS.previewPerformanceMode,
            restoreDraftOnStart: Boolean(stored.restoreDraftOnStart),
            wordFontSize: clamp(Number(stored.wordFontSize ?? DEFAULT_SETTINGS.wordFontSize), 9, 18),
            wordLineSpacing: clamp(Number(stored.wordLineSpacing ?? DEFAULT_SETTINGS.wordLineSpacing), 1, 2.5),
            wordPaperSize: ['a4', 'letter'].includes(stored.wordPaperSize) ? stored.wordPaperSize : DEFAULT_SETTINGS.wordPaperSize,
            wordOrientation: stored.wordOrientation === 'landscape' ? 'landscape' : DEFAULT_SETTINGS.wordOrientation,
            wordMarginCm: clamp(Number(stored.wordMarginCm ?? DEFAULT_SETTINGS.wordMarginCm), 0.8, 4.5),
            wordMarginTopCm: clamp(Number(stored.wordMarginTopCm ?? stored.wordMarginCm ?? DEFAULT_SETTINGS.wordMarginTopCm), 0.8, 4.5),
            wordMarginRightCm: clamp(Number(stored.wordMarginRightCm ?? stored.wordMarginCm ?? DEFAULT_SETTINGS.wordMarginRightCm), 0.8, 4.5),
            wordMarginBottomCm: clamp(Number(stored.wordMarginBottomCm ?? stored.wordMarginCm ?? DEFAULT_SETTINGS.wordMarginBottomCm), 0.8, 4.5),
            wordMarginLeftCm: clamp(Number(stored.wordMarginLeftCm ?? stored.wordMarginCm ?? DEFAULT_SETTINGS.wordMarginLeftCm), 0.8, 4.5),
            embedRemoteImages: stored.embedRemoteImages !== false
        };
        if (window.Md2WordProfessional && typeof window.Md2WordProfessional.normalizeSettings === 'function') {
            state.settings = { ...state.settings, ...window.Md2WordProfessional.normalizeSettings(state.settings) };
        }
    }

    function persistSettings() {
        localStorageSet(STORAGE.settings, JSON.stringify(state.settings));
    }

    function applySettings() {
        applyTheme();
        document.documentElement.style.setProperty('--editor-font-size', `${state.settings.editorFontSize}px`);
        document.documentElement.dataset.density = ['compact', 'standard', 'spacious'].includes(state.settings.uiDensity)
            ? state.settings.uiDensity
            : DEFAULT_SETTINGS.uiDensity;
        dom.syncScrollToggle.checked = Boolean(state.settings.syncScroll);
        if (dom.settingsSyncScrollToggle) dom.settingsSyncScrollToggle.checked = Boolean(state.settings.syncScroll);
        updatePerformanceIndicator();
        if (window.Md2WordProfessional && dom.preview) window.Md2WordProfessional.decoratePreview(dom.preview, state.settings);
        if (window.Md2WordPublishing) window.Md2WordPublishing.onPreviewRendered(dom.preview, state.settings);
        document.dispatchEvent(new CustomEvent('md2word:settings-updated', { detail: { settings: { ...state.settings } } }));
    }

    function applyTheme() {
        const prefersDark = state.themeMedia
            ? state.themeMedia.matches
            : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const resolved = state.settings.theme === 'system'
            ? (prefersDark ? 'noir' : 'amber')
            : (THEME_ORDER.includes(state.settings.theme) ? state.settings.theme : 'amber');
        document.documentElement.dataset.theme = resolved;
        const label = THEME_LABELS[resolved] || '暖阳琥珀';
        if (dom.themeText) dom.themeText.textContent = label;
        if (dom.authThemeText) dom.authThemeText.textContent = label;
        const button = byId('themeButton');
        if (button) button.title = `当前：${label}，点击切换下一套主题`;
        if (dom.authThemeButton) {
            dom.authThemeButton.title = `当前：${label}，点击切换下一套主题`;
            dom.authThemeButton.setAttribute('aria-label', `当前主题：${label}。切换下一套主题`);
        }
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
        if (state.focusMode) setFocusMode(false, { silent: true });
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
        byId('previewPerformanceMode').value = state.settings.previewPerformanceMode;
        const densityInput = dom.settingsForm.querySelector(`input[name="uiDensity"][value="${state.settings.uiDensity}"]`);
        if (densityInput) densityInput.checked = true;
        byId('autosaveToggle').checked = Boolean(state.settings.autosave);
        byId('restoreDraftOnStartToggle').checked = Boolean(state.settings.restoreDraftOnStart);
        byId('repairLooseMathToggle').checked = Boolean(state.settings.repairLooseMath);
        byId('settingsSyncScrollToggle').checked = Boolean(state.settings.syncScroll);
        byId('wordFont').value = state.settings.wordFont;
        byId('wordFontSize').value = state.settings.wordFontSize;
        byId('wordLineSpacing').value = String(state.settings.wordLineSpacing);
        byId('wordPaperSize').value = state.settings.wordPaperSize;
        byId('wordOrientation').value = state.settings.wordOrientation;
        byId('wordMarginTopCm').value = state.settings.wordMarginTopCm;
        byId('wordMarginRightCm').value = state.settings.wordMarginRightCm;
        byId('wordMarginBottomCm').value = state.settings.wordMarginBottomCm;
        byId('wordMarginLeftCm').value = state.settings.wordMarginLeftCm;
        byId('embedRemoteImagesToggle').checked = Boolean(state.settings.embedRemoteImages);
        const professional = window.Md2WordProfessional ? window.Md2WordProfessional.normalizeSettings(state.settings) : state.settings;
        const professionalFields = {
            professionalStyle: professional.professionalStyle, coverStyle: professional.coverStyle, documentSubtitle: professional.documentSubtitle,
            documentAuthor: professional.documentAuthor, documentOrganization: professional.documentOrganization, documentDate: professional.documentDate,
            documentVersion: professional.documentVersion, documentNumber: professional.documentNumber, documentClassification: professional.documentClassification,
            tocTitle: professional.tocTitle, tocDepth: String(professional.tocDepth), headingNumbering: professional.headingNumbering,
            headerText: professional.headerText, footerText: professional.footerText, pageNumberFormat: professional.pageNumberFormat,
            pageNumberAlignment: professional.pageNumberAlignment, wordHeadingFont: professional.wordHeadingFont,
            wordFirstLineChars: professional.wordFirstLineChars, wordParagraphAfterPt: professional.wordParagraphAfterPt,
            wordTableStyle: professional.wordTableStyle, captionMode: professional.captionMode
        };
        Object.entries(professionalFields).forEach(([id, value]) => { const field = byId(id); if (field) field.value = value; });
        const professionalChecks = { coverEnabled: professional.coverEnabled, tocEnabled: professional.tocEnabled, headerEnabled: professional.headerEnabled, firstPageDifferent: professional.firstPageDifferent, pageNumberEnabled: professional.pageNumberEnabled, repeatTableHeader: professional.repeatTableHeader, keepTableRows: professional.keepTableRows };
        Object.entries(professionalChecks).forEach(([id, value]) => { const field = byId(id); if (field) field.checked = Boolean(value); });
        populateAISettings();
        updateRememberedDeviceStatus();
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
                uiDensity: dom.settingsForm.querySelector('input[name="uiDensity"]:checked')?.value || DEFAULT_SETTINGS.uiDensity,
                previewPerformanceMode: byId('previewPerformanceMode').value,
                autosave: byId('autosaveToggle').checked,
                restoreDraftOnStart: byId('restoreDraftOnStartToggle').checked,
                repairLooseMath: byId('repairLooseMathToggle').checked,
                syncScroll: byId('settingsSyncScrollToggle').checked,
                wordFont: byId('wordFont').value,
                wordFontSize: clamp(Number(byId('wordFontSize').value), 9, 18),
                wordLineSpacing: clamp(Number(byId('wordLineSpacing').value), 1, 2.5),
                wordPaperSize: byId('wordPaperSize').value,
                wordOrientation: byId('wordOrientation').value,
                wordMarginTopCm: clamp(Number(byId('wordMarginTopCm').value), 0.8, 4.5),
                wordMarginRightCm: clamp(Number(byId('wordMarginRightCm').value), 0.8, 4.5),
                wordMarginBottomCm: clamp(Number(byId('wordMarginBottomCm').value), 0.8, 4.5),
                wordMarginLeftCm: clamp(Number(byId('wordMarginLeftCm').value), 0.8, 4.5),
                embedRemoteImages: byId('embedRemoteImagesToggle').checked,
                professionalStyle: byId('professionalStyle')?.value || DEFAULT_SETTINGS.professionalStyle,
                coverEnabled: Boolean(byId('coverEnabled')?.checked),
                coverStyle: byId('coverStyle')?.value || DEFAULT_SETTINGS.coverStyle,
                documentSubtitle: byId('documentSubtitle')?.value || '',
                documentAuthor: byId('documentAuthor')?.value || '',
                documentOrganization: byId('documentOrganization')?.value || '',
                documentDate: byId('documentDate')?.value || '',
                documentVersion: byId('documentVersion')?.value || DEFAULT_SETTINGS.documentVersion,
                documentNumber: byId('documentNumber')?.value || '',
                documentClassification: byId('documentClassification')?.value || '',
                tocEnabled: Boolean(byId('tocEnabled')?.checked),
                tocTitle: byId('tocTitle')?.value || DEFAULT_SETTINGS.tocTitle,
                tocDepth: clamp(Number(byId('tocDepth')?.value || DEFAULT_SETTINGS.tocDepth), 1, 6),
                headingNumbering: byId('headingNumbering')?.value || DEFAULT_SETTINGS.headingNumbering,
                headerEnabled: Boolean(byId('headerEnabled')?.checked),
                headerText: byId('headerText')?.value || '',
                footerText: byId('footerText')?.value || '',
                firstPageDifferent: Boolean(byId('firstPageDifferent')?.checked),
                pageNumberEnabled: Boolean(byId('pageNumberEnabled')?.checked),
                pageNumberFormat: byId('pageNumberFormat')?.value || DEFAULT_SETTINGS.pageNumberFormat,
                pageNumberAlignment: byId('pageNumberAlignment')?.value || DEFAULT_SETTINGS.pageNumberAlignment,
                wordHeadingFont: byId('wordHeadingFont')?.value || '',
                wordFirstLineChars: clamp(Number(byId('wordFirstLineChars')?.value || 0), 0, 4),
                wordParagraphAfterPt: clamp(Number(byId('wordParagraphAfterPt')?.value || 0), 0, 24),
                wordTableStyle: byId('wordTableStyle')?.value || DEFAULT_SETTINGS.wordTableStyle,
                repeatTableHeader: Boolean(byId('repeatTableHeader')?.checked),
                keepTableRows: Boolean(byId('keepTableRows')?.checked),
                captionMode: byId('captionMode')?.value || DEFAULT_SETTINGS.captionMode
            };
            if (window.Md2WordProfessional) state.settings = { ...state.settings, ...window.Md2WordProfessional.normalizeSettings(state.settings) };
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

        const professionalStyleField = byId('professionalStyle');
        if (professionalStyleField) professionalStyleField.addEventListener('change', () => {
            if (!window.Md2WordProfessional) return;
            const patch = window.Md2WordProfessional.getPresetPatch(professionalStyleField.value);
            Object.entries(patch).forEach(([key, value]) => {
                const field = byId(key);
                if (!field) return;
                if (field.type === 'checkbox') field.checked = Boolean(value);
                else field.value = value;
            });
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
                        <button type="button" class="secondary-button" data-action="open-document-center">打开文档中心</button>
                        <button type="button" class="secondary-button" data-action="open-templates">选择文档模板</button>
                        <button type="button" class="secondary-button" data-action="open-assets">添加图片</button>
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

    function getPreviewPerformancePolicy() {
        if (window.Md2WordPublishing && typeof window.Md2WordPublishing.getPerformancePolicy === 'function') {
            return window.Md2WordPublishing.getPerformancePolicy(state.settings.previewPerformanceMode, dom.markdownInput.value.length);
        }
        return { mode: 'realtime', autoRender: true, delay: 110, label: '实时预览' };
    }

    function updatePerformanceIndicator() {
        if (!dom.previewPanel) return;
        const policy = getPreviewPerformancePolicy();
        state.activePerformanceMode = policy.mode;
        dom.previewPanel.dataset.performance = policy.mode;
        dom.previewPanel.dataset.previewStale = String(Boolean(state.previewStale));
        if (dom.previewRefreshButton) dom.previewRefreshButton.dataset.stale = String(Boolean(state.previewStale));
    }

    function scheduleRender() {
        window.clearTimeout(state.renderTimer);
        const policy = getPreviewPerformancePolicy();
        state.activePerformanceMode = policy.mode;
        if (!policy.autoRender) {
            state.previewStale = true;
            dom.renderStatus.textContent = '预览已暂停 · 点击刷新';
            updatePerformanceIndicator();
            return;
        }
        state.previewStale = true;
        dom.renderStatus.textContent = policy.mode === 'balanced' ? '长文优化 · 等待更新…' : '等待渲染…';
        updatePerformanceIndicator();
        state.renderTimer = window.setTimeout(() => renderPreview({ force: true }), policy.delay);
    }

    function renderPreview(options = {}) {
        const { immediate = false } = options;
        if (!immediate && state.renderTimer) {
            window.clearTimeout(state.renderTimer);
            state.renderTimer = null;
        }

        const text = dom.markdownInput.value;
        state.previewStale = false;
        updatePerformanceIndicator();
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
                repairs: [],
                looseDelimiterFixes: 0,
                bareInlineFixes: 0,
                percentFixes: 0,
                automaticFixes: 0,
                normalizedMarkdown: text,
                segments: []
            };
            updateMathStatus();
            if (window.Md2WordProfessional) window.Md2WordProfessional.decoratePreview(dom.preview, state.settings);
            buildOutline();
            updateExportReadiness();
            if (window.Md2WordAssets) window.Md2WordAssets.onPreviewRendered(dom.preview);
            if (window.Md2WordPublishing) window.Md2WordPublishing.onPreviewRendered(dom.preview, state.settings);
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
                    return window.DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, ALLOW_UNKNOWN_PROTOCOLS: true, ADD_ATTR: ['target', 'rel', 'data-math-index', 'data-math-start', 'data-math-end', 'data-math-source', 'data-math-display', 'data-md2word-asset', 'data-width-mode', 'data-page-break', 'data-section-break', 'data-orientation', 'data-caption-kind', 'data-caption-title', 'data-caption-index', 'data-professional-cover', 'data-professional-toc', 'width', 'height', 'role', 'tabindex'] });
                }
                return html;
            };

            const result = window.Md2WordMath.renderMarkdownWithMath(text, {
                marked: window.marked,
                katex: window.katex,
                sanitize
            }, {
                repairLooseDelimiters: state.settings.repairLooseMath,
                repairBareInline: state.settings.repairLooseMath
            });

            if (generation !== state.renderGeneration) return state.renderResult;
            dom.preview.innerHTML = result.html;
            state.renderResult = result;
            decoratePreviewLinks();
            if (window.Md2WordProfessional) window.Md2WordProfessional.decoratePreview(dom.preview, state.settings);
            buildOutline();
            updateMathStatus();
            updateExportReadiness();
            if (window.Md2WordAssets) window.Md2WordAssets.onPreviewRendered(dom.preview);
            if (window.Md2WordPublishing) window.Md2WordPublishing.onPreviewRendered(dom.preview, state.settings);
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
        const result = state.renderResult || {
            mathCount: 0, errors: [], warnings: [], looseDelimiterFixes: 0,
            bareInlineFixes: 0, automaticFixes: 0
        };
        const count = Number(result.mathCount || 0);
        const errors = Array.isArray(result.errors) ? result.errors.length : 0;
        const fixes = Number(result.automaticFixes != null
            ? result.automaticFixes
            : Number(result.looseDelimiterFixes || 0) + Number(result.bareInlineFixes || 0));
        dom.mathStatus.classList.remove('ok', 'warning', 'error');
        dom.mathStatusText.textContent = `公式 ${count} · 渲染错误 ${errors} · 自动修复 ${fixes}`;
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
            mathCount: 0, errors: [], warnings: [], repairs: [], looseDelimiterFixes: 0,
            bareInlineFixes: 0, automaticFixes: 0, segments: [], normalizedMarkdown: dom.markdownInput.value
        };
        const errors = result.errors || [];
        const warnings = result.warnings || [];
        const repairs = result.repairs || [];
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
        repairs.forEach((repair, repairIndex) => {
            const range = resolveSourceRange(repair);
            const locate = range ? `<button type="button" class="diagnostic-locate" data-action="locate-source" data-source-start="${range.start}" data-source-end="${range.end}">定位源码</button>` : '';
            const count = Number(repair.percentFixes || 0);
            if (repair.type === 'bare-inline') {
                const percentNote = count ? `，同时修正 ${count} 个未转义百分号` : '';
                items.push(`<div class="diagnostic-item warning"><div class="diagnostic-copy"><strong>自动识别裸行内公式 ${repairIndex + 1}</strong><div>检测到未添加标准边界的 TeX 片段${percentNote}。预览与 Word 已按公式处理，可写回标准语法。</div><code>${escapeHtml(repair.raw || '')}</code></div><div class="diagnostic-actions">${locate}</div></div>`);
            } else if (repair.type === 'percent-escape') {
                items.push(`<div class="diagnostic-item warning"><div class="diagnostic-copy"><strong>自动修正公式百分号</strong><div>TeX 中 % 表示注释；检测到数值百分号后已临时转义为 <code>\\%</code>，可写回标准语法。</div><code>${escapeHtml(repair.raw || '')}</code></div><div class="diagnostic-actions">${locate}</div></div>`);
            }
        });
        if (!errors.length && !warnings.length && !repairs.length && segments.length) {
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
                <div class="diagnostic-stat"><strong>${result.automaticFixes || 0}</strong><span>自动修复</span></div>
            </div>
            <div class="diagnostics-list">${items.join('')}</div>`;
        dom.applyMathNormalization.hidden = !(result.automaticFixes && result.normalizedMarkdown !== dom.markdownInput.value);
    }

    function applyMathNormalization() {
        if (!state.renderResult || !state.renderResult.normalizedMarkdown) return;
        takeDocumentSnapshot('公式语法标准化');
        dom.markdownInput.value = state.renderResult.normalizedMarkdown;
        state.dirty = true;
        onEditorInput();
        toggleFormulaInspector(false);
        setStatusMessage('已将自动识别的公式写回标准边界，并修正可确认的百分号转义。', { undo: true, duration: 9000 });
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
        if (window.Md2WordPublishing && window.Md2WordPublishing.locateHeading(id)) { dom.outlineSelect.value = ''; return; }
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

    function getCommandDefinitions() {
        return [
            {
                id: 'open-file', icon: '↗', label: '打开 Markdown',
                description: '从本机选择 .md、.markdown 或 .txt 文件', keywords: '文件 打开 导入 open', shortcut: 'Ctrl O',
                run: openFilePicker
            },
            {
                id: 'new-document', icon: 'N', label: '新建空白文档',
                description: '清空工作区并保留一次可撤销快照', keywords: '新建 空白 文档 new', shortcut: 'Ctrl N',
                run: newDocument
            },
            {
                id: 'document-center', icon: 'D', label: '打开文档中心',
                description: '管理最近文档、版本历史、备份与恢复', keywords: '文档 中心 历史 版本 document workspace', shortcut: 'Ctrl Shift O',
                run: () => window.Md2WordWorkflow && window.Md2WordWorkflow.openDocumentCenter()
            },
            {
                id: 'save-markdown', icon: 'MD', label: '下载 Markdown',
                description: '使用当前文档名保存 .md 文件', keywords: '保存 下载 markdown md', shortcut: 'Ctrl S',
                run: saveMarkdownFile
            },
            {
                id: 'download-word', icon: 'W', label: '下载 Word',
                description: '运行导出检查并生成可编辑 DOCX', keywords: '导出 下载 word docx', shortcut: 'Ctrl D',
                run: () => downloadWord()
            },
            {
                id: 'copy-rich', icon: '⧉', label: '复制富文本',
                description: '复制当前预览中的格式化内容', keywords: '复制 富文本 粘贴 clipboard', shortcut: 'Ctrl Enter',
                run: copyRichText
            },
            {
                id: 'export-check', icon: '✓', label: '运行导出前检查',
                description: '检查公式、图片、表格和文档结构', keywords: '检查 预检 错误 公式 图片 表格', shortcut: '',
                run: () => openExportCheck(buildExportReport())
            },
            {
                id: 'view-editor', icon: 'E', label: '切换到编辑视图',
                description: '只显示 Markdown 编辑器', keywords: '视图 编辑 editor', shortcut: '',
                run: () => setView('editor')
            },
            {
                id: 'view-split', icon: 'S', label: '切换到分栏视图',
                description: '并排或上下显示编辑器与预览', keywords: '视图 分栏 split', shortcut: '',
                run: () => setView('split')
            },
            {
                id: 'view-preview', icon: 'P', label: '切换到预览视图',
                description: '只显示渲染后的文档', keywords: '视图 预览 preview', shortcut: '',
                run: () => setView('preview')
            },
            {
                id: 'inline-math', icon: 'ƒx', label: '插入行内公式',
                description: '在光标处插入 \\(...\\) 公式边界', keywords: '公式 数学 行内 inline math', shortcut: '',
                run: () => applyEditorCommand('inline-math')
            },
            {
                id: 'display-math', icon: 'Σ', label: '插入独立公式',
                description: '在光标处插入 \\[...\\] 公式块', keywords: '公式 数学 独立 display math', shortcut: 'Alt M',
                run: () => applyEditorCommand('display-math')
            },
            {
                id: 'table-tool', icon: '▦', label: '打开表格转换',
                description: '将 TSV、CSV 转换为 Markdown 表格', keywords: '表格 csv tsv table', shortcut: '',
                run: openTableTool
            },
            {
                id: 'image-assets', icon: '▧', label: '打开图片素材库',
                description: '粘贴、拖入或下载网络图片并嵌入 Word', keywords: '图片 素材 截图 image asset', shortcut: '',
                run: () => window.Md2WordAssets && window.Md2WordAssets.openAssetPanel()
            },
            {
                id: 'document-templates', icon: 'T', label: '选择文档模板',
                description: '应用报告、论文、实验记录或横向表格模板', keywords: '模板 报告 论文 template', shortcut: '',
                run: () => window.Md2WordPublishing && window.Md2WordPublishing.openTemplatePanel()
            },
            {
                id: 'professional-delivery', icon: 'D', label: '打开专业交付',
                description: '设置封面、目录、标题编号、页眉页脚和题注', keywords: '专业 交付 封面 目录 页眉 页脚 编号 word', shortcut: '',
                run: () => window.Md2WordProfessional && window.Md2WordProfessional.openPanel()
            },
            {
                id: 'section-landscape', icon: '↔', label: '下一节切换为横向',
                description: '让后续宽表格或图片使用横向页面', keywords: '分节 横向 landscape section', shortcut: 'Alt L',
                run: () => window.Md2WordProfessional && window.Md2WordProfessional.insertAtSelection(window.Md2WordProfessional.createSectionBreakMarker('landscape'))
            },
            {
                id: 'section-portrait', icon: '↕', label: '下一节恢复为纵向',
                description: '结束横向内容并恢复纵向页面', keywords: '分节 纵向 portrait section', shortcut: '',
                run: () => window.Md2WordProfessional && window.Md2WordProfessional.insertAtSelection(window.Md2WordProfessional.createSectionBreakMarker('portrait'))
            },
            {
                id: 'page-break', icon: '↡', label: '插入分页符',
                description: '在 Word 与 A4 预览中从新页面开始', keywords: '分页 页面 page break', shortcut: 'Alt P',
                run: () => window.Md2WordPublishing && window.Md2WordPublishing.insertPageBreak()
            },
            {
                id: 'a4-preview', icon: 'A4', label: '切换 A4 页面预览',
                description: '按当前 Word 纸张、方向、边距和字号预览分页', keywords: 'a4 页面 预览 word', shortcut: '',
                run: () => window.Md2WordPublishing && window.Md2WordPublishing.setPreviewMode('a4')
            },
            {
                id: 'ai-fix', icon: 'AI', label: '运行 AI 修复',
                description: '按当前 AI 设置处理选区或全文', keywords: 'ai 修复 格式 优化', shortcut: '',
                run: runAIDirect
            },
            {
                id: 'toggle-sync', icon: '↕', label: state.settings.syncScroll ? '关闭同步滚动' : '开启同步滚动',
                description: '按比例同步编辑器与预览滚动位置', keywords: '同步 滚动 sync scroll', shortcut: '',
                run: toggleSyncScrollFromCommand
            },
            {
                id: 'theme', icon: '◐', label: '切换颜色主题',
                description: `当前为 ${THEME_LABELS[document.documentElement.dataset.theme] || '暖阳琥珀'}`, keywords: '主题 颜色 theme 深色 黑金 极光', shortcut: '',
                run: toggleTheme
            },
            {
                id: 'focus', icon: '◫', label: state.focusMode ? '退出专注模式' : '进入专注模式',
                description: '隐藏非必要区域，聚焦编辑与预览', keywords: '专注 聚焦 focus', shortcut: 'Ctrl Shift F',
                run: toggleFocusMode
            },
            {
                id: 'settings', icon: '⚙', label: '打开统一设置',
                description: '调整界面、Word、专业交付、AI、快捷键和账户', keywords: '设置 偏好 settings', shortcut: 'Ctrl /',
                run: () => openSettings('interface')
            },
            {
                id: 'formula-example', icon: '∑', label: '加载公式示例',
                description: '载入化学结构与公式边界示例', keywords: '示例 公式 化学 example', shortcut: '',
                run: loadFormulaExample
            },
            {
                id: 'clear-document', icon: '×', label: '清空当前文档',
                description: '清空内容并保留一次撤销机会', keywords: '清空 删除 clear', shortcut: '',
                run: clearDocument
            }
        ];
    }

    function normalizeCommandQuery(value) {
        return String(value || '').trim().toLocaleLowerCase('zh-CN').replace(/\s+/g, ' ');
    }

    function scoreCommandMatch(command, query) {
        if (!query) return 0;
        const label = normalizeCommandQuery(command.label);
        const description = normalizeCommandQuery(command.description);
        const keywords = normalizeCommandQuery(command.keywords);
        const shortcut = normalizeCommandQuery(command.shortcut);
        const terms = query.split(' ').filter(Boolean);
        const haystack = `${label} ${description} ${keywords} ${shortcut}`;
        if (!terms.every((term) => haystack.includes(term))) return -1;

        let score = 0;
        if (label === query) score += 1200;
        else if (label.startsWith(query)) score += 900;
        else if (label.includes(query)) score += 700;
        terms.forEach((term) => {
            if (label.split(' ').includes(term)) score += 260;
            else if (label.includes(term)) score += 180;
            if (keywords.split(' ').includes(term)) score += 150;
            else if (keywords.includes(term)) score += 90;
            if (description.includes(term)) score += 35;
            if (shortcut.includes(term)) score += 20;
        });
        return score;
    }

    function renderCommandPalette(query = '') {
        if (!dom.commandPaletteList) return;
        const normalized = normalizeCommandQuery(query);
        const commands = getCommandDefinitions();
        state.commandResults = normalized
            ? commands
                .map((command, index) => ({ command, index, score: scoreCommandMatch(command, normalized) }))
                .filter((entry) => entry.score >= 0)
                .sort((a, b) => b.score - a.score || a.index - b.index)
                .map((entry) => entry.command)
            : commands;
        state.commandActiveIndex = clamp(state.commandActiveIndex, 0, Math.max(0, state.commandResults.length - 1));

        dom.commandPaletteList.innerHTML = state.commandResults.map((command, index) => `
            <button type="button" class="command-item" id="commandOption-${escapeHtml(command.id)}" role="option"
                aria-selected="${index === state.commandActiveIndex}" data-palette-command="${escapeHtml(command.id)}">
                <span class="command-item-icon" aria-hidden="true">${escapeHtml(command.icon)}</span>
                <span class="command-item-copy">
                    <span class="command-item-label">${escapeHtml(command.label)}</span>
                    <span class="command-item-description">${escapeHtml(command.description)}</span>
                </span>
                ${command.shortcut ? `<span class="command-item-shortcut">${escapeHtml(command.shortcut)}</span>` : '<span></span>'}
            </button>`).join('');
        dom.commandPaletteCount.textContent = `${state.commandResults.length} 项`;
        dom.commandPaletteEmpty.hidden = state.commandResults.length > 0;
        dom.commandPaletteList.hidden = state.commandResults.length === 0;
        updateCommandPaletteActive({ scroll: false });
    }

    function updateCommandPaletteActive(options = {}) {
        const items = queryAll('.command-item', dom.commandPaletteList);
        items.forEach((item, index) => item.setAttribute('aria-selected', String(index === state.commandActiveIndex)));
        const active = items[state.commandActiveIndex];
        if (active) {
            dom.commandPaletteInput.setAttribute('aria-activedescendant', active.id);
            if (options.scroll !== false) active.scrollIntoView({ block: 'nearest' });
        } else {
            dom.commandPaletteInput.removeAttribute('aria-activedescendant');
        }
    }

    function bindCommandPalette() {
        if (!dom.commandPalette || !dom.commandPaletteInput || !dom.commandPaletteList) return;
        dom.commandPalette.addEventListener('keydown', (event) => trapFocusWithin(event, dom.commandPalette));
        dom.commandPaletteInput.addEventListener('input', () => {
            state.commandActiveIndex = 0;
            renderCommandPalette(dom.commandPaletteInput.value);
        });
        dom.commandPaletteInput.addEventListener('keydown', (event) => {
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', 'Escape'].includes(event.key)) return;
            event.preventDefault();
            event.stopPropagation();
            if (event.key === 'Escape') {
                closeCommandPalette();
                return;
            }
            if (!state.commandResults.length) return;
            if (event.key === 'ArrowDown') state.commandActiveIndex = (state.commandActiveIndex + 1) % state.commandResults.length;
            else if (event.key === 'ArrowUp') state.commandActiveIndex = (state.commandActiveIndex - 1 + state.commandResults.length) % state.commandResults.length;
            else if (event.key === 'Home') state.commandActiveIndex = 0;
            else if (event.key === 'End') state.commandActiveIndex = state.commandResults.length - 1;
            else if (event.key === 'Enter') {
                executePaletteCommand(state.commandResults[state.commandActiveIndex].id);
                return;
            }
            updateCommandPaletteActive();
        });
        dom.commandPaletteList.addEventListener('mousemove', (event) => {
            const item = event.target.closest('[data-palette-command]');
            if (!item) return;
            const index = state.commandResults.findIndex((command) => command.id === item.dataset.paletteCommand);
            if (index >= 0 && index !== state.commandActiveIndex) {
                state.commandActiveIndex = index;
                updateCommandPaletteActive({ scroll: false });
            }
        });
        dom.commandPaletteList.addEventListener('click', (event) => {
            const item = event.target.closest('[data-palette-command]');
            if (!item) return;
            executePaletteCommand(item.dataset.paletteCommand);
        });
    }

    function openCommandPalette() {
        if (document.body.classList.contains('auth-locked') || !dom.commandPalette) return;
        closeToolbarMoreMenu();
        state.commandPreviousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        state.commandPaletteOpen = true;
        state.commandActiveIndex = 0;
        dom.commandPalette.hidden = false;
        dom.commandPalette.setAttribute('aria-hidden', 'false');
        document.body.classList.add('command-palette-open');
        dom.commandPaletteInput.value = '';
        renderCommandPalette('');
        requestAnimationFrame(() => dom.commandPaletteInput.focus({ preventScroll: true }));
    }

    function closeCommandPalette(options = {}) {
        if (!dom.commandPalette || dom.commandPalette.hidden) return;
        const previous = state.commandPreviousFocus;
        state.commandPaletteOpen = false;
        state.commandResults = [];
        dom.commandPalette.hidden = true;
        dom.commandPalette.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('command-palette-open');
        dom.commandPaletteInput.value = '';
        dom.commandPaletteList.innerHTML = '';
        if (options.restoreFocus !== false && previous && previous.isConnected && typeof previous.focus === 'function') {
            requestAnimationFrame(() => previous.focus({ preventScroll: true }));
        }
        state.commandPreviousFocus = null;
    }

    function executePaletteCommand(commandId) {
        const command = getCommandDefinitions().find((item) => item.id === commandId);
        if (!command) return;
        closeCommandPalette({ restoreFocus: false });
        requestAnimationFrame(() => command.run());
    }

    function trapCommandPaletteFocus(event) {
        if (!state.commandPaletteOpen || event.key !== 'Tab' || !dom.commandPalette) return false;
        const focusable = queryAll('input, button, [href], [tabindex]:not([tabindex="-1"])', dom.commandPalette)
            .filter((element) => !element.disabled && !element.hidden && element.getClientRects().length > 0);
        if (!focusable.length) return false;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !dom.commandPalette.contains(active))) {
            event.preventDefault();
            last.focus();
            return true;
        }
        if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
            return true;
        }
        return false;
    }

    function toggleSyncScrollFromCommand() {
        state.settings.syncScroll = !state.settings.syncScroll;
        dom.syncScrollToggle.checked = state.settings.syncScroll;
        if (dom.settingsSyncScrollToggle) dom.settingsSyncScrollToggle.checked = state.settings.syncScroll;
        persistSettings();
        setStatusMessage(state.settings.syncScroll ? '已开启编辑与预览同步滚动。' : '已关闭同步滚动。', { duration: 2600 });
    }

    function setFocusMode(enabled, options = {}) {
        const next = Boolean(enabled);
        if (next && document.body.classList.contains('auth-locked')) return;
        state.focusMode = next;
        document.body.classList.toggle('focus-mode', next);
        if (dom.focusModeButton) {
            dom.focusModeButton.setAttribute('aria-pressed', String(next));
            dom.focusModeButton.title = next ? '退出专注模式（Ctrl / ⌘ + Shift + F）' : '进入专注模式（Ctrl / ⌘ + Shift + F）';
        }
        if (dom.focusModeExitButton) dom.focusModeExitButton.setAttribute('aria-hidden', String(!next));
        if (next) {
            closeToolDrawer();
            closeToolbarMoreMenu();
            if (dom.settingsDialog && dom.settingsDialog.open) closeDialog(dom.settingsDialog, 'focus');
        }
        closeCommandPalette({ restoreFocus: false });
        requestAnimationFrame(() => {
            sanitizeSplitPosition();
            const view = dom.workspace.dataset.view;
            if (view === 'preview') renderPreview({ immediate: true, force: true });
            if (next) {
                const focusTarget = view === 'preview' ? dom.preview : dom.markdownInput;
                focusTarget.focus({ preventScroll: true });
            }
        });
        if (!options.silent) setStatusMessage(next ? '已进入专注模式。按 Ctrl / ⌘ + Shift + F 退出。' : '已退出专注模式。', { duration: 2600 });
    }

    function toggleFocusMode() {
        setFocusMode(!state.focusMode);
    }


    function onGlobalKeydown(event) {
        if (trapCommandPaletteFocus(event)) return;
        const modifier = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();

        if (modifier && key === 'k') {
            if (document.body.classList.contains('auth-locked')) return;
            event.preventDefault();
            if (state.commandPaletteOpen) closeCommandPalette();
            else openCommandPalette();
            return;
        }

        if (document.body.classList.contains('auth-locked')) return;

        if (event.key === 'Escape') {
            if (state.commandPaletteOpen) {
                event.preventDefault();
                closeCommandPalette();
            } else if (state.focusMode) {
                event.preventDefault();
                setFocusMode(false);
            } else {
                closeToolbarMoreMenu();
            }
            return;
        }

        if (modifier && event.shiftKey && key === 'f') {
            event.preventDefault();
            toggleFocusMode();
        } else if (modifier && key === 's') {
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
        } else if (event.altKey && key === 'p') {
            event.preventDefault();
            if (window.Md2WordPublishing) window.Md2WordPublishing.insertPageBreak();
        } else if (event.altKey && key === 'l') {
            event.preventDefault();
            if (window.Md2WordProfessional) window.Md2WordProfessional.insertAtSelection(window.Md2WordProfessional.createSectionBreakMarker('landscape'));
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
            if (file && !String(file.type || '').startsWith('image/')) loadFile(file);
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
        if (window.Md2WordAssets) await window.Md2WordAssets.resolvePreviewAssets(dom.preview);
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
        if (state.focusMode) setFocusMode(false, { silent: true });
        state.activeTool = panel;
        dom.toolDrawer.hidden = false;
        dom.toolDrawerTitle.textContent = title;
        dom.tableToolPanel.hidden = panel !== 'table';
        dom.aiToolPanel.hidden = panel !== 'ai';
        dom.exportCheckToolPanel.hidden = panel !== 'export';
        if (dom.assetToolPanel) dom.assetToolPanel.hidden = panel !== 'asset';
        if (dom.templateToolPanel) dom.templateToolPanel.hidden = panel !== 'template';
        if (dom.professionalToolPanel) dom.professionalToolPanel.hidden = panel !== 'professional';
        requestAnimationFrame(() => dom.toolDrawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    }

    function closeToolDrawer() {
        state.activeTool = '';
        dom.toolDrawer.hidden = true;
        dom.tableToolPanel.hidden = true;
        dom.aiToolPanel.hidden = true;
        dom.exportCheckToolPanel.hidden = true;
        if (dom.assetToolPanel) dom.assetToolPanel.hidden = true;
        if (dom.templateToolPanel) dom.templateToolPanel.hidden = true;
        if (dom.professionalToolPanel) dom.professionalToolPanel.hidden = true;
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
        const base = window.Md2WordPreflight.analyze(dom.markdownInput.value, state.renderResult);
        const pageIssues = window.Md2WordPublishing && typeof window.Md2WordPublishing.getPageIssues === 'function'
            ? window.Md2WordPublishing.getPageIssues()
            : [];
        const assetIssues = window.Md2WordAssets && typeof window.Md2WordAssets.getAssetIssues === 'function'
            ? window.Md2WordAssets.getAssetIssues(dom.preview, dom.markdownInput.value)
            : [];
        const professionalIssues = window.Md2WordProfessional && typeof window.Md2WordProfessional.analyze === 'function'
            ? window.Md2WordProfessional.analyze(dom.markdownInput.value, dom.preview, { ...state.settings, documentTitle: state.documentName })
            : [];
        const extra = [...pageIssues, ...assetIssues, ...professionalIssues];
        if (!extra.length) return base;
        const issues = [...base.issues, ...extra];
        const errors = issues.filter((issue) => issue.severity === 'error');
        const warnings = issues.filter((issue) => issue.severity !== 'error');
        return Object.freeze({
            issues: Object.freeze(issues), errors: Object.freeze(errors), warnings: Object.freeze(warnings),
            errorCount: errors.length, warningCount: warnings.length, total: issues.length,
            readiness: errors.length ? 'error' : warnings.length ? 'warning' : dom.markdownInput.value.trim() ? 'ready' : 'empty', checkedAt: Date.now()
        });
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

    let docxExportContext = null;

    function getProfessionalSettings() {
        return window.Md2WordProfessional
            ? window.Md2WordProfessional.normalizeSettings(state.settings)
            : { ...state.settings };
    }

    function getProfessionalMetadata(title) {
        if (window.Md2WordProfessional) return window.Md2WordProfessional.metadata({ ...state.settings, documentTitle: title }, title);
        return { title, subtitle: '', author: '', organization: '', date: '', version: '', number: '', classification: '' };
    }

    function createPageFieldChildren(tokens) {
        const d = window.docx;
        const size = Math.max(18, Math.round(state.settings.wordFontSize * 2 - 2));
        return (tokens || []).map((token) => {
            if (typeof token === 'string') return new d.TextRun({ text: token, font: state.settings.wordFont, size });
            return token;
        });
    }

    function buildHeaderFooterGroups(title, settings, options = {}) {
        const d = window.docx;
        const professional = window.Md2WordProfessional;
        const meta = getProfessionalMetadata(title);
        const substitute = professional?.substitutePlaceholders || ((value) => String(value || ''));
        const headerText = settings.headerEnabled ? substitute(settings.headerText, meta) : '';
        const footerText = substitute(settings.footerText, meta);
        const pageTokens = professional?.pageNumberTokens ? professional.pageNumberTokens(settings, d) : [];
        const makeParagraph = (text, includePageNumber, alignment) => {
            const children = [];
            if (text) children.push(new d.TextRun({ text, font: state.settings.wordFont, size: Math.max(18, Math.round(state.settings.wordFontSize * 2 - 2)), color: '667085' }));
            if (text && includePageNumber && pageTokens.length) children.push(new d.TextRun({ text: ' · ', color: '98A2B3' }));
            if (includePageNumber) children.push(...createPageFieldChildren(pageTokens));
            return new d.Paragraph({
                children,
                alignment: professional?.alignmentValue ? professional.alignmentValue(alignment, d) : (d.AlignmentType?.CENTER || 'center'),
                spacing: { before: 0, after: 0 },
                border: options.header ? { bottom: { color: 'D0D5DD', size: 2, style: d.BorderStyle?.SINGLE || 'single', space: 6 } } : { top: { color: 'E4E7EC', size: 2, style: d.BorderStyle?.SINGLE || 'single', space: 6 } }
            });
        };
        const groups = {};
        if (d.Header && headerText) {
            groups.headers = { default: new d.Header({ children: [makeParagraph(headerText, false, 'left')] }) };
            if (settings.firstPageDifferent) groups.headers.first = new d.Header({ children: [new d.Paragraph('')] });
        }
        if (d.Footer && (footerText || pageTokens.length)) {
            groups.footers = { default: new d.Footer({ children: [makeParagraph(footerText, true, settings.pageNumberAlignment)] }) };
            if (settings.firstPageDifferent) groups.footers.first = new d.Footer({ children: [new d.Paragraph('')] });
        }
        return groups;
    }

    function createCoverDocxChildren(title, settings) {
        const d = window.docx;
        const meta = getProfessionalMetadata(title);
        const colors = window.Md2WordProfessional?.getPresetColors?.(settings) || { heading: '101828', accent: '2F75B5', muted: '667085' };
        const headingFont = settings.wordHeadingFont || state.settings.wordFont;
        const rows = [
            ['作者', meta.author], ['单位', meta.organization], ['日期', meta.date],
            ['版本', meta.version], ['文档编号', meta.number], ['密级', meta.classification]
        ].filter((item) => item[1]);
        const children = [
            new d.Paragraph({ children: [new d.TextRun({ text: 'MARKDOWN → DOCX', bold: true, color: colors.muted, size: 18, characterSpacing: 40 })], spacing: { before: 900, after: 900 } }),
            new d.Paragraph({ children: [new d.TextRun({ text: meta.title, bold: true, font: headingFont, size: settings.coverStyle === 'report' ? 52 : 46, color: colors.heading })], spacing: { after: meta.subtitle ? 240 : 520 }, alignment: settings.coverStyle === 'academic' ? d.AlignmentType?.CENTER : undefined }),
        ];
        if (meta.subtitle) children.push(new d.Paragraph({ children: [new d.TextRun({ text: meta.subtitle, font: headingFont, size: 28, color: colors.muted })], spacing: { after: 520 }, alignment: settings.coverStyle === 'academic' ? d.AlignmentType?.CENTER : undefined }));
        children.push(new d.Paragraph({ text: '', border: { bottom: { color: colors.accent, size: 18, style: d.BorderStyle?.SINGLE || 'single', space: 8 } }, spacing: { after: 620 } }));
        rows.forEach(([label, value]) => children.push(new d.Paragraph({
            children: [new d.TextRun({ text: `${label}：`, color: colors.muted, size: 21 }), new d.TextRun({ text: value, bold: true, color: colors.heading, size: 22 })],
            spacing: { after: 150 },
            alignment: settings.coverStyle === 'academic' ? d.AlignmentType?.CENTER : undefined
        })));
        return children;
    }

    function createTocDocxChildren(preview, settings) {
        const d = window.docx;
        if (!settings.tocEnabled) return [];
        if (d.TableOfContents) {
            try {
                const toc = new d.TableOfContents(settings.tocTitle, {
                    hyperlink: true,
                    headingStyleRange: `1-${settings.tocDepth}`,
                    stylesWithLevels: []
                });
                const pageBreak = d.PageBreak ? new d.Paragraph({ children: [new d.PageBreak()] }) : new d.Paragraph({ pageBreakBefore: true, children: [new d.TextRun({ text: '' })] });
                return [toc, pageBreak];
            } catch (_error) {
                // Fall back to a static, clickable-looking list below.
            }
        }
        const headings = window.Md2WordProfessional?.extractHeadings?.(preview, settings) || [];
        return [
            new d.Paragraph({ children: [new d.TextRun({ text: settings.tocTitle, bold: true, size: 32 })], style: 'TOCHeading', spacing: { after: 220 } }),
            ...headings.filter((item) => item.level <= settings.tocDepth).map((item) => new d.Paragraph({
                children: [new d.TextRun({ text: `${item.number ? `${item.number} ` : ''}${item.text}`, color: '344054' })],
                indent: { left: Math.max(0, (item.level - 1) * 360) }, spacing: { after: 80 }
            })),
            d.PageBreak ? new d.Paragraph({ children: [new d.PageBreak()] }) : new d.Paragraph({ pageBreakBefore: true, children: [new d.TextRun({ text: '' })] })
        ];
    }

    function buildDocxNumbering(settings) {
        const d = window.docx;
        if (!window.Md2WordProfessional || settings.headingNumbering === 'none') return undefined;
        const levels = window.Md2WordProfessional.getHeadingNumberingLevels(settings, d);
        if (!levels.length) return undefined;
        return { config: [{ reference: window.Md2WordProfessional.HEADING_NUMBERING_REFERENCE, levels }] };
    }

    function getDocxPageForOrientation(orientation) {
        if (window.Md2WordPublishing) return window.Md2WordPublishing.getDocxPageProperties({ ...state.settings, wordOrientation: orientation }, window.docx);
        return { margin: { top: cmToTwip(state.settings.wordMarginCm), right: cmToTwip(state.settings.wordMarginCm), bottom: cmToTwip(state.settings.wordMarginCm), left: cmToTwip(state.settings.wordMarginCm) } };
    }


    function normalizeInternalAnchor(value) {
        let anchor = String(value || '').replace(/^#/, '').trim();
        try { anchor = decodeURIComponent(anchor); } catch (_error) { /* keep the original fragment */ }
        return anchor.trim().toLowerCase();
    }

    function buildHeadingBookmarkMap(preview, settings) {
        const map = new Map();
        const headings = window.Md2WordProfessional?.extractHeadings?.(preview, settings) || [];
        headings.forEach((heading) => {
            const bookmark = heading.bookmarkId;
            const text = String(heading.text || '').trim();
            const aliases = [
                heading.sourceId,
                heading.element?.id,
                text,
                text.replace(/\s+/g, '-'),
                text.replace(/\s+/g, '_')
            ];
            aliases.forEach((alias) => {
                const key = normalizeInternalAnchor(alias);
                if (key && !map.has(key)) map.set(key, bookmark);
            });
        });
        return map;
    }

    function buildProfessionalDocxSections(preview, title, settings) {
        const d = window.docx;
        const sections = [];
        const sectionType = d.SectionType?.NEXT_PAGE || undefined;
        if (settings.coverEnabled) {
            sections.push({
                properties: { type: sectionType, page: getDocxPageForOrientation('portrait'), titlePage: true },
                children: createCoverDocxChildren(title, settings)
            });
        }
        const sourceSections = window.Md2WordProfessional
            ? window.Md2WordProfessional.splitElementsIntoSections(Array.from(preview.children), state.settings.wordOrientation)
            : [{ orientation: state.settings.wordOrientation, elements: Array.from(preview.children) }];
        const headingBookmarks = buildHeadingBookmarkMap(preview, settings);
        let headingCursor = 0;
        sourceSections.forEach((sourceSection, index) => {
            docxExportContext = { settings, orientation: sourceSection.orientation, headingCursor, headingBookmarks, figureIndex: 0, tableIndex: 0 };
            let children = convertPreviewToDocxChildren(sourceSection.elements);
            if (index === 0 && settings.tocEnabled) children = [...createTocDocxChildren(preview, settings), ...children];
            if (!children.length) children = [new d.Paragraph({ children: [new d.TextRun({ text: '' })] })];
            const page = getDocxPageForOrientation(sourceSection.orientation);
            if (index === 0 && settings.coverEnabled) page.pageNumbers = { start: 1 };
            headingCursor = docxExportContext.headingCursor;
            sections.push({
                properties: { type: sectionType, page, titlePage: !settings.coverEnabled && index === 0 && settings.firstPageDifferent },
                ...buildHeaderFooterGroups(title, settings),
                children
            });
        });
        docxExportContext = null;
        return sections;
    }

    function createDocumentStyles(baseSize, line, settings) {
        return {
            default: {
                document: {
                    run: { font: state.settings.wordFont, size: baseSize, color: '172033' },
                    paragraph: {
                        spacing: { line, after: Math.round(settings.wordParagraphAfterPt * 20) },
                        indent: settings.wordFirstLineChars ? { firstLine: Math.round(settings.wordFirstLineChars * state.settings.wordFontSize * 20) } : undefined
                    }
                }
            },
            characterStyles: [{
                id: 'Hyperlink', name: 'Hyperlink', basedOn: 'DefaultParagraphFont',
                run: { color: '0563C1', underline: {} }
            }],
            paragraphStyles: createWordParagraphStyles(baseSize, line, settings)
        };
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
        if (window.Md2WordAssets && typeof window.Md2WordAssets.resolvePreviewAssets === 'function') await window.Md2WordAssets.resolvePreviewAssets(dom.preview);
        if (window.Md2WordPublishing && window.Md2WordPublishing.getPreviewMode?.() === 'a4') window.Md2WordPublishing.buildA4Preview({ immediate: true });
        const report = updateExportReadiness(buildExportReport());
        if (!options.force && report.issues.length) {
            openExportCheck(report);
            setStatusMessage(`导出前发现 ${report.errorCount} 个错误、${report.warningCount} 个提醒。`, { tone: report.errorCount ? 'error' : 'warning', duration: 6000 });
            dom.renderStatus.textContent = '等待确认导出检查';
            return;
        }

        if (state.activeTool === 'export') closeToolDrawer();
        showExportProgress(true, '正在准备封面、目录、分节、图片、表格与公式…');
        try {
            state.lastImageExport = window.Md2WordAssets
                ? await window.Md2WordAssets.preparePreviewForExport(dom.preview, { fetchRemote: state.settings.embedRemoteImages !== false, timeout: 12000 })
                : null;
            const title = state.documentName || extractTitle(markdown) || '未命名文档';
            const settings = getProfessionalSettings();
            const meta = getProfessionalMetadata(title);
            const line = Math.round(240 * state.settings.wordLineSpacing);
            const fontSize = Math.round(state.settings.wordFontSize * 2);
            const sections = buildProfessionalDocxSections(dom.preview, title, settings);
            if (!sections.some((section) => section.children && section.children.length)) throw new Error('没有可写入 Word 的内容');
            const documentOptions = {
                creator: meta.author || 'AI 智能 Markdown 转 Word',
                lastModifiedBy: meta.author || 'AI 智能 Markdown 转 Word',
                title: meta.title,
                subject: meta.subtitle || 'Markdown 转 Word 文档',
                description: `由浏览器本地生成 · ${window.Md2WordProfessional?.getPreset(settings.professionalStyle)?.name || '专业交付'}`,
                keywords: ['Markdown', 'DOCX', meta.organization, meta.number].filter(Boolean).join(', '),
                category: meta.classification || 'Document',
                styles: createDocumentStyles(fontSize, line, settings),
                sections
            };
            const numbering = buildDocxNumbering(settings);
            if (numbering) documentOptions.numbering = numbering;
            const doc = new window.docx.Document(documentOptions);

            showExportProgress(true, '正在打包专业 DOCX 文件…');
            const blob = await window.docx.Packer.toBlob(doc);
            const fileName = `${sanitizeFileName(state.documentName || title)}.docx`;
            downloadBlob(blob, fileName);
            const mathCount = renderResult ? Number(renderResult.mathCount || 0) : 0;
            const mathErrors = renderResult && renderResult.errors ? renderResult.errors.length : 0;
            showExportProgress(false);
            const extras = [settings.coverEnabled ? '封面' : '', settings.tocEnabled ? '目录' : '', sections.length > 1 ? `${sections.length} 节` : ''].filter(Boolean).join(' · ');
            setStatusMessage(`Word 已生成：${fileName} · 公式 ${mathCount} 个，渲染错误 ${mathErrors} 个${extras ? ` · ${extras}` : ''}。`, { duration: 7200 });
        } catch (error) {
            console.error('Word 导出失败:', error);
            showExportProgress(false);
            toast('Word 导出失败', error.message || String(error), 'error', 6500);
        } finally {
            docxExportContext = null;
        }
    }

    function createWordParagraphStyles(baseSize, line, professionalInput = {}) {
        const settings = window.Md2WordProfessional?.normalizeSettings?.(professionalInput) || professionalInput;
        const colors = window.Md2WordProfessional?.getPresetColors?.(settings) || { heading: '111827', accent: '2F75B5', muted: '667085' };
        const font = settings.wordHeadingFont || state.settings.wordFont;
        const sizes = [Math.max(baseSize + 16, 32), Math.max(baseSize + 10, 28), Math.max(baseSize + 6, 24), Math.max(baseSize + 3, 22), Math.max(baseSize + 1, 21), Math.max(baseSize, 20)];
        const styles = sizes.map((size, index) => ({
            id: `Heading${index + 1}`, name: `标题 ${index + 1}`, basedOn: 'Normal', next: 'Normal', quickFormat: true,
            run: { font, size, bold: true, color: colors.heading },
            paragraph: { spacing: { before: Math.max(120, 280 - index * 30), after: Math.max(80, 180 - index * 18), line }, keepNext: true, keepLines: true }
        }));
        styles.push(
            { id: 'TOCHeading', name: '目录标题', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font, size: Math.max(baseSize + 12, 30), bold: true, color: colors.heading }, paragraph: { spacing: { before: 120, after: 240 } } },
            { id: 'Caption', name: '题注', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: state.settings.wordFont, size: Math.max(18, baseSize - 2), color: colors.muted }, paragraph: { alignment: window.docx.AlignmentType?.CENTER || 'center', spacing: { before: 80, after: 160 } } }
        );
        return styles;
    }

    function convertPreviewToDocxChildren(previewRootOrElements) {
        const output = [];
        const elements = Array.isArray(previewRootOrElements)
            ? previewRootOrElements
            : Array.from(previewRootOrElements?.children || []);
        elements.forEach((element) => output.push(...convertBlockElement(element, 0)));
        return output;
    }

    function convertBlockElement(element, listLevel = 0) {
        const d = window.docx;
        if (!(element instanceof Element)) return [];
        if (element.classList.contains('preview-empty')) return [];
        if (element.matches('.md2word-section-break, [data-section-break="true"]')) return [];
        if (element.matches('[data-professional-cover="true"], [data-professional-toc="true"]')) return [];
        const tag = element.tagName.toLowerCase();
        const settings = docxExportContext?.settings || getProfessionalSettings();

        if (element.classList.contains('md2word-page-break') || element.dataset.pageBreak === 'true') {
            if (d.PageBreak) return [new d.Paragraph({ children: [new d.PageBreak()] })];
            return [new d.Paragraph({ children: [new d.TextRun({ text: '', break: 1 })], pageBreakBefore: true })];
        }

        if (element.classList.contains('md2word-caption')) {
            const text = element.textContent.trim() || element.dataset.captionTitle || '题注';
            return [new d.Paragraph({ children: [new d.TextRun({ text, font: state.settings.wordFont })], style: 'Caption', keepNext: true })];
        }

        if (/^h[1-6]$/.test(tag)) {
            const level = Number(tag.slice(1));
            const plainRuns = collectDocxRuns(element);
            let children = plainRuns;
            if (d.Bookmark && window.Md2WordProfessional) {
                const headingIndex = docxExportContext ? docxExportContext.headingCursor++ : Math.max(0, level - 1);
                const bookmark = element.dataset.bookmarkId
                    || docxExportContext?.headingBookmarks?.get(normalizeInternalAnchor(element.id || element.textContent))
                    || window.Md2WordProfessional.bookmarkId(headingIndex, element.textContent);
                try { children = [new d.Bookmark({ id: bookmark, children: plainRuns })]; } catch (_error) { children = plainRuns; }
            }
            const options = {
                children,
                style: `Heading${Math.min(6, level)}`,
                heading: d.HeadingLevel ? d.HeadingLevel[`HEADING_${level}`] : undefined,
                spacing: { before: level === 1 ? 260 : 180, after: 120 },
                keepNext: true,
                keepLines: true
            };
            if (settings.headingNumbering !== 'none' && window.Md2WordProfessional) {
                options.numbering = { reference: window.Md2WordProfessional.HEADING_NUMBERING_REFERENCE, level: level - 1 };
            }
            return [new d.Paragraph(options)];
        }

        if (tag === 'p') {
            const runs = collectDocxRuns(element);
            if (!runs.length) return [];
            const onlyDisplayMath = isDisplayMathParagraph(element);
            return [new d.Paragraph({
                children: runs,
                alignment: onlyDisplayMath && d.AlignmentType ? d.AlignmentType.CENTER : undefined,
                indent: !onlyDisplayMath && settings.wordFirstLineChars ? { firstLine: Math.round(settings.wordFirstLineChars * state.settings.wordFontSize * 20) } : undefined,
                spacing: { after: onlyDisplayMath ? 180 : Math.round(settings.wordParagraphAfterPt * 20) },
                keepLines: onlyDisplayMath
            })];
        }

        if (tag === 'ul' || tag === 'ol') {
            const ordered = tag === 'ol';
            const blocks = [];
            Array.from(element.children).filter((child) => child.tagName?.toLowerCase() === 'li').forEach((li, index) => {
                const clone = li.cloneNode(true);
                queryAll(':scope > ul, :scope > ol', clone).forEach((nested) => nested.remove());
                const prefix = ordered ? `${index + 1}. ` : '• ';
                blocks.push(new d.Paragraph({
                    children: [new d.TextRun({ text: prefix, bold: ordered }), ...collectDocxRuns(clone)],
                    indent: { left: 600 + listLevel * 420, hanging: 300 },
                    spacing: { after: 70 },
                    keepLines: true
                }));
                Array.from(li.children).filter((child) => ['ul', 'ol'].includes(child.tagName.toLowerCase())).forEach((nested) => blocks.push(...convertBlockElement(nested, listLevel + 1)));
            });
            return blocks;
        }

        if (tag === 'blockquote') {
            return [new d.Paragraph({
                children: collectDocxRuns(element),
                indent: { left: 480, right: 240 },
                border: { left: { color: '2563EB', size: 18, style: d.BorderStyle?.SINGLE || 'single', space: 8 } },
                shading: { type: d.ShadingType?.CLEAR || 'clear', fill: 'EEF4FF' },
                spacing: { before: 80, after: 120 },
                keepLines: true
            })];
        }

        if (tag === 'pre') {
            const code = element.textContent.replace(/\n$/, '');
            const lines = code.split('\n');
            return lines.map((line, index) => new d.Paragraph({
                children: [new d.TextRun({ text: line || ' ', font: 'Consolas', size: Math.max(18, Math.round(state.settings.wordFontSize * 2 - 2)), color: '1F2937' })],
                shading: { type: d.ShadingType?.CLEAR || 'clear', fill: 'F3F4F6' },
                border: index === 0 ? {
                    top: { color: 'D1D5DB', size: 4, style: d.BorderStyle?.SINGLE || 'single' }, left: { color: 'D1D5DB', size: 4, style: d.BorderStyle?.SINGLE || 'single' }, right: { color: 'D1D5DB', size: 4, style: d.BorderStyle?.SINGLE || 'single' }
                } : index === lines.length - 1 ? {
                    bottom: { color: 'D1D5DB', size: 4, style: d.BorderStyle?.SINGLE || 'single' }, left: { color: 'D1D5DB', size: 4, style: d.BorderStyle?.SINGLE || 'single' }, right: { color: 'D1D5DB', size: 4, style: d.BorderStyle?.SINGLE || 'single' }
                } : {
                    left: { color: 'D1D5DB', size: 4, style: d.BorderStyle?.SINGLE || 'single' }, right: { color: 'D1D5DB', size: 4, style: d.BorderStyle?.SINGLE || 'single' }
                },
                indent: { left: 240, right: 240 },
                spacing: { before: 0, after: index === lines.length - 1 ? 140 : 0 },
                keepLines: true
            }));
        }

        if (tag === 'table') {
            const table = convertTableToDocx(element);
            const blocks = [table];
            if (settings.captionMode === 'alt' && settings.captionTables) {
                const title = element.getAttribute('aria-label') || element.dataset.caption || '';
                if (title) blocks.unshift(new d.Paragraph({ children: [new d.TextRun({ text: title })], style: 'Caption', keepNext: true }));
            }
            return blocks;
        }

        if (tag === 'hr') {
            return [new d.Paragraph({
                text: '',
                border: { bottom: { color: 'C5CFDA', size: 6, style: d.BorderStyle?.SINGLE || 'single', space: 8 } },
                spacing: { before: 120, after: 160 }
            })];
        }

        if (tag === 'img') {
            const paragraph = new d.Paragraph({ children: collectDocxRuns(element), alignment: d.AlignmentType?.CENTER || 'center', spacing: { after: 80 } });
            const blocks = [paragraph];
            if (settings.captionMode === 'alt' && settings.captionFigures) {
                const alt = element.getAttribute('alt') || '';
                if (alt) blocks.push(new d.Paragraph({ children: [new d.TextRun({ text: alt })], style: 'Caption', keepNext: false }));
            }
            return blocks;
        }

        if (tag === 'figure') {
            const blocks = [];
            Array.from(element.children).forEach((child) => blocks.push(...convertBlockElement(child, listLevel)));
            return blocks;
        }

        const nestedBlocks = [];
        Array.from(element.children).forEach((child) => nestedBlocks.push(...convertBlockElement(child, listLevel)));
        if (nestedBlocks.length) return nestedBlocks;
        const runs = collectDocxRuns(element);
        return runs.length ? [new d.Paragraph({ children: runs, spacing: { after: Math.round(settings.wordParagraphAfterPt * 20) } })] : [];
    }

    function isDisplayMathParagraph(element) {
        const meaningful = Array.from(element.childNodes).filter((node) => {
            if (node.nodeType === Node.TEXT_NODE) return Boolean(node.textContent.trim());
            return node.nodeType === Node.ELEMENT_NODE;
        });
        return meaningful.length === 1 && meaningful[0].nodeType === Node.ELEMENT_NODE && meaningful[0].classList.contains('math-display');
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
            if (element.classList.contains('md2word-heading-number')) return;

            if (element.classList.contains('math-node')) {
                const latex = window.Md2WordMath.decodeMathSource(element);
                const mathSegments = window.Md2WordMath.latexToWordSegments(latex);
                mathSegments.forEach((segment) => runs.push(new d.TextRun({
                    text: segment.text, font: state.settings.wordFont, bold: Boolean(segment.bold), italics: Boolean(segment.italics),
                    subScript: Boolean(segment.subScript), superScript: Boolean(segment.superScript)
                })));
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
                const linkRun = new d.TextRun({ text, style: 'Hyperlink', color: '0563C1', underline: {} });
                try {
                    if (/^https?:\/\//i.test(href) && d.ExternalHyperlink) runs.push(new d.ExternalHyperlink({ children: [linkRun], link: href }));
                    else if (href.startsWith('#') && d.InternalHyperlink && window.Md2WordProfessional) {
                        const sourceId = normalizeInternalAnchor(href.slice(1));
                        const anchor = docxExportContext?.headingBookmarks?.get(sourceId);
                        if (anchor) runs.push(new d.InternalHyperlink({ children: [linkRun], anchor }));
                        else runs.push(new d.TextRun({ text, color: '0563C1', underline: {} }));
                    }
                    else runs.push(new d.TextRun({ text: href && href !== text ? `${text} (${href})` : text, color: '0563C1', underline: {} }));
                } catch (_error) {
                    runs.push(new d.TextRun({ text: href && href !== text ? `${text} (${href})` : text, color: '0563C1', underline: {} }));
                }
                return;
            }

            const nextStyle = { ...style };
            if (tag === 'strong' || tag === 'b') nextStyle.bold = true;
            if (tag === 'em' || tag === 'i') nextStyle.italics = true;
            if (tag === 'u') nextStyle.underline = {};
            if (tag === 's' || tag === 'del') nextStyle.strike = true;
            if (tag === 'code') { nextStyle.font = 'Consolas'; nextStyle.highlight = 'lightGray'; }
            Array.from(element.childNodes).forEach((child) => visit(child, nextStyle));
        }

        visit(root, inherited);
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
            const geometry = window.Md2WordPublishing?.pageGeometry?.({ ...state.settings, wordOrientation: docxExportContext?.orientation || state.settings.wordOrientation }) || null;
            const maximumWidth = Math.max(120, Math.floor(geometry?.contentWidthPx || 620));
            const requestedWidth = Number(element.getAttribute('width') || element.dataset.naturalWidth || element.naturalWidth || 520);
            const width = clamp(requestedWidth, 40, maximumWidth);
            const naturalWidth = Number(element.dataset.naturalWidth || element.naturalWidth || width);
            const naturalHeight = Number(element.dataset.naturalHeight || element.naturalHeight || width * 0.65);
            const height = Math.max(30, Math.round(width * (naturalHeight / Math.max(1, naturalWidth))));
            return new d.ImageRun({ data: bytes, transformation: { width, height } });
        } catch (_error) {
            return null;
        }
    }

    function tableBorder(style, size, color) {
        return { style, size, color };
    }

    function convertTableToDocx(tableElement) {
        const d = window.docx;
        const settings = docxExportContext?.settings || getProfessionalSettings();
        const colors = window.Md2WordProfessional?.getPresetColors?.(settings) || { tableHeader: 'EAF1FF', tableBorder: 'C5CFDA', accent: '1D4ED8' };
        const rows = Array.from(tableElement.querySelectorAll('tr'));
        const columnCount = Math.max(1, ...rows.map((row) => Array.from(row.children).filter((cell) => ['td', 'th'].includes(cell.tagName.toLowerCase())).length));
        const page = getDocxPageForOrientation(docxExportContext?.orientation || state.settings.wordOrientation);
        const pageWidth = Number(page.size?.width || 11906);
        const contentWidth = Math.max(2400, pageWidth - Number(page.margin?.left || 1440) - Number(page.margin?.right || 1440));
        const columnWidth = Math.floor(contentWidth / columnCount);
        const borderStyle = d.BorderStyle?.SINGLE || 'single';
        const noneStyle = d.BorderStyle?.NONE || 'none';
        const academic = settings.wordTableStyle === 'academic';
        const minimal = settings.wordTableStyle === 'minimal';
        const monochrome = settings.wordTableStyle === 'monochrome';
        const borderColor = monochrome ? '333333' : colors.tableBorder;
        const outsideSize = academic ? 10 : minimal ? 0 : 4;
        const insideSize = academic || minimal ? 0 : 3;
        const borders = {
            top: tableBorder(borderStyle, outsideSize || 0, borderColor),
            bottom: tableBorder(borderStyle, outsideSize || 0, borderColor),
            left: tableBorder(minimal || academic ? noneStyle : borderStyle, minimal || academic ? 0 : outsideSize, borderColor),
            right: tableBorder(minimal || academic ? noneStyle : borderStyle, minimal || academic ? 0 : outsideSize, borderColor),
            insideHorizontal: tableBorder(academic ? borderStyle : (minimal ? noneStyle : borderStyle), academic ? 2 : insideSize, academic ? 'BFBFBF' : borderColor),
            insideVertical: tableBorder(academic || minimal ? noneStyle : borderStyle, academic || minimal ? 0 : insideSize, borderColor)
        };
        const docRows = rows.map((row, rowIndex) => {
            const cells = Array.from(row.children).filter((cell) => ['td', 'th'].includes(cell.tagName.toLowerCase()));
            return new d.TableRow({
                tableHeader: settings.repeatTableHeader && rowIndex === 0,
                cantSplit: settings.keepTableRows,
                children: cells.map((cell) => {
                    const header = cell.tagName.toLowerCase() === 'th' || rowIndex === 0;
                    return new d.TableCell({
                        width: { size: columnWidth, type: d.WidthType?.DXA || 'dxa' },
                        children: [new d.Paragraph({ children: collectDocxRuns(cell, header ? { bold: true, color: academic || monochrome ? '000000' : colors.accent } : {}), spacing: { after: 0 }, keepLines: true })],
                        shading: header && !minimal ? { type: d.ShadingType?.CLEAR || 'clear', fill: academic || monochrome ? 'F2F2F2' : colors.tableHeader } : undefined,
                        margins: { top: 100, bottom: 100, left: 110, right: 110 }
                    });
                })
            });
        });
        return new d.Table({
            rows: docRows,
            width: { size: contentWidth, type: d.WidthType?.DXA || 'dxa' },
            layout: d.TableLayoutType?.FIXED || 'fixed',
            alignment: d.AlignmentType?.CENTER || 'center',
            borders
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

    window.Md2WordCore = Object.freeze({
        renderPreview,
        getSettings: () => ({ ...state.settings }),
        applySettingsPatch: (patch = {}, options = {}) => {
            state.settings = { ...state.settings, ...patch };
            if (options.persist !== false) persistSettings();
            applySettings();
            populateSettingsForm();
            if (options.render !== false) renderPreview({ immediate: true, force: true });
            return { ...state.settings };
        },
        getState: () => ({ ...state }),
        buildExportReport,
        setView,
        activateSettingsTab
    });

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
            toggleFormulaInspector,
            openCommandPalette,
            closeCommandPalette,
            renderCommandPalette,
            setFocusMode,
            toggleFocusMode,
            parseSharedAccess,
            clearRememberedAccess,
            updateRememberedDeviceStatus
        };
    }
})();

/* v5.5 reliable workflow, publishing and professional delivery enhancement. Runs after the formula core and keeps the application fully static. */
(function () {
    'use strict';

    const VERSION = '5.5';
    const SETTINGS_KEY = 'md2word.workflow.settings.v5.4';
    const LAST_DOCUMENT_KEY = 'md2word.workspace.last-document.v5.4';
    const LEGACY_AUTOSAVE_KEY = 'md2word.personal.autosave.v3';
    const BASE_SETTINGS_KEY = 'md2word.personal.settings.v3';
    const AI_KEY = 'md2word.personal.ai.v3';
    const AUTO_VERSION_INTERVAL = 5 * 60 * 1000;
    const AUTO_VERSION_CHANGE_THRESHOLD = 420;
    const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
    const DEFAULTS = Object.freeze({ heroBehavior: 'auto', smartPasteMode: 'auto', versionHistory: true });

    const state = {
        store: null,
        ready: false,
        settings: { ...DEFAULTS },
        currentId: null,
        currentCreatedAt: null,
        documents: [],
        versions: [],
        selectedId: null,
        saveTimer: null,
        saveChain: Promise.resolve(),
        pendingPaste: null,
        lastVersionAt: 0,
        lastVersionContent: '',
        exportStartedAt: 0,
        receiptTimer: null,
        transitionGuard: false,
        centerOpen: false,
        workspaceError: '',
        workspaceNotice: ''
    };

    const dom = {};
    const $ = (id) => document.getElementById(id);
    const q = (selector, root = document) => root.querySelector(selector);
    const qa = (selector, root = document) => Array.from(root.querySelectorAll(selector));
    const safeParse = (raw, fallback = null) => { try { return raw ? JSON.parse(raw) : fallback; } catch (_error) { return fallback; } };
    const storageGet = (key) => {
        try { return window.localStorage ? window.localStorage.getItem(key) : null; }
        catch (_error) { return null; }
    };
    const storageSet = (key, value) => {
        try { if (!window.localStorage) return false; window.localStorage.setItem(key, value); return true; }
        catch (_error) { return false; }
    };
    const storageRemove = (key) => {
        try { if (!window.localStorage) return false; window.localStorage.removeItem(key); return true; }
        catch (_error) { return false; }
    };
    const escapeHtml = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const formatBytes = (bytes) => { const value = Number(bytes) || 0; if (value < 1024) return `${value} B`; if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KB`; return `${(value / 1024 / 1024).toFixed(1)} MB`; };
    const formatDateTime = (timestamp) => { if (!timestamp) return '刚刚'; try { return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp)); } catch (_error) { return new Date(timestamp).toLocaleString(); } };
    const formatRelativeTime = (timestamp) => {
        const delta = Date.now() - Number(timestamp || 0);
        if (delta < 60_000) return '刚刚';
        if (delta < 3_600_000) return `${Math.max(1, Math.floor(delta / 60_000))} 分钟前`;
        if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} 小时前`;
        if (delta < 604_800_000) return `${Math.floor(delta / 86_400_000)} 天前`;
        return formatDateTime(timestamp);
    };
    const stripMarkdown = (value) => String(value || '').replace(/```[\s\S]*?```/g, ' ').replace(/`([^`]*)`/g, '$1').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/^#{1,6}\s+/gm, '').replace(/[>*_~|\\]/g, ' ').replace(/\s+/g, ' ').trim();
    const getBaseSettings = () => safeParse(storageGet(BASE_SETTINGS_KEY), {}) || {};
    const isAutosaveEnabled = () => getBaseSettings().autosave !== false;

    function cacheDom() {
        Object.assign(dom, {
            input: $('markdownInput'), name: $('documentNameInput'), preview: $('preview'),
            centerLayer: $('documentCenterLayer'), center: $('documentCenter'), centerStatus: $('documentCenterStatus'),
            search: $('documentSearchInput'), list: $('documentList'), listEmpty: $('documentListEmpty'), listCount: $('documentListCount'),
            versionList: $('versionList'), versionEmpty: $('versionListEmpty'), versionName: $('versionDocumentName'),
            smartBar: $('smartPasteBar'), smartTitle: $('smartPasteTitle'), smartDetail: $('smartPasteDetail'),
            heroButton: $('heroCollapseButton'), settingsForm: $('settingsForm'), heroSelect: $('heroBehaviorSelect'),
            pasteSelect: $('smartPasteModeSelect'), historyToggle: $('versionHistoryToggle'),
            backupInput: $('backupFileInput'), includeApiKey: $('backupIncludeApiKey'), dependencyList: $('dependencyStatusList'),
            dataDocumentCount: $('dataDocumentCount'), dataVersionCount: $('dataVersionCount'), dataAssetCount: $('dataAssetCount'), dataStorageSize: $('dataStorageSize'), dataStorageBackend: $('dataStorageBackend'),
            receipt: $('exportReceipt'), receiptFile: $('exportReceiptFileName'), receiptSummary: $('exportReceiptSummary'), receiptMetrics: $('exportReceiptMetrics')
        });
    }

    function loadWorkflowSettings() {
        const saved = safeParse(storageGet(SETTINGS_KEY), {}) || {};
        state.settings = {
            heroBehavior: ['auto', 'expanded', 'compact'].includes(saved.heroBehavior) ? saved.heroBehavior : DEFAULTS.heroBehavior,
            smartPasteMode: ['auto', 'ask', 'plain'].includes(saved.smartPasteMode) ? saved.smartPasteMode : DEFAULTS.smartPasteMode,
            versionHistory: typeof saved.versionHistory === 'boolean' ? saved.versionHistory : DEFAULTS.versionHistory
        };
        populateWorkflowSettings();
    }

    function populateWorkflowSettings() {
        if (dom.heroSelect) dom.heroSelect.value = state.settings.heroBehavior;
        if (dom.pasteSelect) dom.pasteSelect.value = state.settings.smartPasteMode;
        if (dom.historyToggle) dom.historyToggle.checked = state.settings.versionHistory;
    }

    function saveWorkflowSettings() {
        state.settings = {
            heroBehavior: dom.heroSelect && ['auto', 'expanded', 'compact'].includes(dom.heroSelect.value) ? dom.heroSelect.value : DEFAULTS.heroBehavior,
            smartPasteMode: dom.pasteSelect && ['auto', 'ask', 'plain'].includes(dom.pasteSelect.value) ? dom.pasteSelect.value : DEFAULTS.smartPasteMode,
            versionHistory: dom.historyToggle ? dom.historyToggle.checked : DEFAULTS.versionHistory
        };
        storageSet(SETTINGS_KEY, JSON.stringify(state.settings));
        applyHeroBehavior();
    }

    function notify(message, options = {}) {
        const box = $('statusMessage');
        const text = $('statusMessageText');
        if (!box || !text) return;
        text.textContent = String(message || '');
        box.hidden = false;
        box.dataset.type = options.type || 'info';
        window.clearTimeout(notify.timer);
        notify.timer = window.setTimeout(() => { box.hidden = true; }, Number(options.duration) || 4200);
    }

    function toast(title, message, type = 'info') {
        const region = $('toastRegion');
        if (!region) { notify(`${title}：${message}`, { type }); return; }
        const item = document.createElement('div');
        item.className = `toast ${type}`;
        item.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span><button type="button" class="toast-close" aria-label="关闭">×</button>`;
        region.appendChild(item);
        const close = () => item.remove();
        q('.toast-close', item).addEventListener('click', close);
        window.setTimeout(close, 5200);
    }

    function ensureDocumentId() {
        if (state.currentId) return state.currentId;
        state.currentId = state.store && state.store.makeId ? state.store.makeId('doc') : `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
        state.currentCreatedAt = Date.now();
        return state.currentId;
    }

    function currentRecord() {
        const now = Date.now();
        const name = (dom.name && dom.name.value.trim()) || '未命名';
        return {
            id: ensureDocumentId(), name, fileName: `${name}.md`, content: dom.input.value,
            createdAt: state.currentCreatedAt || now, updatedAt: now, lastOpenedAt: now,
            cursorStart: dom.input.selectionStart || 0, cursorEnd: dom.input.selectionEnd || 0,
            editorScrollTop: dom.input.scrollTop || 0, previewScrollTop: dom.preview ? dom.preview.scrollTop || 0 : 0,
            viewDesktop: storageGet('md2word.personal.view.desktop.v5.1') || 'split',
            viewMobile: storageGet('md2word.personal.view.mobile.v5.1') || 'editor',
            fileOrigin: 'draft', fileDirty: true
        };
    }

    function saveCurrent(options = {}) {
        if (!state.ready || !state.store || (!options.force && !isAutosaveEnabled())) return Promise.resolve(null);
        if (!dom.input.value.trim() && !state.currentId && !options.force) return Promise.resolve(null);
        const record = currentRecord();
        state.saveChain = state.saveChain.catch(() => null).then(async () => {
            const saved = await state.store.putDocument(record);
            state.currentId = saved.id; state.currentCreatedAt = saved.createdAt;
            await state.store.setMeta('lastDocumentId', saved.id);
            storageSet(LAST_DOCUMENT_KEY, saved.id);
            if (state.centerOpen) await refreshDocumentCenter();
            return saved;
        }).catch((error) => { state.workspaceError = String(error.message || error); console.warn('v5.5 文档保存失败', error); throw error; });
        return state.saveChain;
    }

    function scheduleSave() {
        window.clearTimeout(state.saveTimer);
        if (!isAutosaveEnabled()) return;
        state.saveTimer = window.setTimeout(() => saveCurrent().catch(() => toast('文档中心保存失败', '浏览器空间可能不足。', 'error')), 720);
    }

    async function createVersion(reason = '自动快照', options = {}) {
        if (!state.ready || !state.store || !state.settings.versionHistory) return null;
        const content = Object.prototype.hasOwnProperty.call(options, 'content') ? String(options.content || '') : dom.input.value;
        if (!content.trim()) return null;
        const version = await state.store.putVersion({
            documentId: ensureDocumentId(), documentName: (dom.name.value || '未命名').trim() || '未命名', content,
            reason, automatic: options.automatic !== false, createdAt: Date.now(),
            cursorStart: dom.input.selectionStart || 0, cursorEnd: dom.input.selectionEnd || 0
        }, { force: Boolean(options.force) });
        state.lastVersionAt = version.createdAt; state.lastVersionContent = content;
        if (state.centerOpen && state.selectedId === state.currentId) await selectDocumentForVersions(state.currentId);
        return version;
    }

    function maybeAutomaticVersion() {
        if (!state.settings.versionHistory || !dom.input.value.trim()) return;
        if (!state.lastVersionAt) { state.lastVersionAt = Date.now(); state.lastVersionContent = dom.input.value; return; }
        const elapsed = Date.now() - state.lastVersionAt;
        const delta = Math.abs(dom.input.value.length - state.lastVersionContent.length);
        if (elapsed >= AUTO_VERSION_INTERVAL && (delta >= AUTO_VERSION_CHANGE_THRESHOLD || elapsed >= AUTO_VERSION_INTERVAL * 2)) {
            createVersion('定期自动快照', { automatic: true }).catch(() => {});
        }
    }

    function setHeroCollapsed(collapsed) {
        document.body.classList.toggle('hero-collapsed', Boolean(collapsed));
        if (dom.heroButton) {
            dom.heroButton.setAttribute('aria-pressed', String(Boolean(collapsed)));
            dom.heroButton.title = collapsed ? '展开品牌标题区' : '收起品牌标题区';
        }
    }

    function applyHeroBehavior() {
        const behavior = state.settings.heroBehavior;
        if (behavior === 'expanded') setHeroCollapsed(false);
        else if (behavior === 'compact') setHeroCollapsed(true);
        else setHeroCollapsed(Boolean(dom.input && dom.input.value.trim()));
    }

    function toggleHeroCollapse() { setHeroCollapsed(!document.body.classList.contains('hero-collapsed')); }

    function renderDocumentList() {
        const current = state.currentId;
        dom.listCount.textContent = `${state.documents.length} 个`;
        dom.listEmpty.hidden = state.documents.length > 0;
        dom.list.innerHTML = state.documents.map((doc) => {
            const currentClass = doc.id === current ? ' current' : '';
            const selectedClass = doc.id === state.selectedId ? ' selected' : '';
            const preview = stripMarkdown(doc.content).slice(0, 150) || '空白文档';
            return `<article class="document-card${currentClass}${selectedClass}" role="listitem" data-document-id="${escapeHtml(doc.id)}">
                <div class="document-card-head"><h4>${escapeHtml(doc.name)}</h4>${doc.id === current ? '<span class="document-current-pill">当前</span>' : ''}</div>
                <p class="document-card-preview">${escapeHtml(preview)}</p>
                <div class="document-card-meta"><span>${formatRelativeTime(doc.updatedAt)}</span><span>${Number(doc.content.length).toLocaleString()} 字符</span></div>
                <div class="document-card-actions">
                    <button type="button" data-action="select-workspace-document" data-document-id="${escapeHtml(doc.id)}">版本</button>
                    <button type="button" data-action="open-workspace-document" data-document-id="${escapeHtml(doc.id)}">打开</button>
                    <button type="button" data-action="duplicate-workspace-document" data-document-id="${escapeHtml(doc.id)}">副本</button>
                    <button type="button" data-action="delete-workspace-document" data-document-id="${escapeHtml(doc.id)}">删除</button>
                </div></article>`;
        }).join('');
    }

    function renderVersionList() {
        dom.versionEmpty.hidden = state.versions.length > 0;
        dom.versionList.innerHTML = state.versions.map((version) => `<article class="version-card" role="listitem" data-version-id="${escapeHtml(version.id)}">
            <div><strong>${escapeHtml(version.reason)}</strong><p>${formatDateTime(version.createdAt)} · ${Number(version.size || version.content.length).toLocaleString()} 字符</p></div>
            <div class="version-card-preview">${escapeHtml(stripMarkdown(version.content).slice(0, 120) || '空白版本')}</div>
            <div class="version-card-actions"><button type="button" data-action="restore-workspace-version" data-version-id="${escapeHtml(version.id)}">恢复</button><button type="button" data-action="delete-workspace-version" data-version-id="${escapeHtml(version.id)}">删除</button></div>
        </article>`).join('');
    }

    async function refreshDocumentCenter() {
        if (!state.ready) return;
        state.documents = await state.store.listDocuments({ query: dom.search ? dom.search.value : '', limit: 200 });
        renderDocumentList();
        const diagnostics = await state.store.diagnostics();
        if (dom.centerStatus) dom.centerStatus.textContent = `${diagnostics.documents} 个文档 · ${diagnostics.versions} 个版本 · ${diagnostics.backend}`;
        await refreshDataOverview(diagnostics);
    }

    async function openDocumentCenter() {
        if (!state.ready) return toast('文档中心尚未就绪', state.workspaceError || '请稍后重试。', 'error');
        await saveCurrent({ force: Boolean(dom.input.value.trim() || state.currentId) }).catch(() => null);
        state.centerOpen = true;
        dom.centerLayer.hidden = false; dom.centerLayer.setAttribute('aria-hidden', 'false');
        document.body.classList.add('document-center-open');
        await refreshDocumentCenter();
        if (state.currentId) await selectDocumentForVersions(state.currentId, { silent: true });
        window.setTimeout(() => dom.search && dom.search.focus(), 30);
    }

    function closeDocumentCenter() {
        state.centerOpen = false; dom.centerLayer.hidden = true; dom.centerLayer.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('document-center-open');
    }

    async function selectDocumentForVersions(id, options = {}) {
        state.selectedId = id;
        const doc = await state.store.getDocument(id);
        state.versions = await state.store.listVersions(id, { limit: 30 });
        if (dom.versionName) dom.versionName.textContent = doc ? doc.name : '文档不存在';
        renderDocumentList(); renderVersionList();
        if (!options.silent) q('.version-list-panel')?.scrollIntoView({ block: 'nearest' });
    }

    async function loadWorkspaceDocument(id, options = {}) {
        const doc = await state.store.getDocument(id);
        if (!doc) return toast('文档不存在', '它可能已在其他标签页中删除。', 'error');
        if (!options.skipSave && state.currentId !== id) await saveCurrent({ force: Boolean(dom.input.value.trim() || state.currentId) }).catch(() => null);
        state.currentId = doc.id; state.currentCreatedAt = doc.createdAt; state.lastVersionAt = 0; state.lastVersionContent = doc.content;
        dom.name.value = doc.name; dom.name.dispatchEvent(new Event('input', { bubbles: true }));
        dom.input.value = doc.content; dom.input.dispatchEvent(new Event('input', { bubbles: true }));
        await state.store.setMeta('lastDocumentId', doc.id); storageSet(LAST_DOCUMENT_KEY, doc.id);
        window.setTimeout(() => { dom.input.selectionStart = clamp(doc.cursorStart || 0, 0, dom.input.value.length); dom.input.selectionEnd = clamp(doc.cursorEnd || doc.cursorStart || 0, 0, dom.input.value.length); dom.input.scrollTop = doc.editorScrollTop || 0; if (dom.preview) dom.preview.scrollTop = doc.previewScrollTop || 0; }, 80);
        closeDocumentCenter(); applyHeroBehavior(); document.dispatchEvent(new CustomEvent('md2word:document-changed', { detail: { id: doc.id } })); notify(`已打开“${doc.name}”。`);
    }

    async function newDocumentFromCenter() {
        await saveCurrent({ force: Boolean(dom.input.value.trim() || state.currentId) }).catch(() => null);
        state.currentId = null; state.currentCreatedAt = null; state.lastVersionAt = 0; state.lastVersionContent = '';
        closeDocumentCenter();
        state.transitionGuard = true; q('[data-action="new-document"]')?.click(); state.transitionGuard = false;
        applyHeroBehavior();
        document.dispatchEvent(new CustomEvent('md2word:document-changed', { detail: { id: null } }));
    }

    async function duplicateDocument(id) {
        const doc = await state.store.getDocument(id); if (!doc) return;
        const targetId = state.store.makeId('doc');
        const content = window.Md2WordAssets && typeof window.Md2WordAssets.duplicateDocumentAssets === 'function'
            ? await window.Md2WordAssets.duplicateDocumentAssets(doc.id, targetId, doc.content)
            : doc.content;
        const copy = { ...doc, id: targetId, content, name: `${doc.name} 副本`.slice(0, 80), fileName: `${doc.name} 副本.md`, createdAt: Date.now(), updatedAt: Date.now(), lastOpenedAt: Date.now() };
        await state.store.putDocument(copy); await refreshDocumentCenter(); notify('已创建文档副本，并复制关联图片素材。');
    }

    async function deleteDocument(id) {
        const doc = await state.store.getDocument(id); if (!doc) return;
        if (!window.confirm(`确认删除“${doc.name}”及其历史版本？`)) return;
        await state.store.deleteDocument(id);
        if (state.currentId === id) { state.currentId = null; state.currentCreatedAt = null; state.transitionGuard = true; q('[data-action="new-document"]')?.click(); state.transitionGuard = false; }
        if (state.selectedId === id) { state.selectedId = null; state.versions = []; dom.versionName.textContent = '选择一个文档查看恢复点'; renderVersionList(); }
        await refreshDocumentCenter(); notify('文档已从当前浏览器删除。');
    }

    async function restoreVersion(id) {
        const version = await state.store.getVersion(id); if (!version) return;
        if (dom.input.value.trim()) await createVersion('恢复历史版本前', { force: true, automatic: false }).catch(() => null);
        state.currentId = version.documentId; dom.name.value = version.documentName; dom.name.dispatchEvent(new Event('input', { bubbles: true }));
        dom.input.value = version.content; dom.input.dispatchEvent(new Event('input', { bubbles: true }));
        await saveCurrent({ force: true }); closeDocumentCenter(); notify(`已恢复“${version.reason}”。`);
    }

    async function deleteVersion(id) { if (!window.confirm('确认删除这个历史版本？')) return; await state.store.deleteVersion(id); if (state.selectedId) await selectDocumentForVersions(state.selectedId, { silent: true }); }

    function convertTsv(text) {
        const lines = String(text || '').trim().split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) return '';
        const rows = lines.map((line) => line.split('\t').map((cell) => cell.trim().replace(/\|/g, '\\|')));
        const width = Math.max(...rows.map((row) => row.length));
        if (width < 2 || !rows.every((row) => row.length === width)) return '';
        return [`| ${rows[0].join(' | ')} |`, `| ${rows[0].map(() => '---').join(' | ')} |`, ...rows.slice(1).map((row) => `| ${row.join(' | ')} |`)].join('\n');
    }

    function htmlToMarkdown(html) {
        const documentNode = new DOMParser().parseFromString(String(html || ''), 'text/html');
        function walk(node, context = {}) {
            if (node.nodeType === Node.TEXT_NODE) return node.nodeValue.replace(/\s+/g, ' ');
            if (node.nodeType !== Node.ELEMENT_NODE) return '';
            const tag = node.tagName.toLowerCase();
            const children = () => Array.from(node.childNodes).map((child) => walk(child, context)).join('');
            if (/^h[1-6]$/.test(tag)) return `${'#'.repeat(Number(tag[1]))} ${children().trim()}\n\n`;
            if (tag === 'p' || tag === 'div') return `${children().trim()}\n\n`;
            if (tag === 'br') return '\n';
            if (tag === 'strong' || tag === 'b') return `**${children().trim()}**`;
            if (tag === 'em' || tag === 'i') return `*${children().trim()}*`;
            if (tag === 'code' && node.parentElement?.tagName.toLowerCase() !== 'pre') return `\`${node.textContent}\``;
            if (tag === 'pre') return `\n\n\`\`\`\n${node.textContent.replace(/^\n|\n$/g, '')}\n\`\`\`\n\n`;
            if (tag === 'a') return `[${children().trim() || node.getAttribute('href')}](${node.getAttribute('href') || ''})`;
            if (tag === 'img') return `![${node.getAttribute('alt') || ''}](${node.getAttribute('src') || ''})`;
            if (tag === 'li') return `${context.ordered ? `${context.index || 1}.` : '-'} ${children().trim()}\n`;
            if (tag === 'ul' || tag === 'ol') return `${Array.from(node.children).map((child, index) => walk(child, { ordered: tag === 'ol', index: index + 1 })).join('')}\n`;
            if (tag === 'blockquote') return `${children().trim().split('\n').map((line) => `> ${line}`).join('\n')}\n\n`;
            if (tag === 'table') {
                const rows = Array.from(node.querySelectorAll('tr')).map((row) => Array.from(row.children).map((cell) => cell.textContent.trim().replace(/\|/g, '\\|')));
                if (!rows.length) return '';
                return `| ${rows[0].join(' | ')} |\n| ${rows[0].map(() => '---').join(' | ')} |\n${rows.slice(1).map((row) => `| ${row.join(' | ')} |`).join('\n')}\n\n`;
            }
            return children();
        }
        return walk(documentNode.body).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    function stripOuterMarkdownFence(text) {
        const match = String(text || '').trim().match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
        return match ? match[1].trim() : '';
    }

    function normalizeBareTex(text) {
        const trimmed = String(text || '').trim();
        if (!/^[(（][\s\S]+[)）]$/.test(trimmed) || !window.Md2WordMath?.isProbablyBareInlineLatex(trimmed.slice(1, -1))) return '';
        const result = typeof window.Md2WordMath.escapeLikelyPercentSigns === 'function' ? window.Md2WordMath.escapeLikelyPercentSigns(trimmed) : { text: trimmed.replace(/(?<=\d)%/g, '\\%') };
        const escaped = typeof result === 'string' ? result : String(result && result.text || trimmed);
        return `\\(${escaped}\\)`;
    }

    function analyzeSmartPaste(plainText, htmlText = '') {
        const plain = String(plainText || '');
        const fenced = stripOuterMarkdownFence(plain);
        if (fenced) return { type: 'markdown-fence', confidence: 'high', title: '检测到 Markdown 代码围栏', detail: '可以移除最外层围栏，直接作为文档内容插入。', original: plain, transformed: fenced };
        const table = convertTsv(plain);
        if (table) return { type: 'table', confidence: 'high', title: '检测到表格数据', detail: '可以转换为 Markdown 表格。', original: plain, transformed: table };
        const bare = normalizeBareTex(plain);
        if (bare) return { type: 'tex', confidence: 'high', title: '检测到裸行内公式', detail: '可以补充公式边界并修正数值百分号。', original: plain, transformed: bare };
        if (htmlText && /<(?:h[1-6]|p|strong|em|ul|ol|table|a)\b/i.test(htmlText)) {
            const markdown = htmlToMarkdown(htmlText);
            if (markdown && markdown !== plain.trim()) return { type: 'rich', confidence: 'medium', title: '检测到富文本', detail: '可以保留标题、粗体、列表、链接和表格语义。', original: plain, transformed: markdown };
        }
        return null;
    }

    function insertAtSelection(value) {
        const start = dom.input.selectionStart || 0, end = dom.input.selectionEnd || start;
        dom.input.setRangeText(String(value), start, end, 'end'); dom.input.dispatchEvent(new Event('input', { bubbles: true })); dom.input.focus();
    }

    function showPasteSuggestion(analysis) {
        state.pendingPaste = analysis; dom.smartTitle.textContent = analysis.title; dom.smartDetail.textContent = analysis.detail; dom.smartBar.hidden = false;
    }
    function dismissPaste() { state.pendingPaste = null; dom.smartBar.hidden = true; }
    function applyPaste(transformed = true) { if (!state.pendingPaste) return; insertAtSelection(transformed ? state.pendingPaste.transformed : state.pendingPaste.original); notify(transformed ? '已按建议转换并插入。' : '已保留原始粘贴内容。'); dismissPaste(); }

    function onPaste(event) {
        if (state.settings.smartPasteMode === 'plain' || event.defaultPrevented) return;
        const clipboard = event.clipboardData; if (!clipboard) return;
        const plain = clipboard.getData('text/plain'); const html = clipboard.getData('text/html');
        const analysis = analyzeSmartPaste(plain, html); if (!analysis) return;
        event.preventDefault();
        if (state.settings.smartPasteMode === 'auto' && analysis.confidence === 'high') { insertAtSelection(analysis.transformed); notify(`智能粘贴：${analysis.title.replace('检测到', '已处理')}`, { duration: 3200 }); }
        else showPasteSuggestion(analysis);
    }

    function getDependencyStatuses() {
        return [
            { label: 'Marked', ok: Boolean(window.marked?.parse), detail: 'Markdown 解析' },
            { label: 'DOMPurify', ok: Boolean(window.DOMPurify?.sanitize), detail: '预览净化' },
            { label: 'KaTeX', ok: Boolean(window.katex?.renderToString), detail: '公式渲染' },
            { label: '公式引擎', ok: Boolean(window.Md2WordMath), detail: '边界保护' },
            { label: '导出检查', ok: Boolean(window.Md2WordPreflight?.analyze), detail: '兼容性检查' },
            { label: 'docx.js', ok: Boolean(window.docx), detail: 'Word 生成' },
            { label: 'FileSaver', ok: typeof window.saveAs === 'function', detail: '浏览器下载' },
            { label: '文档中心', ok: state.ready, detail: state.store ? state.store.backendName : '未就绪' }
        ];
    }

    function renderDependencyStatuses() {
        if (!dom.dependencyList) return;
        dom.dependencyList.innerHTML = getDependencyStatuses().map((item) => `<div class="dependency-status-item${item.ok ? ' ok' : ''}"><span><i></i>${escapeHtml(item.label)}</span><small>${escapeHtml(item.ok ? item.detail : '未加载')}</small></div>`).join('');
    }

    async function refreshDataOverview(existing) {
        if (!state.ready || !state.store) return;
        const info = existing || await state.store.diagnostics();
        if (dom.dataDocumentCount) dom.dataDocumentCount.textContent = Number(info.documents || 0).toLocaleString();
        if (dom.dataVersionCount) dom.dataVersionCount.textContent = Number(info.versions || 0).toLocaleString();
        if (dom.dataAssetCount) dom.dataAssetCount.textContent = Number(info.assets || 0).toLocaleString();
        if (dom.dataStorageSize) dom.dataStorageSize.textContent = formatBytes(info.approximateBytes || 0);
        if (dom.dataStorageBackend) dom.dataStorageBackend.textContent = info.backend || '存储状态';
        renderDependencyStatuses();
    }

    async function exportWorkspaceBackup() {
        if (!state.ready) return;
        await saveCurrent({ force: Boolean(dom.input.value.trim() || state.currentId) }).catch(() => null);
        const workspace = await state.store.exportAll();
        const ai = safeParse(storageGet(AI_KEY), {}) || {};
        if (!dom.includeApiKey?.checked) delete ai.key;
        const payload = { schema: 'md2word-fusion-backup', version: VERSION, exportedAt: Date.now(), app: { name: 'Markdown 转 Word', version: VERSION }, settings: safeParse(storageGet(BASE_SETTINGS_KEY), {}) || {}, workflowSettings: { ...state.settings }, ai, workspace };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
        const name = `markdown-to-word-backup-${new Date().toISOString().slice(0, 10)}.json`;
        if (typeof window.saveAs === 'function') window.saveAs(blob, name); else { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); }
        notify(`完整备份已生成：${workspace.documents.length} 个文档，${workspace.versions.length} 个版本。`, { duration: 5200 });
    }

    function chooseBackup() { dom.backupInput.value = ''; dom.backupInput.click(); }
    async function importBackupPayload(payload, sourceName = '备份文件') {
        const workspace = payload?.schema === 'md2word-fusion-backup' ? payload.workspace : payload;
        if (!workspace || workspace.schema !== 'md2word-workspace-backup' || !Array.isArray(workspace.documents) || !Array.isArray(workspace.versions)) throw new Error('备份格式不受支持');
        if (JSON.stringify(workspace).length > MAX_BACKUP_BYTES) throw new Error('备份内容超过 50 MB');
        if (!window.confirm(`将从“${sourceName}”导入 ${workspace.documents.length} 个文档和 ${workspace.versions.length} 个版本，是否继续？`)) return;
        await saveCurrent({ force: Boolean(dom.input.value.trim() || state.currentId) }).catch(() => null);
        await state.store.importAll(workspace, { replace: false });
        if (payload.workflowSettings) { state.settings = { ...DEFAULTS, ...payload.workflowSettings }; storageSet(SETTINGS_KEY, JSON.stringify(state.settings)); populateWorkflowSettings(); applyHeroBehavior(); }
        await refreshDocumentCenter(); await refreshDataOverview(); notify(`备份导入完成：${workspace.documents.length} 个文档，${workspace.versions.length} 个版本。`, { duration: 5800 });
    }
    function onBackupFile(event) {
        const file = event.target.files && event.target.files[0]; if (!file) return;
        if (file.size > MAX_BACKUP_BYTES) return toast('备份文件过大', '请选择不超过 50 MB 的 JSON 文件。', 'error');
        const reader = new FileReader(); reader.onerror = () => toast('备份读取失败', '浏览器无法读取所选文件。', 'error');
        reader.onload = async () => { try { await importBackupPayload(JSON.parse(String(reader.result || '')), file.name); } catch (error) { toast('备份导入失败', error.message || String(error), 'error'); } };
        reader.readAsText(file, 'utf-8');
    }

    function buildDiagnosticsReport() {
        let report = null; try { report = window.Md2WordCore?.buildExportReport?.() || window.__MD2WORD__?.buildExportReport?.(); } catch (_error) { report = null; }
        const statuses = getDependencyStatuses();
        const formulaText = $('mathStatusText')?.textContent || '公式状态不可用';
        return [
            '# Markdown 转 Word 诊断报告', '',
            `- 应用版本：${VERSION}`, `- 生成时间：${new Date().toLocaleString('zh-CN')}`, `- 浏览器：${navigator.userAgent}`,
            `- 主题：${document.documentElement.dataset.theme || '未知'}`, `- 文档中心后端：${state.store ? state.store.backendName : '未加载'}`, `- 文档中心状态：${state.workspaceError || state.workspaceNotice || '正常'}`, `- 图片素材：${state.store ? (state.store.diagnostics ? '见存储统计' : '未知') : '未加载'}`, '',
            '## 当前文档', `- ID：${state.currentId || '未建立'}`, `- 名称：${dom.name.value || '未命名'}`, `- 字符：${dom.input.value.length}`, `- 行数：${dom.input.value ? dom.input.value.split('\n').length : 0}`, `- ${formulaText}`, `- 导出错误：${report?.errorCount || 0}`, `- 导出提醒：${report?.warningCount || 0}`, '',
            '## 依赖状态', ...statuses.map((item) => `- ${item.label}：${item.ok ? '已加载' : '不可用'}（${item.detail}）`), '',
            '> 报告不包含 API Key、访问密码和文档正文。'
        ].join('\n');
    }

    async function copyText(text) {
        if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
        const area = document.createElement('textarea'); area.value = text; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
    }
    async function copyDiagnostics() { try { await copyText(buildDiagnosticsReport()); notify('诊断报告已复制，不包含 API Key、密码或文档正文。', { duration: 5000 }); } catch (error) { toast('复制诊断失败', error.message || String(error), 'error'); } }

    async function clearWorkspaceData() {
        if (!window.confirm('确认清除当前浏览器中的全部文档和历史版本？此操作无法撤销。')) return;
        window.clearTimeout(state.saveTimer); await state.saveChain.catch(() => null); await state.store.clearAll();
        state.currentId = null; state.currentCreatedAt = null; state.documents = []; state.versions = []; state.selectedId = null;
        storageRemove(LAST_DOCUMENT_KEY); storageRemove(LEGACY_AUTOSAVE_KEY);
        dom.input.value = ''; dom.input.dispatchEvent(new Event('input', { bubbles: true })); dom.name.value = '未命名'; dom.name.dispatchEvent(new Event('input', { bubbles: true }));
        await refreshDocumentCenter(); notify('全部本地文档和历史版本已清除。');
    }

    function closeReceipt() { clearTimeout(state.receiptTimer); dom.receipt.hidden = true; }
    function showReceipt(details = {}) {
        if (!dom.receipt) return;
        clearTimeout(state.receiptTimer);
        dom.receiptFile.textContent = details.fileName || '未命名.docx';
        const professional = window.Md2WordProfessional?.normalizeSettings?.(window.Md2WordCore?.getSettings?.() || {}) || {};
        const tocNote = professional.tocEnabled ? ' 自动目录首次打开后请在 Word / WPS 中更新域。' : '';
        dom.receiptSummary.textContent = (details.warningCount ? `已交给浏览器下载，并保留 ${details.warningCount} 项兼容性提醒。` : '已交给浏览器下载，导出前检查通过。') + tocNote;
        const metrics = [`公式 ${details.mathCount || 0}`, `表格 ${details.tableCount || 0}`, `图片 ${details.imageCount || 0}`, professional.coverEnabled ? '含封面' : '', professional.tocEnabled ? '含目录' : '', formatBytes(details.bytes || 0), `${Math.max(1, details.duration || 1)} ms`].filter(Boolean);
        dom.receiptMetrics.innerHTML = metrics.map((item) => `<span>${escapeHtml(item)}</span>`).join(''); dom.receipt.hidden = false;
        state.receiptTimer = setTimeout(closeReceipt, 9000);
    }
    function patchSaveAs() {
        const original = window.saveAs; if (typeof original !== 'function' || original.__v55Wrapped) return;
        const wrapped = function (blob, name, ...rest) {
            const result = original.call(this, blob, name, ...rest);
            if (/\.docx$/i.test(String(name || ''))) setTimeout(() => {
                let report = null; try { report = window.Md2WordCore?.buildExportReport?.() || window.__MD2WORD__?.buildExportReport?.(); } catch (_error) {}
                showReceipt({ fileName: name, warningCount: report?.warningCount || 0, mathCount: dom.preview.querySelectorAll('.katex').length, tableCount: dom.preview.querySelectorAll('table').length, imageCount: dom.preview.querySelectorAll('img').length, bytes: blob?.size || 0, duration: Math.round(performance.now() - (state.exportStartedAt || performance.now())) });
            }, 40);
            return result;
        };
        wrapped.__v55Wrapped = true; wrapped.__original = original; window.saveAs = wrapped;
    }

    async function initializeWorkspace() {
        if (!window.Md2WordWorkspaceStore) { state.workspaceError = '文档中心模块未加载'; return; }
        state.store = window.Md2WordWorkspaceStore; await state.store.ready(); state.ready = true;
        const migration = await state.store.getMeta('migration.v5.3').catch(() => null);
        if (migration && migration.documents > 0) {
            state.workspaceNotice = `已从 v5.3 迁移 ${migration.documents} 个文档和 ${migration.versions || 0} 个版本`;
        }
        let docs = await state.store.listDocuments({ limit: 200 });
        if (!docs.length) {
            const legacy = safeParse(storageGet(LEGACY_AUTOSAVE_KEY), null);
            if (legacy && typeof legacy.content === 'string' && legacy.content.trim()) {
                const name = String(legacy.documentName || '恢复的草稿').slice(0, 80);
                await state.store.putDocument({ name, fileName: legacy.fileName || `${name}.md`, content: legacy.content, updatedAt: legacy.updatedAt || Date.now(), createdAt: legacy.updatedAt || Date.now(), fileOrigin: 'legacy-autosave' });
                docs = await state.store.listDocuments({ limit: 200 }); state.workspaceNotice = '已将旧版单草稿迁移到文档中心';
            }
        }
        state.documents = docs;
        if (dom.input.value.trim()) {
            const match = docs.find((doc) => doc.content === dom.input.value && doc.name === dom.name.value) || null;
            if (match) { state.currentId = match.id; state.currentCreatedAt = match.createdAt; }
        } else if (getBaseSettings().restoreDraftOnStart === true && docs.length) {
            const preferredId = storageGet(LAST_DOCUMENT_KEY) || await state.store.getMeta('lastDocumentId').catch(() => null) || storageGet('md2word.workflow.current.v5.3');
            const preferred = docs.find((doc) => doc.id === preferredId) || docs[0];
            if (preferred && preferred.content.trim()) await loadWorkspaceDocument(preferred.id, { skipSave: true });
        }
        await refreshDataOverview(); applyHeroBehavior();
    }

    function handleAction(event) {
        const button = event.target.closest('[data-action]'); if (!button) return;
        const action = button.dataset.action;
        const id = button.dataset.documentId || button.closest('[data-document-id]')?.dataset.documentId;
        const versionId = button.dataset.versionId || button.closest('[data-version-id]')?.dataset.versionId;
        const handlers = {
            'open-document-center': openDocumentCenter, 'close-document-center': closeDocumentCenter,
            'refresh-document-center': refreshDocumentCenter, 'new-document-from-center': newDocumentFromCenter,
            'select-workspace-document': () => selectDocumentForVersions(id), 'open-workspace-document': () => loadWorkspaceDocument(id),
            'duplicate-workspace-document': () => duplicateDocument(id), 'delete-workspace-document': () => deleteDocument(id),
            'restore-workspace-version': () => restoreVersion(versionId), 'delete-workspace-version': () => deleteVersion(versionId),
            'apply-smart-paste': () => applyPaste(true), 'insert-smart-paste-plain': () => applyPaste(false), 'dismiss-smart-paste': dismissPaste,
            'toggle-hero-collapse': toggleHeroCollapse, 'export-workspace-backup': exportWorkspaceBackup,
            'import-workspace-backup': chooseBackup, 'copy-diagnostics': copyDiagnostics, 'refresh-diagnostics': () => refreshDataOverview(),
            'clear-workspace-data': clearWorkspaceData, 'close-export-receipt': closeReceipt,
            'copy-export-filename': () => copyText(dom.receiptFile.textContent).then(() => notify('Word 文件名已复制。')),
            'open-data-settings': () => { closeDocumentCenter(); $('settingsButton')?.click(); setTimeout(() => window.__MD2WORD__?.activateSettingsTab?.('data', { focus: true }), 40); }
        };
        if (handlers[action]) { event.preventDefault(); event.stopPropagation(); Promise.resolve(handlers[action]()).catch((error) => toast('操作失败', error.message || String(error), 'error')); }
    }

    function captureDestructiveAction(event) {
        const button = event.target.closest('[data-action]'); if (!button || state.transitionGuard) return;
        const action = button.dataset.action;
        if (action === 'download-word') state.exportStartedAt = performance.now();
        if (action === 'clear-document') createVersion('清空前', { force: true, automatic: false }).catch(() => {});
        if (action === 'apply-ai-result') createVersion('AI 应用前', { force: true, automatic: false }).catch(() => {});
        if (action === 'new-document') {
            saveCurrent({ force: Boolean(dom.input.value.trim() || state.currentId) }).catch(() => {});
            setTimeout(() => { state.currentId = null; state.currentCreatedAt = null; state.lastVersionAt = 0; state.lastVersionContent = ''; applyHeroBehavior(); }, 0);
        }
    }

    function bind() {
        dom.input.addEventListener('input', () => { scheduleSave(); maybeAutomaticVersion(); applyHeroBehavior(); });
        dom.name.addEventListener('input', scheduleSave);
        dom.input.addEventListener('paste', onPaste, true);
        dom.search?.addEventListener('input', (() => { let timer; return () => { clearTimeout(timer); timer = setTimeout(refreshDocumentCenter, 220); }; })());
        dom.backupInput?.addEventListener('change', onBackupFile);
        dom.settingsForm?.addEventListener('submit', () => { saveWorkflowSettings(); setTimeout(refreshDataOverview, 60); });
        document.addEventListener('click', handleAction);
        document.addEventListener('click', captureDestructiveAction, true);
        document.addEventListener('keydown', (event) => {
            const mod = event.ctrlKey || event.metaKey;
            if (mod && event.shiftKey && event.key.toLowerCase() === 'o') { event.preventDefault(); openDocumentCenter(); }
            if (event.key === 'Escape' && state.centerOpen) { event.preventDefault(); closeDocumentCenter(); }
        });
    }

    async function initialize() {
        cacheDom(); loadWorkflowSettings(); bind(); patchSaveAs();
        await initializeWorkspace();
    }

    window.Md2WordWorkflow = Object.freeze({
        openDocumentCenter, closeDocumentCenter, refreshDocumentCenter, loadWorkspaceDocument,
        saveCurrent, createVersion, analyzeSmartPaste, htmlToMarkdown, stripOuterMarkdownFence,
        exportWorkspaceBackup, importBackupPayload, buildDiagnosticsReport, showReceipt,
        setHeroCollapsed, applyHeroBehavior, getState: () => ({ ...state }), version: VERSION
    });

    window.addEventListener('DOMContentLoaded', () => initialize().catch((error) => { console.error('v5.5 工作流初始化失败', error); toast('工作流初始化失败', error.message || String(error), 'error'); }), { once: true });
}());
