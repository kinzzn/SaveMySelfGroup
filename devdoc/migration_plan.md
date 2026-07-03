# Migration Plan: PAT → GitHub OAuth App

## 1. 当前架构 (Phase 0 — PAT 模式)

```
┌────────────────┐        ┌──────────────────┐
│  浏览器前端     │──PAT──▶│  GitHub API      │
│  (VitePress)   │◀───────│  Contents API    │
└────────────────┘        └──────────────────┘
```

- 用户在页面输入 GitHub Personal Access Token
- Token 存储在浏览器 localStorage
- 前端直接调用 GitHub Contents API 读写文件
- **适用场景**：单人使用，自有仓库

### 局限性

| 问题 | 说明 |
|------|------|
| 安全风险 | PAT 暴露在浏览器中，一旦 XSS 攻击会泄露 |
| 无法多人协作 | 每人需自行创建 PAT 并手动配置权限 |
| 权限粒度 | PAT 绑定个人账号，无法限制"只能写特定路径" |
| 过期管理 | Fine-grained PAT 最长 366 天，需定期更新 |

---

## 2. 目标架构 (Phase 1 — GitHub OAuth App)

```
┌────────────────┐       ┌───────────────────┐       ┌──────────────────┐
│  浏览器前端     │──①──▶│  GitHub OAuth     │       │                  │
│  (VitePress)   │       │  (authorize URL)  │       │  GitHub API      │
│                │◀──②──│  (redirect+code)  │       │  Contents API    │
│                │──③──▶│  Serverless Fn    │──④──▶│                  │
│                │◀──⑤──│  (exchange token)  │       │                  │
└────────────────┘       └───────────────────┘       └──────────────────┘
```

### 流程

1. 用户点击「GitHub 登录」→ 重定向到 GitHub 授权页
2. 用户授权后，GitHub 重定向回站点，URL 带 `code` 参数
3. 前端将 `code` 发送到 Serverless Function
4. Serverless Function 用 `client_secret` + `code` 换取 `access_token`
5. 前端拿到 token，后续直接调 GitHub API

---

## 3. GitHub OAuth App 注册步骤

### 3.1 创建 OAuth App

1. 进入 GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. 填写信息：
   - **Application name**: `SaveMySelfGroup Proofread Tool`
   - **Homepage URL**: `https://<username>.github.io/SaveMySelfGroup/`
   - **Authorization callback URL**: `https://<username>.github.io/SaveMySelfGroup/proofread`
3. 创建后获得：
   - `Client ID`（公开，可放前端）
   - `Client Secret`（**绝对不能放前端**，存 Serverless 环境变量）

### 3.2 权限范围 (Scopes)

OAuth 授权时请求的 scope：
- `repo` — 读写仓库内容（最小必需权限）
- 或 `public_repo` — 如果仓库是 public 的，这个更窄

---

## 4. Serverless Function (Token Exchange)

### 为什么需要后端？

OAuth 的 `client_secret` 不能暴露在前端代码中。需要一个服务端来完成 code → token 交换。

### 4.1 推荐部署选项

| 平台 | 优点 | 免费额度 |
|------|------|----------|
| **Cloudflare Workers** | 冷启动快、全球边缘节点 | 10万次/天 |
| **Vercel Edge Functions** | 与 GitHub 集成好 | 100万次/月 |
| **Netlify Functions** | 简单部署 | 125K次/月 |

### 4.2 实现示例 (Cloudflare Worker)

```javascript
// worker.js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://<username>.github.io',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === '/api/auth/github' && request.method === 'POST') {
      const { code } = await request.json();

      // Exchange code for token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      const tokenData = await tokenResponse.json();

      return new Response(JSON.stringify(tokenData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};
```

### 4.3 环境变量配置

```bash
# Cloudflare Worker Secrets
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
```

---

## 5. 前端 OAuth 流程实现

### 5.1 发起授权

```javascript
const CLIENT_ID = 'your_client_id'; // 公开，可放前端
const REDIRECT_URI = 'https://<username>.github.io/SaveMySelfGroup/proofread';

function loginWithGitHub() {
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=repo`;
  window.location.href = authUrl;
}
```

### 5.2 处理回调

```javascript
// 页面加载时检查 URL 是否有 code 参数
async function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');

  if (code) {
    // 调用 Serverless Function 交换 token
    const response = await fetch('https://your-worker.workers.dev/api/auth/github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    const { access_token } = await response.json();

    // 存储 token
    localStorage.setItem('github_oauth_token', access_token);

    // 清理 URL 中的 code 参数
    window.history.replaceState({}, '', window.location.pathname);
  }
}
```

### 5.3 Token 刷新

GitHub OAuth token **不会自动过期**（除非用户主动 revoke），所以不需要 refresh token 机制。但建议：
- 每次 API 调用检查 401 状态
- 遇到 401 时提示用户重新登录

---

## 6. 多人访问控制

### 6.1 协作者白名单

如果只允许特定用户使用校对工具：

```javascript
// 在 Serverless Function 中验证
const ALLOWED_USERS = ['user1', 'user2', 'user3'];

// 获取用户信息
const userResponse = await fetch('https://api.github.com/user', {
  headers: { Authorization: `Bearer ${access_token}` },
});
const user = await userResponse.json();

if (!ALLOWED_USERS.includes(user.login)) {
  return new Response('Unauthorized', { status: 403 });
}
```

### 6.2 基于仓库权限

更优雅的方式：直接检查用户是否有仓库 write 权限：

```javascript
const repoResponse = await fetch('https://api.github.com/repos/{owner}/{repo}', {
  headers: { Authorization: `Bearer ${access_token}` },
});
const repo = await repoResponse.json();

if (!repo.permissions?.push) {
  return new Response('No write access to this repository', { status: 403 });
}
```

---

## 7. 迁移步骤 (分阶段)

### Phase 0 → Phase 1 迁移清单

| 步骤 | 工作内容 | 预计工作量 |
|------|----------|-----------|
| 1 | 注册 GitHub OAuth App | 5 分钟 |
| 2 | 部署 Serverless Function (token exchange) | 1 小时 |
| 3 | 前端增加「GitHub 登录」按钮 | 30 分钟 |
| 4 | 前端处理 OAuth callback | 30 分钟 |
| 5 | 兼容期：同时支持 PAT 和 OAuth 两种方式 | 30 分钟 |
| 6 | 添加访问控制逻辑 | 30 分钟 |
| 7 | 移除 PAT 输入方式（可选） | 15 分钟 |

### 兼容策略

迁移期间同时支持两种认证方式：

```javascript
function getToken() {
  // 优先使用 OAuth token
  return localStorage.getItem('github_oauth_token')
    || localStorage.getItem('github_pat_proofread');
}
```

---

## 8. 安全考虑

| 方面 | PAT 模式 | OAuth 模式 |
|------|----------|-----------|
| Secret 暴露风险 | 高 (token 在前端) | 低 (client_secret 在服务端) |
| XSS 攻击影响 | 泄露 PAT = 账号权限 | 泄露 token = 仅限 scope 权限 |
| Token 撤销 | 用户手动 | 用户可在 GitHub 撤销授权 |
| 审计日志 | 无 | GitHub 记录 OAuth App 活动 |
| CORS 控制 | 无 | Serverless 限制来源域 |

---

## 9. 成本估算

| 组件 | 服务 | 费用 |
|------|------|------|
| 前端托管 | GitHub Pages | 免费 |
| Serverless Function | Cloudflare Workers | 免费 (10万次/天) |
| OAuth App | GitHub | 免费 |
| **总计** | | **$0** |
