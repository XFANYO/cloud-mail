<template>
    <div class="content-box" ref="contentBox">
        <div ref="container" class="content-html"></div>
    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { sanitizeEmail } from '@/utils/sanitizeEmail'

const props = defineProps({
    html: {
        type: String,
        required: true,
    },
})

const { t } = useI18n()
const container = ref(null)
const contentBox = ref(null)
let shadowRoot = null

function updateContent() {
    if (!shadowRoot) return

    // 0. 消毒：剥离事件属性 / javascript: URI / 危险标签，阻断远程图片（F003 D-5/D-6）
    const safeHtml = sanitizeEmail(props.html || '')

    // 1. 提取 <body> 的 style 属性（如果存在）——基于消毒后的字符串
    const bodyStyleRegex = /<body[^>]*style="([^"]*)"[^>]*>/i
    const bodyStyleMatch = safeHtml.match(bodyStyleRegex)
    const bodyStyle = bodyStyleMatch ? bodyStyleMatch[1] : ''

    // 2. 移除 <body> 标签（保留内容）
    const cleanedHtml = safeHtml.replace(/<\/?body[^>]*>/gi, '')

    // 3. 将 body 的 style 应用到 .shadow-content
    shadowRoot.innerHTML = `
    <style>
      :host {
        all: initial;
        width: 100%;
        height: 100%;
        font-family: Inter, 'Helvetica Neue', Helvetica, 'PingFang SC',
                    'Hiragino Sans GB', 'Microsoft YaHei', '微软雅黑', Arial, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #13181D;
        word-break: break-word;
      }

      h1, h2, h3, h4 {
          font-size: 18px;
          font-weight: 700;
      }

      p {
        margin: 0;
      }

      a {
        text-decoration: none;
        color: #0E70DF;
      }

      .shadow-content {
        background: #FFFFFF;
        width: fit-content;
        height: fit-content;
        min-width: 100%;
        ${bodyStyle ? bodyStyle : ''} /* 注入 body 的 style */
      }

      img:not(table img) {
        max-width: 100%;
        height: auto !important;
      }

      /* 被阻断的远程图片占位框（F003 D-6） */
      img.cm-blocked-img {
        display: inline-block;
        min-width: 120px;
        min-height: 60px;
        background: #F2F4F7 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath fill='%2399A1AB' d='M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z'/%3E%3C/svg%3E") no-repeat center;
        background-size: 32px;
        border: 1px dashed #C9CDD4;
        border-radius: 4px;
        cursor: pointer;
        box-sizing: border-box;
      }

    </style>
    <div class="shadow-content">
      ${cleanedHtml}
    </div>
  `

    // 4. 给被阻断的远程图片补可发现性提示（title / aria-label），
    //    否则用户只看到一个虚线占位框，不知道「可点击加载」。文案取 i18n 的 showImages。
    const hint = t('showImages')
    shadowRoot.querySelectorAll('img.cm-blocked-img').forEach((img) => {
        img.setAttribute('title', hint)
        img.setAttribute('aria-label', hint)
        img.setAttribute('role', 'button')
    })
}

/**
 * 点击被阻断的远程图片 → 用 data-orig-src 还原真实地址（F003 D-6）
 */
function handleShadowClick(e) {
    const img = e.target && e.target.closest ? e.target.closest('img.cm-blocked-img') : null
    if (!img) return
    const orig = img.getAttribute('data-orig-src')
    if (orig) {
        img.setAttribute('src', orig)
        img.removeAttribute('data-orig-src')
        img.classList.remove('cm-blocked-img')
        // 已加载：移除占位提示，恢复正常图片语义
        img.removeAttribute('title')
        img.removeAttribute('aria-label')
        img.removeAttribute('role')
    }
}

function autoScale() {
    if (!shadowRoot || !contentBox.value) return

    const parent = contentBox.value
    const shadowContent = shadowRoot.querySelector('.shadow-content')

    if (!shadowContent) return

    const parentWidth = parent.offsetWidth
    const childWidth = shadowContent.scrollWidth

    if (childWidth === 0) return

    const scale = parentWidth / childWidth

    const hostElement = shadowRoot.host
    hostElement.style.zoom = scale
}

onMounted(() => {
    shadowRoot = container.value.attachShadow({ mode: 'open' })
    shadowRoot.addEventListener('click', handleShadowClick)
    updateContent()
    autoScale()
})

onBeforeUnmount(() => {
    if (shadowRoot) {
        shadowRoot.removeEventListener('click', handleShadowClick)
    }
})

watch(
    () => props.html,
    () => {
        updateContent()
        autoScale()
    }
)
</script>

<style scoped>
.content-box {
    width: 100%;
    height: 100%;
    overflow: hidden;
    font-family:
        Inter, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', '微软雅黑', Arial,
        sans-serif;
}

.content-html {
    width: 100%;
    height: 100%;
}
</style>
