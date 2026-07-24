(function () {
    'use strict';

    // 纯前端个人版访问配置。按需直接修改此文件即可。
    window.MD2WORD_ACCESS = Object.freeze({
        sessionKey: 'md2word.fusion.auth.v5.1',
        users: Object.freeze({
            basic123: Object.freeze({
                level: 'basic',
                name: '基础用户',
                icon: '🆓',
                label: '基础版'
            }),
            '517517': Object.freeze({
                level: 'advanced',
                name: '高级用户',
                icon: '⭐',
                label: '高级版'
            }),
            lingling: Object.freeze({
                level: 'super_admin',
                name: '超级管理员',
                icon: '👑',
                label: '管理版'
            })
        })
    });
})();
