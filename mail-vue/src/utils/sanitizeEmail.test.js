import { describe, it, expect } from 'vitest'
import { sanitizeEmail } from './sanitizeEmail'

/**
 * F003 攻击载荷矩阵验证（spec AC-1）
 *
 * 6 类载荷样本逐条断言：事件属性剥离 / javascript: 剥离 / 危险标签移除 /
 * 外链 rel 注入 / 远程图降级。样本兼作回归网（F005）。
 */
describe('sanitizeEmail · 攻击载荷矩阵（F003 AC-1）', () => {
    it('P1: <img onerror> 事件属性被剥离', () => {
        const out = sanitizeEmail('<img src="x" onerror="alert(1)">')
        expect(out).not.toMatch(/onerror/i)
        expect(out).not.toMatch(/alert/)
    })

    it('P2: <svg onload> 事件属性被剥离', () => {
        const out = sanitizeEmail('<svg onload="alert(1)"><circle r="10"/></svg>')
        expect(out).not.toMatch(/onload/i)
        expect(out).not.toMatch(/alert/)
    })

    it('P3: <a href="javascript:"> 被剥离', () => {
        const out = sanitizeEmail('<a href="javascript:alert(1)">x</a>')
        expect(out).not.toMatch(/javascript:/i)
    })

    it('P4: 危险标签 iframe/form/object/embed 被移除', () => {
        const out = sanitizeEmail(
            '<iframe src="//evil"></iframe><form action="/x"></form><object data="x"></object><embed src="x">'
        )
        expect(out).not.toMatch(/<iframe/i)
        expect(out).not.toMatch(/<form/i)
        expect(out).not.toMatch(/<object/i)
        expect(out).not.toMatch(/<embed/i)
    })

    it('P5: 邮件 <style> 块保留（D-5 决策）', () => {
        const out = sanitizeEmail('<style>.a{color:red}</style><p class="a">hi</p>')
        expect(out).toMatch(/<style>/i)
        expect(out).toMatch(/\.a\{color:red\}/)
    })

    it('P6: 远程图片被阻断（src 置空 + data-orig-src + cm-blocked-img）', () => {
        const out = sanitizeEmail('<img src="https://tracker.example.com/pixel.gif">')
        // src 被移除（注意避免误匹配 data-orig-src 中的 "src" 子串）
        expect(out).not.toMatch(/\ssrc="https:\/\/tracker/i)
        expect(out).toMatch(/data-orig-src="https:\/\/tracker\.example\.com\/pixel\.gif"/)
        expect(out).toMatch(/cm-blocked-img/)
    })
})

describe('sanitizeEmail · 外链与图片防线（F003 AC-2/AC-3）', () => {
    it('外链强制 target=_blank + rel=noopener noreferrer', () => {
        const out = sanitizeEmail('<a href="https://example.com">外链</a>')
        expect(out).toMatch(/target="_blank"/)
        expect(out).toMatch(/rel="noopener noreferrer"/)
    })

    it('cid: 内联附件图不受影响（不阻断）', () => {
        const out = sanitizeEmail('<img src="cid:image001@example">')
        expect(out).toMatch(/src="cid:image001@example"/)
        expect(out).not.toMatch(/cm-blocked-img/)
    })

    it('srcset 属性被移除（远程图旁路隔离）', () => {
        const out = sanitizeEmail('<img src="https://a.com/x.png" srcset="https://a.com/x2.png 2x">')
        expect(out).not.toMatch(/srcset/i)
    })

    it('内联样式与表格布局保留（渲染保真 US3）', () => {
        const out = sanitizeEmail('<table><tr><td style="background:#fff">单元格</td></tr></table>')
        expect(out).toMatch(/<table>/i)
        expect(out).toMatch(/style="background:#fff"/)
    })
})
