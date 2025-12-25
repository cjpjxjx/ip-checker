"""
配置常量
"""

class Config:
    """应用配置"""

    # API 配置
    API_HOST = "https://c2ba.api.huachen.cn"
    API_PATH = "/ip"
    API_TIMEOUT = 5.0  # 秒

    # 缓存配置
    CACHE_TTL = 3600  # 缓存时间（秒），1小时
    CACHE_MAX_SIZE = 1000  # 最大缓存条目数

    # 速率限制配置
    RATE_LIMIT_PER_MINUTE = 10  # 每分钟最多请求次数
    RATE_LIMIT_PER_HOUR = 100   # 每小时最多请求次数

    # 允许的域名（支持通配符 *）
    ALLOWED_DOMAINS = [
        '*.cjp-jx.workers.dev',
        '*.000180.xyz',
        '*.cencs.com',
        'localhost',  # 本地开发
        '127.0.0.1',  # 本地开发
    ]

    # 应用配置
    APP_TITLE = "IP 地址查询"
    APP_VERSION = "1.0.0"

    # 环境变量
    APPCODE = ""  # 从环境变量读取：os.getenv("APPCODE", "")
