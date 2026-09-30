import { describe, it, expect } from 'vitest'
import zh from './zh.js'
import en from './en.js'

/**
 * i18n 资源一致性测试（F005 US2）
 * 防止漏译：zh / en 两份资源的 key 集合必须完全一致。
 */
describe('i18n · zh/en key 集合一致性', () => {
    it('zh 与 en 的 key 数量一致', () => {
        expect(Object.keys(zh).length).toBe(Object.keys(en).length)
    })

    it('zh 的每个 key 都在 en 中存在（无漏译）', () => {
        const missingInEn = Object.keys(zh).filter((k) => !(k in en))
        expect(missingInEn).toEqual([])
    })

    it('en 的每个 key 都在 zh 中存在', () => {
        const missingInZh = Object.keys(en).filter((k) => !(k in zh))
        expect(missingInZh).toEqual([])
    })

    it('无空值翻译（已知漏译豁免清单）', () => {
        // 上游既有漏译，冻结基线（只许减少不许增加）；修正应走独立 issue
        const KNOWN_EMPTY = ['character']
        const emptyZh = Object.entries(zh)
            .filter(([k, v]) => !v && !KNOWN_EMPTY.includes(k))
            .map(([k]) => k)
        const emptyEn = Object.entries(en)
            .filter(([k, v]) => !v && !KNOWN_EMPTY.includes(k))
            .map(([k]) => k)
        expect(emptyZh).toEqual([])
        expect(emptyEn).toEqual([])
    })
})

/**
 * 死键检测（评审建议项，2026-09-30）
 *
 * i18n key 加了却没人用 = 死键。本次评审已发现一例（showImages 曾被定义但无引用）。
 * 这里用 import.meta.glob 以 raw 方式读入全部源码，检查每个 key 至少被引用一次。
 *
 * 豁免清单：正当的「定义即用」场景（如测试断言、动态拼接的 key）。
 */
describe('i18n · 死键检测', () => {
    /** 动态拼接 / 测试专用的 key，不参与死键检测 */
    const ALLOWED_UNUSED = [
        // 由测试直接断言用
        'wrote',
        // 以下为上游既有死键（冻结基线，只许减少不许增加）。
        // 修正应走独立 issue，不在本特性顺手删（避免与上游产生无谓 diff，见 F006 上游同步）。
        'delAccount',
        'dayUnit',
        'subjectInputDesc',
        'clearAllDelConfirm',
        'delInputPattern',
        'inputErrorMessage',
        'banRestore',
        'mustNotContainDesc',
        'notOwner',
    ]

    it('每个 i18n key 至少被源码引用一次（无死键）', () => {
        // raw 方式读入全部源码（源文件 + 组件），排除 i18n 资源文件自身与测试文件
        const sources = import.meta.glob(['../**/*.{js,vue}', '!../i18n/*.js', '!../**/*.test.js'], {
            query: '?raw',
            import: 'default',
        })

        // 拼接所有源码为一个大字符串，逐个 key 检查是否出现
        // 注意：import.meta.glob 返回的是惰性函数，需要同步获取——改用 eager 不可行（vitest 中仍需 await）
        // 故此处改为在运行时异步收集。
        return Promise.all(Object.values(sources).map((load) => load())).then((contents) => {
            const corpus = contents.join('\n')
            const unused = Object.keys(zh).filter((k) => {
                if (ALLOWED_UNUSED.includes(k)) return false
                // key 可能以 t('key') / $t('key') / :label="t('key')" 等形式出现
                return !corpus.includes(`'${k}'`) && !corpus.includes(`"${k}"`)
            })
            expect(unused).toEqual([])
        })
    })
})
