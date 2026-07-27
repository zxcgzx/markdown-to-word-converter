'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const assets = require('../js/assets.js');

test('v5.4 asset references avoid network requests and retain stable document IDs', () => {
    const html = assets.makeAssetReference({ id: 'asset one', name: '实验 图.png', alt: '实验图' }, { widthMode: 'medium' });
    assert.match(html, /src="data:image\/gif;base64,/);
    assert.match(html, /data-md2word-asset="asset one"/);
    assert.match(html, /data-md2word-asset-src="md2word-assets\/asset%20one"/);
    assert.match(html, /width="480"/);
    assert.deepEqual(assets.extractAssetIds(html), ['asset one']);
});

test('asset ID extraction stays compatible with old URL references and new data attributes', () => {
    const markdown = [
        '<img src="md2word-assets/old%20id" alt="旧图">',
        '<img src="data:image/gif;base64,AAAA" data-md2word-asset="new-id">',
        '![兼容](md2word-assets/third-id)'
    ].join('\n');
    assert.deepEqual(new Set(assets.extractAssetIds(markdown)), new Set(['old id', 'new-id', 'third-id']));
});

test('asset references can be rewritten and removed without disturbing surrounding Markdown', () => {
    const source = `段落前\n\n${assets.makeAssetReference('old-id', { alt: '图' })}\n\n段落后`;
    const rewritten = assets.replaceAssetId(source, 'old-id', 'new-id');
    assert.ok(rewritten.includes('data-md2word-asset="new-id"'));
    assert.ok(rewritten.includes('md2word-assets/new-id'));
    assert.ok(!rewritten.includes('old-id'));
    const removed = assets.removeAssetReferences(rewritten, 'new-id');
    assert.equal(removed.trim(), '段落前\n\n段落后');
});

test('data URL bytes decode deterministically for Word image runs', () => {
    assert.deepEqual(Array.from(assets.dataUrlToBytes('data:image/png;base64,AQIDBA==')), [1, 2, 3, 4]);
    assert.equal(assets.parseAssetId('https://example.test/md2word-assets/a%20b?x=1'), 'a b');
    assert.equal(assets.parseAssetId('data:image/png;base64,AAAA'), '');
});

test('file picker snapshots the live FileList before clearing the input', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'assets.js'), 'utf8');
    assert.match(source, /const files = Array\.from\(event\.target\.files \|\| \[\]\);\s*event\.target\.value = '';/);
});
