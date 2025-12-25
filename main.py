"""
IP 地址查询服务 - FastAPI 实现
"""
import os
import asyncio
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse
from fastapi.templating import Jinja2Templates

from config import Config
from utils import is_valid_ip, get_client_ip, escape_html
from cache import ip_info_cache
from rate_limiter import rate_limiter
from security import get_security_headers, check_domain_authorization


# 定期清理任务
async def cleanup_task():
    """定期清理过期缓存和速率限制记录"""
    while True:
        await asyncio.sleep(300)  # 每5分钟清理一次
        ip_info_cache.cleanup_expired()
        rate_limiter.cleanup_old_clients()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时：启动清理任务
    cleanup = asyncio.create_task(cleanup_task())
    yield
    # 关闭时：取消清理任务
    cleanup.cancel()


# 初始化 FastAPI 应用
app = FastAPI(
    title=Config.APP_TITLE,
    version=Config.APP_VERSION,
    lifespan=lifespan
)

# 初始化模板
templates = Jinja2Templates(directory="templates")

# 从环境变量获取 APPCODE
APPCODE = os.getenv("APPCODE", Config.APPCODE)


@app.get("/health")
async def health_check():
    """健康检查端点"""
    headers = get_security_headers(is_api=True)
    return JSONResponse(
        content={
            "status": "ok",
            "timestamp": datetime.utcnow().isoformat() + "Z"
        },
        headers=headers
    )


@app.get("/robots.txt")
async def robots_txt():
    """robots.txt"""
    headers = get_security_headers(is_api=False)
    return PlainTextResponse(
        content="User-agent: *\nAllow: /",
        headers=headers
    )


@app.get("/favicon.ico")
async def favicon():
    """Favicon（返回自定义图标）"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://dl.cencs.com/static/ip/favicon.ico",
                timeout=5.0
            )
            if response.status_code == 200:
                headers = get_security_headers(is_api=False)
                headers['Content-Type'] = 'image/x-icon'
                headers['Cache-Control'] = 'public, max-age=86400'
                return Response(
                    content=response.content,
                    headers=headers,
                    media_type='image/x-icon'
                )
    except Exception:
        pass

    # 降级：返回 204
    return Response(status_code=204, headers=get_security_headers(is_api=False))


@app.options("/api/query")
async def options_handler(request: Request):
    """处理 CORS 预检请求"""
    origin = request.headers.get('Origin')
    headers = get_security_headers(is_api=True, origin=origin)
    return Response(status_code=204, headers=headers)


@app.get("/api/query")
async def api_query(request: Request, ip: Optional[str] = None):
    """API 端点：返回 IP 信息的 JSON"""
    origin = request.headers.get('Origin')
    referer = request.headers.get('Referer')
    request_host = request.url.hostname or 'localhost'
    client_ip = get_client_ip(request)

    # 查询的目标 IP
    query_ip = ip if ip else client_ip

    # 1. 域名验证
    is_authorized = check_domain_authorization(origin, referer, request_host)

    if not is_authorized:
        headers = get_security_headers(is_api=True, origin=origin)
        return JSONResponse(
            content={
                "ret": 403,
                "msg": "访问被拒绝：请从授权域名访问"
            },
            status_code=403,
            headers=headers
        )

    # 2. 检查缓存（优先返回缓存数据，不计入速率限制）
    cached_data = ip_info_cache.get(query_ip)
    if cached_data:
        headers = get_security_headers(is_api=True, origin=origin)
        headers['Cache-Control'] = 'no-cache'
        headers['X-Cache-Status'] = 'HIT'
        return JSONResponse(content=cached_data, headers=headers)

    # 3. 缓存未命中，进行速率限制检查
    allowed, remaining, reset_in = rate_limiter.check_rate_limit(client_ip)
    if not allowed:
        headers = get_security_headers(is_api=True, origin=origin)
        headers['Retry-After'] = str(reset_in)
        headers['X-RateLimit-Limit'] = str(Config.RATE_LIMIT_PER_MINUTE)
        headers['X-RateLimit-Remaining'] = '0'
        headers['X-RateLimit-Reset'] = str(reset_in)
        return JSONResponse(
            content={
                "ret": 429,
                "msg": f"请求过于频繁，请在 {reset_in} 秒后重试"
            },
            status_code=429,
            headers=headers
        )

    # 4. 查询上游 API（会自动缓存结果）
    api_result = await query_ip_info_with_cache(query_ip, APPCODE)

    # 5. 返回结果
    headers = get_security_headers(is_api=True, origin=origin)
    headers['Cache-Control'] = 'no-cache'
    headers['X-Cache-Status'] = 'MISS'
    headers['X-RateLimit-Limit'] = str(Config.RATE_LIMIT_PER_MINUTE)
    headers['X-RateLimit-Remaining'] = str(remaining)
    headers['X-RateLimit-Reset'] = str(reset_in)

    return JSONResponse(content=api_result, headers=headers)


@app.get("/", response_class=HTMLResponse)
async def index(request: Request, ip: Optional[str] = None):
    """主页：显示 IP 查询界面"""
    user_agent = request.headers.get('User-Agent', '').lower()
    client_ip = get_client_ip(request)

    # CLI (curl) 模式：直接返回纯文本 IP
    if 'curl' in user_agent:
        headers = get_security_headers(is_api=False)
        headers['Content-Type'] = 'text/plain; charset=utf-8'
        return PlainTextResponse(content=f"{client_ip}\n", headers=headers)

    # 确定目标 IP（支持 URL 参数）
    target_ip = ip if ip else client_ip
    error_message = None

    # 验证 IP 格式
    if ip and not is_valid_ip(target_ip):
        target_ip = client_ip
        error_message = "请输入有效的 IPv4 或 IPv6 地址"

    # 渲染页面
    headers = get_security_headers(is_api=False)
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "target_ip": escape_html(target_ip),
            "error_message": escape_html(error_message) if error_message else None
        },
        headers=headers
    )


async def query_ip_info_with_cache(ip: str, app_code: str) -> dict:
    """
    带缓存的 IP 查询核心函数

    Args:
        ip: 要查询的 IP 地址
        app_code: API 授权码

    Returns:
        API 响应数据
    """
    api_url = f"{Config.API_HOST}{Config.API_PATH}?ip={ip}"

    # 1. 尝试从缓存读取
    cached_data = ip_info_cache.get(ip)
    if cached_data:
        return cached_data

    # 2. 缓存未命中，请求源站 API
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                api_url,
                headers={"Authorization": f"APPCODE {app_code}"},
                timeout=Config.API_TIMEOUT
            )

            if response.status_code == 200:
                data = response.json()

                # 3. 只有当返回成功 (ret=200) 时才写入缓存
                if data and data.get('ret') == 200:
                    ip_info_cache.set(ip, data)

                return data

            # HTTP 错误
            return {
                "ret": response.status_code,
                "msg": f"API 请求失败: {response.reason_phrase}"
            }

    except httpx.TimeoutException:
        return {
            "ret": 504,
            "msg": "API 请求超时"
        }
    except Exception as e:
        return {
            "ret": 500,
            "msg": f"网络错误: {str(e)}"
        }


# 启动说明
if __name__ == "__main__":
    import uvicorn

    print("=" * 60)
    print("IP 地址查询服务")
    print("=" * 60)
    print(f"版本: {Config.APP_VERSION}")
    print(f"访问地址: http://127.0.0.1:8000")
    print(f"API 文档: http://127.0.0.1:8000/docs")
    print("=" * 60)
    print("提示: 请设置环境变量 APPCODE 以使用上游 API")
    print("=" * 60)

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
