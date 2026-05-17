# Plus 变种说明

本文档记录本 fork 相对基线新增的前端能力，方便后续维护与合并上游版本。

## 新增管理界面入口

- Codex device flow
- iFlow OAuth / Cookie
- Cursor OAuth
- CodeBuddy
- Kilo
- Kiro Portal
- Kiro AWS Builder ID（device / auth code）
- Kiro IDC
- Kiro IDE token 导入
- GitHub Copilot
- GitLab OAuth / PAT

## Kiro 页面组织

- **Kiro 推荐入口**：Portal、AWS Builder ID、IDC。
- **Kiro 旧版兼容入口**：旧的 Google / GitHub 直连 OAuth 入口仍保留，但新登录优先使用 Portal。
- **导入 Kiro IDE 令牌**：继续用于复用当前机器上已存在的 `kiro-auth-token.json`。

## 合并策略

变种实现尽量集中在独立文件中：

- `src/services/api/oauthPlus.ts`
- `src/pages/OAuthPlusSection.tsx`
- `src/pages/OAuthPlusSection.module.scss`
- `src/i18n/locales-plus/*.json`

基线文件只保留少量接入点，后续合并上游时优先检查这些独立文件与接入点即可。
