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

/**
 * B1 回归网 · style 块提取的 mXSS 绕过（2026-09-30 安全修复）
 *
 * 旧实现用正则只认字面 `</style>`，而 HTML 规范中 <style> 是 RAWTEXT 元素——
 * `</style x>`（后跟空白/斜杠）即闭合元素，使后续内容逃出样式块成为活动 HTML。
 *
 * 修复为三层：a) 正则按 RAWTEXT 语义闭合；b) CSS 文本二次纯文本消毒；
 * c) 封 @import 远程通道 + svg/math 入 FORBID_TAGS。
 *
 * 断言设计说明（重要）：
 * 仅断言「输出不含 onerror」无法区分 a/b 两层——即使正则回退，b 层纯文本消毒
 * 也能兜住 onerror，导致测试假绿。因此额外断言**结构语义**：
 * 恶意 payload 之后的合法标签必须被留在主体中，而不是被整段吞进 CSS。
 */
describe('sanitizeEmail · style 块 mXSS 绕过防护（B1 回归）', () => {
    /** 用真实 HTML 解析器检查输出里是否残留活动事件属性 */
    const hasActiveHandler = (html) => {
        const root = document.createElement('div')
        root.innerHTML = html
        return root.querySelectorAll('[onerror], [onload], [onclick]').length > 0
    }

    /** 抽取输出中 <style> 块的文本内容（用于断言 CSS 里不夹带 HTML 标签） */
    const cssTextOf = (html) => {
        const root = document.createElement('div')
        root.innerHTML = html
        return Array.from(root.querySelectorAll('style'))
            .map((s) => s.textContent)
            .join('\n')
    }

    it('B1-a: `</style x>` 闭合绕过被阻断（不带空格的主 payload）', () => {
        const out = sanitizeEmail('<style>css</style x><img src=x onerror=alert(1)></style>')
        expect(out).not.toMatch(/onerror/i)
        expect(hasActiveHandler(out)).toBe(false)
    })

    it('B1-a2: 结构语义正确——payload 后的合法标签留在主体，不被吞进 CSS', () => {
        const out = sanitizeEmail('<style>body{color:red}</style x><p>正文</p></style>')
        // payload 之后的 <p> 必须作为主体元素存在（旧正则会把它整段吞进 CSS 而丢失）
        const root = document.createElement('div')
        root.innerHTML = out
        expect(root.querySelector('p')).not.toBeNull()
        expect(root.textContent).toContain('正文')
        // CSS 侧不应夹带 HTML 标签
        expect(cssTextOf(out)).not.toMatch(/<p/i)
    })

    it('B1-b: `</style/>` 斜杠闭合绕过被阻断', () => {
        const out = sanitizeEmail('<style>a{}</style/><img src=x onerror=alert(1)>')
        expect(out).not.toMatch(/onerror/i)
        expect(hasActiveHandler(out)).toBe(false)
    })

    it('B1-c: `</style foo="bar">` 属性注入闭合被阻断', () => {
        const out = sanitizeEmail('<style>a{}</style foo="bar"><img src=x onerror=alert(1)>')
        expect(out).not.toMatch(/onerror/i)
        expect(hasActiveHandler(out)).toBe(false)
    })

    it('B1-d: style 内夹带闭合标签被阻断', () => {
        const out = sanitizeEmail('<style>p{}</style></style><img src=x onerror=alert(1)>')
        expect(out).not.toMatch(/onerror/i)
        expect(hasActiveHandler(out)).toBe(false)
    })

    it('B1-e: 正常样式块仍完整保留（修复不误伤渲染保真）', () => {
        const out = sanitizeEmail('<style>.a{color:red}</style><p class="a">hi</p>')
        expect(out).toMatch(/<style>/i)
        expect(out).toMatch(/\.a\{color:red\}/)
    })

    it('B1-f: CSS @import 远程加载通道被剥离', () => {
        const out = sanitizeEmail('<style>@import url("http://evil.example/x.css");</style><p>x</p>')
        expect(out).not.toMatch(/@import/i)
    })

    it('B1-g: svg / math 标签被移除（缩攻击面）', () => {
        const out = sanitizeEmail('<svg onload="alert(1)"></svg><math><mtext>x</mtext></math>')
        expect(out).not.toMatch(/<svg/i)
        expect(out).not.toMatch(/<math/i)
        expect(out).not.toMatch(/onload/i)
    })
})
