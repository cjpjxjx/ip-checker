"""
速率限制器（基于内存）
"""
import time
from threading import Lock
from collections import defaultdict
from typing import Dict, Tuple
from config import Config


class RateLimiter:
    """基于滑动窗口的速率限制器"""

    def __init__(self, per_minute: int = 10, per_hour: int = 100):
        """
        初始化速率限制器

        Args:
            per_minute: 每分钟最大请求数
            per_hour: 每小时最大请求数
        """
        self.per_minute = per_minute
        self.per_hour = per_hour

        # 存储格式: {client_ip: [(timestamp1, 'minute'), (timestamp2, 'hour'), ...]}
        self.minute_records: Dict[str, list[float]] = defaultdict(list)
        self.hour_records: Dict[str, list[float]] = defaultdict(list)
        self.lock = Lock()

    def _cleanup_old_records(self, records: list[float], window: float) -> list[float]:
        """
        清理过期记录

        Args:
            records: 时间戳列表
            window: 时间窗口（秒）

        Returns:
            清理后的记录列表
        """
        now = time.time()
        return [ts for ts in records if now - ts < window]

    def check_rate_limit(self, client_ip: str) -> Tuple[bool, int, int]:
        """
        检查速率限制

        Args:
            client_ip: 客户端 IP

        Returns:
            (是否允许, 剩余配额, 重置时间秒数)
        """
        with self.lock:
            now = time.time()

            # 清理过期记录
            self.minute_records[client_ip] = self._cleanup_old_records(
                self.minute_records[client_ip], 60
            )
            self.hour_records[client_ip] = self._cleanup_old_records(
                self.hour_records[client_ip], 3600
            )

            minute_count = len(self.minute_records[client_ip])
            hour_count = len(self.hour_records[client_ip])

            # 检查每分钟限制
            if minute_count >= self.per_minute:
                reset_in = 60 - int(now % 60)
                return False, 0, reset_in

            # 检查每小时限制
            if hour_count >= self.per_hour:
                reset_in = 3600 - int(now % 3600)
                return False, 0, reset_in

            # 记录本次请求
            self.minute_records[client_ip].append(now)
            self.hour_records[client_ip].append(now)

            # 计算剩余配额
            remaining = min(
                self.per_minute - (minute_count + 1),
                self.per_hour - (hour_count + 1)
            )

            reset_in = 60 - int(now % 60)

            return True, remaining, reset_in

    def cleanup_old_clients(self) -> int:
        """
        清理长时间未活动的客户端记录

        Returns:
            清理的客户端数量
        """
        with self.lock:
            now = time.time()
            cleaned = 0

            # 清理分钟记录
            for client_ip in list(self.minute_records.keys()):
                self.minute_records[client_ip] = self._cleanup_old_records(
                    self.minute_records[client_ip], 60
                )
                if not self.minute_records[client_ip]:
                    del self.minute_records[client_ip]
                    cleaned += 1

            # 清理小时记录
            for client_ip in list(self.hour_records.keys()):
                self.hour_records[client_ip] = self._cleanup_old_records(
                    self.hour_records[client_ip], 3600
                )
                if not self.hour_records[client_ip]:
                    del self.hour_records[client_ip]

            return cleaned


# 全局速率限制器实例
rate_limiter = RateLimiter(
    per_minute=Config.RATE_LIMIT_PER_MINUTE,
    per_hour=Config.RATE_LIMIT_PER_HOUR
)
