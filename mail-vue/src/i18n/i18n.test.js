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
