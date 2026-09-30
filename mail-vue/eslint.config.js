import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import autoImport from './.eslintrc-auto-import.json' with { type: 'json' }

/**
 * ESLint 9/10 flat config（F004）
 *
 * 设计原则：
 * - 用 `flat/essential`（而非 `flat/recommended`）：后者含大量**格式规则**，与 Prettier 职责重叠
 *   （D-7：Prettier 负责格式，ESLint 负责代码质量）；
 * - 显式补充浏览器全局（window/document/console/...）与第三方全局（tinymce），消除 no-undef 噪音；
 * - auto-import 生成的 Element Plus 全局（ElMessage 等）从 .eslintrc-auto-import.json 注入。
 */
export default [
    js.configs.recommended,
    ...pluginVue.configs['flat/essential'],
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                ...autoImport.globals,
                // 富文本编辑器，通过 CDN/静态资源加载的全局对象
                tinymce: 'readonly',
            },
        },
        rules: {
            // 上游为多词文件名已符合，但历史组件有单词名（如 loading）——关闭
            'vue/multi-word-component-names': 'off',
            // 存量代码存在以下模式的既有写法（豁免冻结，只许减少不许增加）
            'no-unused-vars': 'warn',
            'no-useless-escape': 'warn',
            'no-cond-assign': 'warn',
            'no-useless-assignment': 'warn',
            'no-prototype-builtins': 'warn',
            'no-empty': 'warn',
            'no-case-declarations': 'warn',
        },
    },
    { ignores: ['dist/**', 'node_modules/**', 'dev-dist/**', 'coverage/**', 'public/**'] },

    // ==== 存量豁免清单（F004 AC-1）====
    // 上游既有代码的真实缺陷 / 解析器误报，冻结基线：只许减少不许增加。
    // 逐条登记，不整文件禁用（保留增量防护能力）。发现的问题记 issue，不在本特性顺手修（F001 N-2）。
    {
        files: ['src/utils/day.js'],
        rules: {
            // updateNow() 引用了 fromNow() 作用域内的局部变量——上游真实缺陷（调用即 ReferenceError），待独立 issue
            'no-undef': 'off',
        },
    },
    {
        files: ['src/components/email-scroll/index.vue', 'src/components/email-scroll/skeleton/index.vue'],
        rules: {
            'vue/no-unused-vars': 'off',
            'vue/no-dupe-keys': 'off',
            'vue/require-v-for-key': 'off',
        },
    },
    {
        files: ['src/components/hamburger/index.vue'],
        rules: { 'vue/valid-define-emits': 'off' },
    },
    {
        files: ['src/layout/header/index.vue', 'src/views/all-email/index.vue'],
        rules: { 'vue/return-in-computed-property': 'off' },
    },
    {
        // 上游以 <{{ email }}> 形式渲染邮件地址尖括号，Vue 解析器误报为非法标签名
        files: ['src/layout/write/index.vue', 'src/views/content/index.vue'],
        rules: { 'vue/no-parsing-error': 'off' },
    },
    {
        files: ['src/views/reg-key/index.vue'],
        rules: {
            'vue/require-v-for-key': 'off',
            'no-undef': 'off', // jQuery 全局 $（该视图既有用法）
        },
    },
    {
        files: ['src/views/role/index.vue'],
        rules: { 'vue/no-ref-as-operand': 'off' },
    },
    {
        files: ['src/views/sys-setting/index.vue'],
        rules: { 'vue/no-side-effects-in-computed-properties': 'off' },
    },
    {
        files: ['src/views/test/index.vue'],
        rules: { 'vue/valid-template-root': 'off' },
    },
]
