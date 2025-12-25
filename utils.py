"""
工具函数
"""
import re
import ipaddress
from typing import Optional, Dict
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


def get_special_ip_info(ip: str) -> Optional[Dict]:
    """
    检测特殊 IP 地址并返回预定义信息（无需查询上游 API）

    支持的特殊地址类型：
    - RFC 1918 私有地址 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
    - 环回地址 (127.0.0.0/8, ::1)
    - 链路本地地址 (169.254.0.0/16, fe80::/10)
    - IPv6 唯一本地地址 (fc00::/7)
    - 其他保留地址

    Args:
        ip: IP 地址字符串

    Returns:
        如果是特殊地址，返回预定义的 API 响应格式；否则返回 None
    """
    try:
        ip_obj = ipaddress.ip_address(ip)
    except ValueError:
        return None

    # 环回地址 (Loopback)
    if ip_obj.is_loopback:
        return {
            "ret": 200,
            "msg": "ok",
            "data": {
                "ip": ip,
                "country": "本机",
                "country_id": "CN",
                "area": "本机环回地址",
                "region": "",
                "region_id": "",
                "city": "Localhost",
                "city_id": "",
                "district": "",
                "district_id": "",
                "isp": "Loopback",
                "lat": "",
                "lng": ""
            }
        }

    # 私有地址 (RFC 1918)
    if ip_obj.is_private:
        # 区分不同的私有地址段
        if isinstance(ip_obj, ipaddress.IPv4Address):
            if ip_obj in ipaddress.ip_network('10.0.0.0/8'):
                area = "A 类私有网络"
            elif ip_obj in ipaddress.ip_network('172.16.0.0/12'):
                area = "B 类私有网络"
            elif ip_obj in ipaddress.ip_network('192.168.0.0/16'):
                area = "C 类私有网络"
            else:
                area = "私有网络"
        else:
            area = "IPv6 私有网络"

        return {
            "ret": 200,
            "msg": "ok",
            "data": {
                "ip": ip,
                "country": "内网",
                "country_id": "",
                "area": area,
                "region": "",
                "region_id": "",
                "city": "Local Network",
                "city_id": "",
                "district": "",
                "district_id": "",
                "isp": "Private",
                "lat": "",
                "lng": ""
            }
        }

    # 链路本地地址 (Link-Local)
    if ip_obj.is_link_local:
        return {
            "ret": 200,
            "msg": "ok",
            "data": {
                "ip": ip,
                "country": "本地链路",
                "country_id": "",
                "area": "链路本地地址 (APIPA/Link-Local)",
                "region": "",
                "region_id": "",
                "city": "Link-Local",
                "city_id": "",
                "district": "",
                "district_id": "",
                "isp": "Link-Local",
                "lat": "",
                "lng": ""
            }
        }

    # 组播地址 (Multicast)
    if ip_obj.is_multicast:
        return {
            "ret": 200,
            "msg": "ok",
            "data": {
                "ip": ip,
                "country": "组播",
                "country_id": "",
                "area": "组播地址 (Multicast)",
                "region": "",
                "region_id": "",
                "city": "Multicast",
                "city_id": "",
                "district": "",
                "district_id": "",
                "isp": "Multicast",
                "lat": "",
                "lng": ""
            }
        }

    # 未指定地址 (0.0.0.0 或 ::)
    if ip_obj.is_unspecified:
        return {
            "ret": 200,
            "msg": "ok",
            "data": {
                "ip": ip,
                "country": "未指定",
                "country_id": "",
                "area": "未指定地址",
                "region": "",
                "region_id": "",
                "city": "Unspecified",
                "city_id": "",
                "district": "",
                "district_id": "",
                "isp": "Unspecified",
                "lat": "",
                "lng": ""
            }
        }

    # 保留地址 (Reserved)
    if ip_obj.is_reserved:
        return {
            "ret": 200,
            "msg": "ok",
            "data": {
                "ip": ip,
                "country": "保留",
                "country_id": "",
                "area": "保留地址 (Reserved)",
                "region": "",
                "region_id": "",
                "city": "Reserved",
                "city_id": "",
                "district": "",
                "district_id": "",
                "isp": "Reserved",
                "lat": "",
                "lng": ""
            }
        }

    # 不是特殊地址，返回 None
    return None
