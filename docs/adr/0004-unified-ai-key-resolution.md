# 统一 AI Key 解析（resolveReflectionConfig）

引入每日记录的 AI 反馈（Issue #7）时，发现仓库原有两条 AI 调用路径对 Key 的处理完全割裂，且都不满足 PRD 的分级成本模型（平台 Key 每日额度 + 用户自有 Key 不消耗额度）：

- `services/aiService.ts`（SOS 路径）只读环境变量平台 Key（`VITE_DASHSCOPE_API_KEY`），硬编码 alibaba/qwen-plus，无视用户在 Settings 的配置。
- `services/enhancedChatService.ts`（chat 路径）只读用户配置的 Key（`aiConfigStore.resolveChatConfig`），无环境变量回退，新用户没配 Key 就完全拿不到 AI 回应。

我们选择在 `lib/dailyReflection.ts` 新建一个统一的 `resolveReflectionConfig()`，按优先级融合两条路径：用户配置的 Key 优先（标记 `quotaExempt: true`，供 #9 配额逻辑豁免）；否则回退平台 Key（alibaba/qwen-plus，标记 `quotaExempt: false`，受每日额度约束）；都没有则返回 `source: 'none'`，调用方展示本地占位文案。

理由：PRD 问题 6 承诺的分级模型要求"同一个功能能在两条 Key 来源间切换"，这是现有任何一条单一路径都做不到的。新建统一解析函数而非改造现有两条路径，是因为：(1) SOS 路径被 `SOSAnalysisPage` 等多处依赖，改造它会影响危机功能的稳定性；(2) chat 路径的多轮对话语义和每日反馈的单次语义不同，强行共用会引入耦合。统一函数把"选哪把 Key"的决策从调用方下沉到一处，#9 配额逻辑只需读 `quotaExempt` 标志即可，无需关心 Key 来源细节。

未来读者看到 `dailyReflection.ts` 既 import `aiConfigStore` 又 import `aiKeyManager` 时，应理解这是有意融合两条历史路径，而非冗余。
