import DOMPurify from 'dompurify'

/**
 * 邮件正文消毒工具（F003）
 *
 * 邮件 HTML 是本应用最大的外部攻击面：任何发件人都能投递任意 HTML。
 * Shadow DOM 只隔离样式，不是安全边界——注入内容的事件属性、javascript: URI
 * 等全部存活。本模块负责在 innerHTML 之前完成白名单消毒与图片防线。
 *
 * 决策依据（见 F003 spec）：
 * - D-5：保留邮件 <style> 块（shadow 内隔离无法越界），剥离事件属性 / javascript: URI / 危险标签
 * - D-6：远程图片默认阻断（占位 + 点击加载），不做代理中转
 *
 * ⚠️ 实施勘误（2026-09-29，实证）：
 * 1. 禁用 `USE_PROFILES: { html: true }`——实测在该 profile 下 DOMPurify 会**剥离 <table> 标签本身**
 *    （邮件大量依赖 table 布局，会破坏渲染保真）。改用显式 FORBID_TAGS + ADD_ATTR。
 * 2. `ADD_TAGS: ['style']` 不足以保留**顶层** <style>：DOMPurify 仍会剥离顶层样式块。
 *    改为「提取 style 块 → 消毒其余 → 拼回」流程（style 内容处于 shadow DOM 内，无法越界）。
 * 3. 测试环境须用 jsdom，**不能用 happy-dom**——实测 happy-dom 下 DOMPurify 会误剥 <a>/<img>
 *    （F005 spec 指定 happy-dom 系选型失误，已改用 jsdom）。
 *
 * 🛡️ 安全修复（2026-09-30，B1 · mXSS 绕过）：
 * 原正则 `/<style\b[^>]*>[\s\S]*?<\/style>/gi` 只认字面 `</style>`，但 HTML 规范中
 * <style> 是 RAWTEXT 元素——浏览器遇到 `</style` 后跟空白/斜杠即闭合元素。攻击者可构造：
 *
 *     <style>css</style x><img src=x onerror=alert(1)></style>
 *
 * 该串被旧正则整体认作一个 style 块**原样放行**，浏览器却在 `</style x>` 处闭合样式，
 * 使 `<img onerror>` 成为活动元素并执行——DOMPurify 完全没碰到它。
 *
 * 三层修复：
 *   a) 正则改为 RAWTEXT 语义闭合：`<\/style[\s/>][^>]*>`（`</style` 后跟空白/斜杠/`>` 均算闭合）；
 *   b) 提取出的 CSS 文本再做**二次纯文本消毒**（ALLOWED_TAGS: []），夹带标签全剥；
 *   c) 封 CSS 远程加载通道（`@import`），并在 FORBID_TAGS 增补 svg/math 缩攻击面。
 *
 * ⚠️ 注意：任何「用正则解析 HTML」的方案都只是纵深防御的一层。真正的边界是
 * DOMPurify + 规范解析器；本模块的样式保留属于渲染保真需求带来的**受控例外**。
 */

/** 危险标签：可执行脚本或嵌入外部内容，直接禁止（svg/math 邮件场景几乎不用，关闭以缩攻击面） */
const FORBID_TAGS = ['iframe', 'form', 'object', 'embed', 'script', 'svg', 'math']

/** 保留的属性：内联样式 / 外链安全属性 / 图片原址标记 / 类名 */
const ADD_ATTR = ['style', 'target', 'data-orig-src', 'class']

/**
 * 匹配 <style> 块 —— 按 HTML RAWTEXT 语义闭合。
 * `</style` 后跟空白 / 斜杠 / `>` 均视为结束标签（不再只认字面 `</style>`），
 * 从而封堵 `</style x>` 这类绕过。见头部「安全修复 B1」。
 */
const STYLE_BLOCK_RE = /<style\b[^>]*>[\s\S]*?<\/style[\s/>][^>]*>/gi

/** 从完整 style 块中取出 CSS 文本（去掉首尾标签） */
const extractCssText = (block) => block.replace(/^<style\b[^>]*>/i, '').replace(/<\/style[\s/>][^>]*>$/i, '')

/** CSS 远程加载通道：@import 可拉取外部样式表（追踪像素的 CSS 变体），一律剥离 */
const CSS_IMPORT_RE = /@import[^;]*;?/gi

/** 判断是否为需要阻断的远程图片（http(s) 协议，排除 cid: 内联附件图） */
const isRemoteImg = (src) => /^https?:\/\//i.test((src || '').trim())

/**
 * 注册 DOMPurify 钩子：外链安全属性 + 远程图片阻断。
 * DOMPurify.addHook 是全局副作用，用模块级布尔位保证幂等。
 */
let hooksRegistered = false
function ensureHooks() {
    if (hooksRegistered) return
    hooksRegistered = true

    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
        // 外链：强制新窗口打开 + 切断 opener 引用（防 tabnabbing）
        if (node.tagName === 'A') {
            node.setAttribute('target', '_blank')
            node.setAttribute('rel', 'noopener noreferrer')
        }

        // 远程图片：阻断加载 + 存原地址 + 标记类名，点击后由组件还原
        if (node.tagName === 'IMG') {
            const src = node.getAttribute('src')
            if (isRemoteImg(src)) {
                node.setAttribute('data-orig-src', src)
                node.removeAttribute('src')
                node.classList.add('cm-blocked-img')
            }
            // srcset 同样能触发远程请求，一并阻断
            if (node.hasAttribute('srcset')) {
                node.removeAttribute('srcset')
            }
        }
    })
}

/**
 * 消毒邮件 HTML。
 *
 * @param {string} html - 原始邮件正文 HTML
 * @returns {string} 消毒后可安全 innerHTML 的 HTML
 */
export function sanitizeEmail(html) {
    ensureHooks()

    // 1. 提取 <style> 块单独保护（DOMPurify 会剥离顶层 style，见头部勘误 2）
    //    正则按 RAWTEXT 语义闭合，防止 `</style x>` 绕过（见头部「安全修复 B1」）
    const cssBlocks = []
    const withoutStyles = (html || '').replace(STYLE_BLOCK_RE, (block) => {
        cssBlocks.push(extractCssText(block))
        return ''
    })

    // 2. 消毒主体
    const clean = DOMPurify.sanitize(withoutStyles, {
        ADD_ATTR,
        FORBID_TAGS,
    })

    // 3. CSS 文本二次消毒：只留纯文本（ALLOWED_TAGS: []），夹带标签/脚本全剥；
    //    再封 @import 远程通道。正常 CSS 无损，夹带 HTML 则被清空。
    const safeCss = cssBlocks
        .map((css) => DOMPurify.sanitize(css, { ALLOWED_TAGS: [], KEEP_CONTENT: true }))
        .map((css) => css.replace(CSS_IMPORT_RE, ''))
        .filter((css) => css.trim())

    // 4. 用干净的 <style> 重新包裹后拼回（样式位于 shadow DOM 内，无法越界执行 JS）
    return safeCss.map((css) => `<style>${css}</style>`).join('') + clean
}

export { FORBID_TAGS, ADD_ATTR, isRemoteImg, STYLE_BLOCK_RE, extractCssText }
