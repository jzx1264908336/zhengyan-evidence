# OpenAI 接入验收状态

日期：2026-11-05。提示词版本：`evidence-json-v2`。

| 检查 | 实际结果 |
|---|---|
| 本地密钥配置与忽略规则 | 已配置；`.env` 被 Git 忽略，无真实值进入源码 |
| 官方模型列表 | HTTP 200，具有 `gpt-5.4-mini` 访问权限 |
| 最小真实生成 | HTTP 429，`credit_balance_exhausted`，没有生成结果 |
| 默认运行时接口 | OpenAI `/v1/responses`，模型 `gpt-5.4-mini` |
| 自动测试 | 76 项通过；含 5 项新增 OpenAI 契约及异常场景测试 |
| 类型检查与构建 | 通过 |
| 20 问题真实集与语义审查 | 未完成，等待 API 可用额度 |
| 线上密钥与模型能力 | 未部署；线上原 V2 继续可用 |

准备好额度后运行 `npm run test:model:live`。如本机网络要求代理，使用本机实际代理配置启动 Node（支持 `--use-env-proxy` 的版本）；不要将本机代理地址写进产品源码或关闭证书验证。

脚本单独触发真实请求，不由 `npm test` 或构建触发。遇上游或契约失败停止，避免无效重试。结构、数字与引用校验通过仍需要人工审查因果、口径、事实与推断边界，不应以通过率代替语义验收。

官方参考：[Responses 入门](https://developers.openai.com/api/docs/quickstart)、[Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)、[模型说明](https://developers.openai.com/api/docs/models/gpt-5.4-mini)。
