# 为情绪记录新增 `source` 字段，不复用 `copingMethod`

引入"每日记录"功能后，需要区分一条 `EmotionRecord` 来自每日记录、SOS 还是未来的对话提取。现有代码（`lib/insights.ts:86`）用 `copingMethod?.includes('sos')` 这种子字符串匹配来判断 SOS 来源，脆弱且语义不清。我们选择新增显式的 `source: 'daily' | 'sos' | 'chat'` 字段，而非扩展 `copingMethod` 的取值约定。

理由：`copingMethod` 的语义是"用户用了什么应对方法"（呼吸/身体感知/认知重构），让它兼职"记录来源"会让字段承担两个正交职责。新增 `source` 保持单一职责，且不破坏存量数据——新字段对旧记录默认缺省，读取时按 `source ?? (copingMethod?.includes('sos') ? 'sos' : 'daily')` 兜底回填语义，旧代码的字符串匹配可逐步迁移。
