"""
内存缓存管理
"""
import time
from typing import Optional, Any
from threading import Lock
from collections import OrderedDict
from config import Config


class TTLCache:
    """带 TTL（Time To Live）的 LRU 缓存"""

    def __init__(self, max_size: int = 1000, ttl: int = 3600):
        """
        初始化缓存

        Args:
            max_size: 最大缓存条目数
            ttl: 缓存过期时间（秒）
        """
        self.max_size = max_size
        self.ttl = ttl
        self.cache: OrderedDict[str, tuple[Any, float]] = OrderedDict()
        self.lock = Lock()

    def get(self, key: str) -> Optional[Any]:
        """
        获取缓存值

        Args:
            key: 缓存键

        Returns:
            缓存的值，如果不存在或已过期则返回 None
        """
        with self.lock:
            if key not in self.cache:
                return None

            value, expire_time = self.cache[key]

            # 检查是否过期
            if time.time() > expire_time:
                del self.cache[key]
                return None

            # LRU：移到末尾（表示最近使用）
            self.cache.move_to_end(key)
            return value

    def set(self, key: str, value: Any) -> None:
        """
        设置缓存值

        Args:
            key: 缓存键
            value: 缓存值
        """
        with self.lock:
            expire_time = time.time() + self.ttl

            # 如果已存在，更新并移到末尾
            if key in self.cache:
                self.cache[key] = (value, expire_time)
                self.cache.move_to_end(key)
            else:
                # 检查容量，如果满了删除最旧的
                if len(self.cache) >= self.max_size:
                    self.cache.popitem(last=False)  # FIFO：删除第一个

                self.cache[key] = (value, expire_time)

    def clear(self) -> None:
        """清空缓存"""
        with self.lock:
            self.cache.clear()

    def cleanup_expired(self) -> int:
        """
        清理过期条目

        Returns:
            清理的条目数
        """
        with self.lock:
            now = time.time()
            expired_keys = [
                key for key, (_, expire_time) in self.cache.items()
                if now > expire_time
            ]

            for key in expired_keys:
                del self.cache[key]

            return len(expired_keys)

    def __len__(self) -> int:
        """返回当前缓存条目数"""
        with self.lock:
            return len(self.cache)


# 全局缓存实例
ip_info_cache = TTLCache(
    max_size=Config.CACHE_MAX_SIZE,
    ttl=Config.CACHE_TTL
)
