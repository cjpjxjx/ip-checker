"""
工具函数
"""
import re
from typing import Optional
from config import Config


# IP 验证正则
IPV4_PATTERN = re.compile(
    r'^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.'
    r'(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.'
    r'(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.'
    r'(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$'
)

IPV6_PATTERN = re.compile(
    r'^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|'
    r'([0-9a-fA-F]{1,4}:){1,7}:|'
    r'([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|'
    r'([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|'
    r'([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|'
    r'([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|'
    r'([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|'
    r'[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|'
    r':((:[0-9a-fA-F]{1,4}){1,7}|:)|::)$'
)


def is_valid_ip(ip: Optional[str]) -> bool:
    """
    验证 IP 地址格式

    Args:
        ip: IP 地址字符串

    Returns:
        是否为有效的 IPv4 或 IPv6 地址
    """
    if not ip or not isinstance(ip, str):
        return False
    return bool(IPV4_PATTERN.match(ip) or IPV6_PATTERN.match(ip))


def escape_html(text: str) -> str:
    """
    HTML 转义函数

    Args:
        text: 需要转义的字符串

    Returns:
        转义后的字符串
    """
    if not text:
        return ''

    html_escape_map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }

    result = str(text)
    for char, escaped in html_escape_map.items():
        result = result.replace(char, escaped)

    return result


def is_domain_allowed(hostname: Optional[str], allowed_domains: list[str]) -> bool:
    """
    验证域名是否在白名单中（支持通配符）

    Args:
        hostname: 要验证的域名
        allowed_domains: 允许的域名列表（支持 * 通配符）

    Returns:
        是否匹配
    """
    if not hostname:
        return False

    for pattern in allowed_domains:
        # 将通配符模式转换为正则表达式
        # *.example.com -> ^.*\.example\.com$
        regex_pattern = pattern.replace('.', r'\.').replace('*', '.*')
        regex = re.compile(f'^{regex_pattern}$', re.IGNORECASE)

        if regex.match(hostname):
            return True

    return False


def get_client_ip(request) -> str:
    """
    获取客户端真实 IP 地址

    Args:
        request: FastAPI Request 对象

    Returns:
        客户端 IP 地址
    """
    # 优先从代理头获取（类似 CF-Connecting-IP）
    forwarded_for = request.headers.get('X-Forwarded-For')
    if forwarded_for:
        # X-Forwarded-For 可能包含多个 IP，取第一个
        return forwarded_for.split(',')[0].strip()

    real_ip = request.headers.get('X-Real-IP')
    if real_ip:
        return real_ip

    # 回退到直接连接 IP
    return request.client.host if request.client else '127.0.0.1'
