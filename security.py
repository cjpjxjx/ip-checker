"""
安全相关功能（CORS、响应头等）
"""
from typing import Optional, Dict
from urllib.parse import urlparse
from utils import is_domain_allowed
from config import Config


def get_security_headers(is_api: bool = False, origin: Optional[str] = None) -> Dict[str, str]:
    """
    生成安全响应头

    Args:
        is_api: 是否为 API 响应
        origin: 请求来源（用于 CORS）

    Returns:
        响应头字典
    """
    headers = {
        # 防止点击劫持
        'X-Frame-Options': 'SAMEORIGIN',

        # 防止 MIME 类型嗅探
        'X-Content-Type-Options': 'nosniff',

        # XSS 保护
        'X-XSS-Protection': '1; mode=block',

        # Referrer 策略
        'Referrer-Policy': 'strict-origin-when-cross-origin',
    }

    # HTML 页面添加 CSP
    if not is_api:
        headers['Content-Security-Policy'] = (
            "default-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "script-src 'self' 'unsafe-inline'"
        )

    # API 响应添加 CORS
    if is_api and origin:
        try:
            origin_host = urlparse(origin).hostname
            if origin_host and is_domain_allowed(origin_host, Config.ALLOWED_DOMAINS):
                headers['Access-Control-Allow-Origin'] = origin
                headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
                headers['Access-Control-Allow-Headers'] = 'Content-Type'
                headers['Access-Control-Max-Age'] = '86400'
        except Exception:
            # 无效的 Origin，不添加 CORS 头
            pass

    return headers


def check_domain_authorization(origin: Optional[str], referer: Optional[str], request_host: str) -> bool:
    """
    检查域名授权

    Args:
        origin: Origin 头
        referer: Referer 头
        request_host: 请求主机名

    Returns:
        是否授权
    """
    # 检查 Origin
    if origin:
        try:
            origin_host = urlparse(origin).hostname
            if origin_host and is_domain_allowed(origin_host, Config.ALLOWED_DOMAINS):
                return True
        except Exception:
            pass

    # 检查 Referer（如果 Origin 验证失败）
    if referer:
        try:
            referer_host = urlparse(referer).hostname
            if referer_host:
                # 允许同域请求或白名单域名
                if (referer_host == request_host or
                    is_domain_allowed(referer_host, Config.ALLOWED_DOMAINS)):
                    return True
        except Exception:
            pass

    # 允许本地开发环境（localhost 和 127.0.0.1）的同源请求
    if request_host in ('localhost', '127.0.0.1'):
        return True

    # 如果既没有 Origin 也没有 Referer，拒绝访问
    return False
