# IP 地址查询服务

基于 FastAPI 和 Cloudflare Workers 的 IP 地址查询服务，支持地理位置查询和特殊地址识别。

## 📦 部署方式

本项目提供两种部署选择：

| 版本 | 文件 | 适用场景 | 特点 |
|------|------|----------|------|
| FastAPI 版本 | `main.py` | 独立服务器、VPS | 完全可控、自定义配置 |
| Worker 版本 | `worker.js` | Cloudflare 平台 | 全球分布、自动扩展 |

## 🚀 FastAPI 版本部署

### 前置要求

**Docker 部署：**
- Docker
- Docker Compose
- Nginx（通过反向代理访问）

**本地开发：**
- Python 3.10+
- pip

### 本地开发

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，设置 APPCODE

# 3. 启动服务
python main.py
```

访问 `http://127.0.0.1:8000` 即可使用。

### Docker 部署

#### 首次部署

```bash
# 1. 创建 nginx_default 网络（如果不存在）
docker network create nginx_default

# 2. 进入项目目录
cd ip-checker

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，设置 APPCODE

# 4. 启动服务
docker compose up -d
```

#### 后续启动

```bash
cd ip-checker
docker compose up -d
```

#### 访问服务

服务运行在容器内 `8000` 端口，通过 Nginx 反向代理访问：

```nginx
# Nginx 配置示例
location / {
    proxy_pass http://ip-checker:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

访问端点：
- **Web 界面**: 通过 Nginx 代理访问
- **API 接口**: `/api/query?ip=8.8.8.8`
- **健康检查**: `/health`
- **CLI 模式**: `curl https://your-domain.com`

#### 停止服务

```bash
docker compose down
```

#### 查看日志

```bash
docker compose logs -f
```

## 🚀 Cloudflare Worker 版本部署

### 部署步骤

1. 登录 Cloudflare Dashboard
2. 进入 Workers & Pages
3. 创建新的 Worker
4. 复制 `worker.js` 内容到编辑器
5. 配置环境变量 `APPCODE`（用于 API 授权）
6. 点击保存并部署

### 配置说明

编辑 `worker.js` 中的配置常量：

```javascript
const CONFIG = {
  // 缓存时间（秒），24 小时
  CACHE_TTL: 86400,

  // 速率限制
  RATE_LIMIT: {
    PER_MINUTE: 10,
    PER_HOUR: 100
  },

  // 允许的域名
  ALLOWED_DOMAINS: [
    '*.example.com'
  ]
};
```

## ✨ 功能特性

- 🌐 IP 信息查询（地理位置、运营商等）
- 🏠 特殊地址识别（RFC 1918 私有地址、环回地址、链路本地地址等）
- 🚀 内存缓存（24 小时 TTL）
- 🛡️ 速率限制（每分钟10次，每小时100次）
- 🔒 安全保护（CORS、XSS 防护、安全响应头）
- 📱 响应式 Web 界面
- 🔌 RESTful API
- ⚙️ 支持 .env 文件配置

## 📁 项目结构

```
.
├── main.py              # FastAPI 主应用
├── worker.js            # Cloudflare Worker 版本
├── config.py            # 配置文件
├── utils.py             # 工具函数
├── cache.py             # 缓存管理
├── rate_limiter.py      # 速率限制
├── security.py          # 安全模块
├── templates/
│   └── index.html       # Web 界面（FastAPI 版本）
├── requirements.txt     # Python 依赖
├── Dockerfile           # Docker 构建文件
└── docker-compose.yml   # Docker Compose 配置
```

## ⚙️ FastAPI 版本配置

### Docker 配置

- **镜像名称**: `ip-checker`
- **容器名称**: `ip-checker`
- **网络**: `nginx_default`（外部网络）
- **时区**: `Asia/Shanghai`
- **重启策略**: `unless-stopped`
- **健康检查**: 每30秒检查一次 `/health` 端点

### 应用配置

编辑 [config.py](config.py) 可自定义配置：

```python
class Config:
    # 缓存时间（秒），24 小时
    CACHE_TTL = 86400

    # 速率限制
    RATE_LIMIT_PER_MINUTE = 10
    RATE_LIMIT_PER_HOUR = 100

    # CORS 白名单
    ALLOWED_DOMAINS = [
        'localhost',
        '127.0.0.1',
    ]
```

### 环境变量

在项目根目录创建 `.env` 文件：

```bash
# API 授权码
APPCODE=your_api_code_here
```

应用启动时会自动加载 `.env` 文件中的环境变量。

## 🏠 特殊地址识别

服务内置了特殊 IP 地址识别功能，以下类型的地址会直接返回预定义信息，无需查询上游 API：

| 地址类型 | 地址范围 | 示例 |
|---------|---------|------|
| 环回地址 | 127.0.0.0/8, ::1 | 127.0.0.1 |
| A 类私有网络 | 10.0.0.0/8 | 10.0.0.1 |
| B 类私有网络 | 172.16.0.0/12 | 172.16.0.1 |
| C 类私有网络 | 192.168.0.0/16 | 192.168.1.1 |
| 链路本地地址 | 169.254.0.0/16, fe80::/10 | 169.254.1.1 |
| IPv6 私有网络 | fc00::/7 | fd00::1 |
| 组播地址 | 224.0.0.0/4 | 224.0.0.1 |
| 保留地址 | 240.0.0.0/4 | 240.0.0.1 |

## 🔧 API 使用示例

### 查询指定 IP

```bash
curl "http://localhost:8000/api/query?ip=8.8.8.8"
```

### 查询当前 IP

```bash
curl "http://localhost:8000/api/query"
```

### 响应格式

```json
{
  "ret": 200,
  "msg": "success",
  "data": {
    "ip": "8.8.8.8",
    "country": "美国",
    "region": "加利福尼亚州",
    "city": "山景城",
    "isp": "Google",
    "lat": "37.4056",
    "lng": "-122.0775"
  }
}
```

## 📄 许可证

MIT License
