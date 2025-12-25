// ========== 配置常量 ==========
const CONFIG = {
  API_HOST: "https://c2ba.api.huachen.cn",
  API_PATH: "/ip",
  API_TIMEOUT: 10000,        // API 请求超时时间（毫秒）
  CACHE_TTL: 86400,         // 缓存时间（秒），24小时

  // 速率限制配置
  RATE_LIMIT: {
    PER_MINUTE: 10,         // 每分钟最多请求次数
    PER_HOUR: 100,          // 每小时最多请求次数
  },

  // 允许的域名（支持通配符 *）
  ALLOWED_DOMAINS: [
    '*.cjp-jx.workers.dev',
    '*.000180.xyz',
    '*.cencs.com',
    'localhost',
    '127.0.0.1'
  ],
};

// ========== IP 验证正则 ==========
const IPV4_PATTERN = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_PATTERN = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|::)$/;

// ========== 工具函数 ==========
/**
 * 验证 IP 地址格式
 * @param {string} ip - IP 地址
 * @returns {boolean} 是否为有效的 IPv4 或 IPv6 地址
 */
function isValidIp(ip) {
  if (!ip || typeof ip !== 'string') return false;
  return IPV4_PATTERN.test(ip) || IPV6_PATTERN.test(ip);
}

/**
 * HTML 转义函数
 * @param {string} str - 需要转义的字符串
 * @returns {string} 转义后的字符串
 */
function escapeHtml(str) {
  if (!str) return '';
  const htmlEscapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(str).replace(/[&<>"']/g, char => htmlEscapeMap[char]);
}

/**
 * 验证域名是否在白名单中（支持通配符）
 * @param {string} hostname - 要验证的域名
 * @param {string[]} allowedDomains - 允许的域名列表（支持 * 通配符）
 * @returns {boolean} 是否匹配
 */
function isDomainAllowed(hostname, allowedDomains) {
  if (!hostname) return false;

  return allowedDomains.some(pattern => {
    // 将通配符模式转换为正则表达式
    // *.example.com -> ^.*\.example\.com$
    const regexPattern = pattern
      .replace(/\./g, '\\.')  // 转义 .
      .replace(/\*/g, '.*');  // * 转为 .*
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(hostname);
  });
}

/**
 * 检测特殊 IP 地址并返回预定义信息（无需查询上游 API）
 * 支持的特殊地址类型：
 * - RFC 1918 私有地址 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
 * - 环回地址 (127.0.0.0/8, ::1)
 * - 链路本地地址 (169.254.0.0/16, fe80::/10)
 * - IPv6 唯一本地地址 (fc00::/7)
 * - 其他保留地址
 * @param {string} ip - IP 地址字符串
 * @returns {Object|null} 如果是特殊地址，返回预定义的 API 响应格式；否则返回 null
 */
function getSpecialIpInfo(ip) {
  // IPv4 特殊地址检测
  if (IPV4_PATTERN.test(ip)) {
    const parts = ip.split('.').map(Number);

    // 环回地址 (127.0.0.0/8)
    if (parts[0] === 127) {
      return {
        ret: 200,
        msg: 'ok',
        data: {
          ip: ip,
          country: '本机',
          country_id: 'CN',
          area: '本机环回地址',
          region: '',
          region_id: '',
          city: 'Localhost',
          city_id: '',
          district: '',
          district_id: '',
          isp: 'Loopback',
          lat: '',
          lng: ''
        }
      };
    }

    // 私有地址 - 10.0.0.0/8
    if (parts[0] === 10) {
      return {
        ret: 200,
        msg: 'ok',
        data: {
          ip: ip,
          country: '内网',
          country_id: '',
          area: 'A 类私有网络',
          region: '',
          region_id: '',
          city: 'Local Network',
          city_id: '',
          district: '',
          district_id: '',
          isp: 'Private',
          lat: '',
          lng: ''
        }
      };
    }

    // 私有地址 - 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
      return {
        ret: 200,
        msg: 'ok',
        data: {
          ip: ip,
          country: '内网',
          country_id: '',
          area: 'B 类私有网络',
          region: '',
          region_id: '',
          city: 'Local Network',
          city_id: '',
          district: '',
          district_id: '',
          isp: 'Private',
          lat: '',
          lng: ''
        }
      };
    }

    // 私有地址 - 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) {
      return {
        ret: 200,
        msg: 'ok',
        data: {
          ip: ip,
          country: '内网',
          country_id: '',
          area: 'C 类私有网络',
          region: '',
          region_id: '',
          city: 'Local Network',
          city_id: '',
          district: '',
          district_id: '',
          isp: 'Private',
          lat: '',
          lng: ''
        }
      };
    }

    // 链路本地地址 (169.254.0.0/16)
    if (parts[0] === 169 && parts[1] === 254) {
      return {
        ret: 200,
        msg: 'ok',
        data: {
          ip: ip,
          country: '本地链路',
          country_id: '',
          area: '链路本地地址 (APIPA/Link-Local)',
          region: '',
          region_id: '',
          city: 'Link-Local',
          city_id: '',
          district: '',
          district_id: '',
          isp: 'Link-Local',
          lat: '',
          lng: ''
        }
      };
    }

    // 组播地址 (224.0.0.0/4)
    if (parts[0] >= 224 && parts[0] <= 239) {
      return {
        ret: 200,
        msg: 'ok',
        data: {
          ip: ip,
          country: '组播',
          country_id: '',
          area: '组播地址 (Multicast)',
          region: '',
          region_id: '',
          city: 'Multicast',
          city_id: '',
          district: '',
          district_id: '',
          isp: 'Multicast',
          lat: '',
          lng: ''
        }
      };
    }

    // 保留地址 (240.0.0.0/4)
    if (parts[0] >= 240) {
      return {
        ret: 200,
        msg: 'ok',
        data: {
          ip: ip,
          country: '保留',
          country_id: '',
          area: '保留地址 (Reserved)',
          region: '',
          region_id: '',
          city: 'Reserved',
          city_id: '',
          district: '',
          district_id: '',
          isp: 'Reserved',
          lat: '',
          lng: ''
        }
      };
    }

    // 未指定地址 (0.0.0.0/8)
    if (parts[0] === 0) {
      return {
        ret: 200,
        msg: 'ok',
        data: {
          ip: ip,
          country: '未指定',
          country_id: '',
          area: '未指定地址',
          region: '',
          region_id: '',
          city: 'Unspecified',
          city_id: '',
          district: '',
          district_id: '',
          isp: 'Unspecified',
          lat: '',
          lng: ''
        }
      };
    }
  }

  // IPv6 特殊地址检测（简化版）
  if (IPV6_PATTERN.test(ip)) {
    const lower = ip.toLowerCase();

    // 环回地址 (::1)
    if (lower === '::1') {
      return {
        ret: 200,
        msg: 'ok',
        data: {
          ip: ip,
          country: '本机',
          country_id: 'CN',
          area: '本机环回地址',
          region: '',
          region_id: '',
          city: 'Localhost',
          city_id: '',
          district: '',
          district_id: '',
          isp: 'Loopback',
          lat: '',
          lng: ''
        }
      };
    }

    // 链路本地地址 (fe80::/10)
    if (lower.startsWith('fe80:')) {
      return {
        ret: 200,
        msg: 'ok',
        data: {
          ip: ip,
          country: '本地链路',
          country_id: '',
          area: '链路本地地址 (Link-Local)',
          region: '',
          region_id: '',
          city: 'Link-Local',
          city_id: '',
          district: '',
          district_id: '',
          isp: 'Link-Local',
          lat: '',
          lng: ''
        }
      };
    }

    // 唯一本地地址 (fc00::/7)
    if (lower.startsWith('fc') || lower.startsWith('fd')) {
      return {
        ret: 200,
        msg: 'ok',
        data: {
          ip: ip,
          country: '内网',
          country_id: '',
          area: 'IPv6 私有网络',
          region: '',
          region_id: '',
          city: 'Local Network',
          city_id: '',
          district: '',
          district_id: '',
          isp: 'Private',
          lat: '',
          lng: ''
        }
      };
    }

    // 未指定地址 (::)
    if (lower === '::') {
      return {
        ret: 200,
        msg: 'ok',
        data: {
          ip: ip,
          country: '未指定',
          country_id: '',
          area: '未指定地址',
          region: '',
          region_id: '',
          city: 'Unspecified',
          city_id: '',
          district: '',
          district_id: '',
          isp: 'Unspecified',
          lat: '',
          lng: ''
        }
      };
    }
  }

  // 不是特殊地址，返回 null
  return null;
}

/**
 * 生成安全响应头
 * @param {boolean} isApi - 是否为 API 响应
 * @param {string} origin - 请求来源（用于 CORS）
 * @returns {Object} 响应头对象
 */
function getSecurityHeaders(isApi = false, origin = null) {
  const headers = {
    // 防止点击劫持
    'X-Frame-Options': 'SAMEORIGIN',

    // 防止 MIME 类型嗅探
    'X-Content-Type-Options': 'nosniff',

    // XSS 保护
    'X-XSS-Protection': '1; mode=block',

    // Referrer 策略
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };

  // HTML 页面添加 CSP
  if (!isApi) {
    headers['Content-Security-Policy'] =
      "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'";
  }

  // API 响应添加 CORS
  if (isApi && origin) {
    try {
      const originHost = new URL(origin).hostname;
      if (isDomainAllowed(originHost, CONFIG.ALLOWED_DOMAINS)) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
        headers['Access-Control-Allow-Headers'] = 'Content-Type';
        headers['Access-Control-Max-Age'] = '86400';
      }
    } catch (e) {
      // 无效的 Origin，不添加 CORS 头
    }
  }

  return headers;
}

/**
 * 检查 IP 查询结果是否已缓存
 * @param {string} ip - 要查询的 IP 地址
 * @returns {Promise<Object|null>} 缓存的数据或 null
 */
async function checkCache(ip) {
  const apiUrl = `${CONFIG.API_HOST}${CONFIG.API_PATH}?ip=${encodeURIComponent(ip)}`;
  const cache = caches.default;
  const cacheKey = new Request(apiUrl, { method: 'GET' });

  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    return await cachedResponse.json();
  }
  return null;
}

/**
 * 速率限制检查（使用 Cache API）
 * @param {string} clientIp - 客户端 IP
 * @param {ExecutionContext} ctx - Workers 执行上下文
 * @returns {Promise<{allowed: boolean, remaining: number, resetIn: number}>}
 */
async function checkRateLimit(clientIp, ctx) {
  const cache = caches.default;
  const now = Date.now();
  const minuteKey = `ratelimit:${clientIp}:${Math.floor(now / 60000)}`;
  const hourKey = `ratelimit:${clientIp}:${Math.floor(now / 3600000)}`;

  // 检查每分钟限制
  const minuteRequest = new Request(`https://ratelimit.internal/${minuteKey}`);
  let minuteCount = 0;
  const minuteCache = await cache.match(minuteRequest);
  if (minuteCache) {
    const data = await minuteCache.json();
    minuteCount = data.count;
  }

  // 检查每小时限制
  const hourRequest = new Request(`https://ratelimit.internal/${hourKey}`);
  let hourCount = 0;
  const hourCache = await cache.match(hourRequest);
  if (hourCache) {
    const data = await hourCache.json();
    hourCount = data.count;
  }

  // 判断是否超限
  if (minuteCount >= CONFIG.RATE_LIMIT.PER_MINUTE) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: 60 - (Math.floor(now / 1000) % 60)
    };
  }

  if (hourCount >= CONFIG.RATE_LIMIT.PER_HOUR) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: 3600 - (Math.floor(now / 1000) % 3600)
    };
  }

  // 更新计数
  minuteCount++;
  hourCount++;

  const minuteResponse = new Response(JSON.stringify({ count: minuteCount }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60'
    }
  });

  const hourResponse = new Response(JSON.stringify({ count: hourCount }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600'
    }
  });

  ctx.waitUntil(cache.put(minuteRequest, minuteResponse));
  ctx.waitUntil(cache.put(hourRequest, hourResponse));

  return {
    allowed: true,
    remaining: Math.min(
      CONFIG.RATE_LIMIT.PER_MINUTE - minuteCount,
      CONFIG.RATE_LIMIT.PER_HOUR - hourCount
    ),
    resetIn: 60 - (Math.floor(now / 1000) % 60)
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const userAgent = request.headers.get('User-Agent') || '';
    const origin = request.headers.get('Origin');
    const referer = request.headers.get('Referer');

    // 1. 获取访问者 IP
    const clientIp = request.headers.get('CF-Connecting-IP');

    // 2. 处理 OPTIONS 预检请求（CORS）
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getSecurityHeaders(true, origin)
      });
    }

    // 3. 特殊路径处理
    // 健康检查端点
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getSecurityHeaders(true)
        }
      });
    }

    // robots.txt
    if (url.pathname === '/robots.txt') {
      return new Response('User-agent: *\nAllow: /', {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          ...getSecurityHeaders(false)
        }
      });
    }

    // favicon.ico（返回 Cloudflare 官方图标）
    if (url.pathname === '/favicon.ico') {
      try {
        // 检查缓存
        const cache = caches.default;
        const faviconUrl = 'https://www.cloudflare.com/favicon.ico';
        const cacheKey = new Request(faviconUrl);

        let cachedFavicon = await cache.match(cacheKey);

        if (cachedFavicon) {
          // 缓存命中，直接返回
          return new Response(cachedFavicon.body, {
            headers: {
              'Content-Type': 'image/x-icon',
              'Cache-Control': 'public, max-age=86400',
              ...getSecurityHeaders(false)
            }
          });
        }

        // 缓存未命中，从 Cloudflare 获取
        const faviconResponse = await fetch(faviconUrl);

        if (faviconResponse.ok) {
          const faviconData = await faviconResponse.arrayBuffer();

          // 缓存图标（24小时）
          const responseToCache = new Response(faviconData, {
            headers: {
              'Content-Type': 'image/x-icon',
              'Cache-Control': 'public, max-age=86400'
            }
          });

          ctx.waitUntil(cache.put(cacheKey, responseToCache.clone()));

          return new Response(faviconData, {
            headers: {
              'Content-Type': 'image/x-icon',
              'Cache-Control': 'public, max-age=86400',
              ...getSecurityHeaders(false)
            }
          });
        }
      } catch (e) {
        // 发生错误，返回 204
      }

      // 降级：返回 204
      return new Response(null, {
        status: 204,
        headers: getSecurityHeaders(false)
      });
    }

    // 4. CLI (curl) 模式：直接返回纯文本 IP
    if (userAgent.toLowerCase().includes('curl')) {
      return new Response(`${clientIp}\n`, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          ...getSecurityHeaders(false)
        },
      });
    }

    // 5. API 端点：返回 IP 信息的 JSON
    if (url.pathname === '/api/query') {
      // 5.1 域名验证（先验证权限）
      let isAuthorized = false;
      const requestHost = url.hostname;

      // 检查 Origin
      if (origin) {
        try {
          const originHost = new URL(origin).hostname;
          isAuthorized = isDomainAllowed(originHost, CONFIG.ALLOWED_DOMAINS);
        } catch (e) {
          // 无效的 Origin
        }
      }

      // 检查 Referer（如果 Origin 验证失败）
      if (!isAuthorized && referer) {
        try {
          const refererHost = new URL(referer).hostname;
          isAuthorized = isDomainAllowed(refererHost, CONFIG.ALLOWED_DOMAINS) ||
                        refererHost === requestHost;
        } catch (e) {
          // 无效的 Referer
        }
      }

      // 如果既没有 Origin 也没有 Referer，检查是否是同域请求
      if (!isAuthorized && !origin && !referer) {
        isAuthorized = false;  // 必须有 Referer 或 Origin
      }

      if (!isAuthorized) {
        return new Response(JSON.stringify({
          ret: 403,
          msg: '访问被拒绝：请从授权域名访问'
        }), {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            ...getSecurityHeaders(true, origin)
          }
        });
      }

      // 5.2 检查缓存（优先返回缓存数据，不计入速率限制）
      const queryIp = url.searchParams.get('ip') || clientIp;
      const cachedData = await checkCache(queryIp);

      if (cachedData) {
        // 缓存命中，直接返回，不消耗速率限制配额
        return new Response(JSON.stringify(cachedData), {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache',
            'X-Cache-Status': 'HIT',  // 标记缓存命中
            ...getSecurityHeaders(true, origin)
          },
        });
      }

      // 5.3 缓存未命中，进行速率限制检查（只对需要查询上游 API 的请求限制）
      const rateLimit = await checkRateLimit(clientIp, ctx);
      if (!rateLimit.allowed) {
        return new Response(JSON.stringify({
          ret: 429,
          msg: `请求过于频繁，请在 ${rateLimit.resetIn} 秒后重试`
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': rateLimit.resetIn.toString(),
            'X-RateLimit-Limit': CONFIG.RATE_LIMIT.PER_MINUTE.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetIn.toString(),
            ...getSecurityHeaders(true, origin)
          }
        });
      }

      // 5.4 查询上游 API（会自动缓存结果）
      const apiResult = await queryIpInfoWithCache(queryIp, env.APPCODE, ctx);

      return new Response(JSON.stringify(apiResult), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache',
          'X-Cache-Status': 'MISS',  // 标记缓存未命中
          'X-RateLimit-Limit': CONFIG.RATE_LIMIT.PER_MINUTE.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetIn.toString(),
          ...getSecurityHeaders(true, origin)
        },
      });
    }

    // 6. 确定目标 IP（支持 URL 参数）
    let targetIp = url.searchParams.get('ip') || clientIp;
    let errorMessage = null;

    // 验证 IP 格式
    if (url.searchParams.get('ip') && !isValidIp(targetIp)) {
      targetIp = clientIp;
      errorMessage = '请输入有效的 IPv4 或 IPv6 地址';
    }

    // 7. 渲染页面（异步加载模式 - 仅显示 IP，其他字段客户端加载）
    return new Response(renderPage(targetIp, errorMessage), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...getSecurityHeaders(false)
      },
    });
  },
};

/**
 * 带缓存的 IP 查询核心函数
 * @param {string} ip - 要查询的 IP 地址
 * @param {string} appCode - API 授权码
 * @param {ExecutionContext} ctx - Workers 执行上下文
 * @returns {Promise<Object|null>} API 响应数据或 null
 */
async function queryIpInfoWithCache(ip, appCode, ctx) {
  // 检查是否为特殊 IP 地址（RFC 1918 私有地址、环回地址等）
  // 特殊地址直接返回预定义信息
  const specialIpInfo = getSpecialIpInfo(ip);
  if (specialIpInfo) {
    return specialIpInfo;
  }

  const apiUrl = `${CONFIG.API_HOST}${CONFIG.API_PATH}?ip=${encodeURIComponent(ip)}`;

  // --- 缓存逻辑开始 ---
  const cache = caches.default;
  const cacheKey = new Request(apiUrl, { method: 'GET' });

  // 1. 尝试从缓存读取
  let cachedResponse = await cache.match(cacheKey);

  if (cachedResponse) {
    return await cachedResponse.json();
  }

  // 2. 缓存未命中，请求源站 API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        "Authorization": `APPCODE ${appCode}`
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();

      // 3. 只有当返回成功 (ret=200) 时才写入缓存
      if (data && data.ret === 200) {
        const responseToCache = new Response(JSON.stringify(data), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': `public, max-age=${CONFIG.CACHE_TTL}`
          }
        });

        ctx.waitUntil(cache.put(cacheKey, responseToCache));
      }
      return data;
    }

    // HTTP 错误
    return {
      ret: response.status,
      msg: `API 请求失败: ${response.statusText}`
    };
  } catch (error) {
    // 网络错误或超时
    if (error.name === 'AbortError') {
      return {
        ret: 504,
        msg: 'API 请求超时'
      };
    }
    return {
      ret: 500,
      msg: `网络错误: ${error.message}`
    };
  }
}

// --- HTML 生成部分 ---

function renderPage(targetIp, errorMessage) {
  // 生成表格 HTML（优化的异步加载模式：只显示 IP 地址和加载状态）
  const locationHtml = `
    <div class="info-table">
      <div class="table-row">
        <div class="table-label">IP 地址</div>
        <div class="table-value">${escapeHtml(targetIp)}</div>
      </div>
      <div class="table-row loading-row">
        <div class="table-label">
          <span class="loading-icon"></span>
        </div>
        <div class="table-value">
          <span class="loading-text">查询中.</span>
        </div>
      </div>
    </div>
  `;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IP 地址查询</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
            background: #ffffff;
            min-height: 100vh;
            padding: 0;
            color: #000000;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
        }

        .container {
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
            padding: 30px 20px;
        }

        h1 {
            font-size: 32px;
            font-weight: 500;
            margin-bottom: 36px;
            letter-spacing: -0.3px;
            color: #1a1a1a;
        }

        .subtitle {
            color: #666666;
            font-size: 14px;
            margin-bottom: 48px;
            font-weight: 400;
        }

        .ip-display {
            margin-top: 32px;
            margin-bottom: 40px;
        }

        .info-table {
            margin-top: 0;
            border: 1px solid #d0d0d0;
            border-radius: 4px;
            overflow: hidden;
        }

        .table-row {
            display: flex;
            border-bottom: 1px solid #e5e5e5;
            transition: background-color 0.15s ease;
        }

        .table-row:last-child {
            border-bottom: none;
        }

        .table-row:hover {
            background-color: #f5f5f5;
        }

        .table-label {
            flex: 0 0 100px;
            padding: 14px 16px;
            font-size: 13px;
            color: #555555;
            font-weight: 500;
            border-right: 1px solid #e5e5e5;
            background-color: #f8f8f8;
        }

        .table-value {
            flex: 1;
            padding: 14px 16px;
            font-size: 14px;
            color: #1a1a1a;
            font-weight: 400;
            font-family: 'Consolas', 'SF Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', monospace;
            letter-spacing: 0.3px;
            word-break: break-all;
            background-color: #ffffff;
        }

        .table-value.error {
            color: #d32f2f;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        /* 加载动画 */
        .loading-icon {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 2px solid #e5e5e5;
            border-top-color: #999999;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
            to {
                transform: rotate(360deg);
            }
        }

        .loading-text {
            display: inline-block;
            color: #999999;
            animation: dots 2.4s steps(6, end) infinite;
        }

        @keyframes dots {
            0% { content: '查询中.'; }
            16.66% { content: '查询中..'; }
            33.32% { content: '查询中...'; }
            49.98% { content: '查询中....'; }
            66.64% { content: '查询中.....'; }
            83.3% { content: '查询中......'; }
            100% { content: '查询中.'; }
        }

        .loading-text::after {
            content: '';
            animation: dots-content 2.4s steps(6, end) infinite;
        }

        @keyframes dots-content {
            0% { content: ''; }
            16.66% { content: '.'; }
            33.32% { content: '..'; }
            49.98% { content: '...'; }
            66.64% { content: '....'; }
            83.3% { content: '.....'; }
        }

        .search-section {
            margin-bottom: 0;
        }

        .search-section form {
            display: flex;
            gap: 0;
            align-items: stretch;
            border: 1px solid #d0d0d0;
            border-radius: 4px;
            overflow: hidden;
            transition: border-color 0.2s ease;
        }

        .search-section form:focus-within {
            border-color: #999999;
        }

        input[type="text"] {
            flex: 1;
            padding: 14px 16px;
            border: none;
            font-size: 15px;
            font-family: 'Consolas', 'SF Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', monospace;
            letter-spacing: 0.3px;
            transition: background-color 0.2s ease;
            outline: none;
            background: #fafafa;
            color: #1a1a1a;
        }

        input[type="text"]:focus {
            background: #ffffff;
        }

        input[type="text"]::placeholder {
            color: #999999;
        }

        .btn {
            flex-shrink: 0;
            padding: 14px 28px;
            background: #fafafa;
            color: #333333;
            border: none;
            border-left: 1px solid #e0e0e0;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            letter-spacing: 0.3px;
            white-space: nowrap;
        }

        .btn:hover {
            background: #f0f0f0;
        }

        .btn:active {
            background: #e5e5e5;
        }

        .btn:disabled {
            background: #fafafa;
            color: #cccccc;
            cursor: not-allowed;
        }

        .error-message {
            color: #d32f2f;
            font-size: 13px;
            margin-top: 10px;
            display: none;
        }

        .error-message.show {
            display: block;
        }

        .footer {
            text-align: center;
            margin-top: 48px;
            color: #d0d0d0;
            font-size: 11px;
            font-weight: 400;
        }

        @media (max-width: 768px) {
            .container {
                padding: 40px 24px;
            }

            h1 {
                font-size: 22px;
                margin-bottom: 28px;
            }

            .search-section form {
                flex-direction: column;
                border: none;
                gap: 10px;
            }

            input[type="text"] {
                border: 1px solid #d0d0d0;
                border-radius: 4px;
            }

            input[type="text"]:focus {
                border-color: #999999;
            }

            .btn {
                width: 100%;
                padding: 14px 0;
                border: 1px solid #d0d0d0;
                border-radius: 4px;
                border-left: 1px solid #d0d0d0;
            }

            .btn:hover {
                border-color: #999999;
            }

            .divider {
                margin: 36px 0 28px 0;
            }

            .table-label {
                flex: 0 0 85px;
                padding: 12px 14px;
                font-size: 12px;
            }

            .table-value {
                padding: 12px 14px;
                font-size: 13px;
            }

            .footer {
                margin-top: 36px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>IP 地址查询</h1>
        <div class="search-section">
            <form method="POST" action="" onsubmit="return handleSubmit(event)">
                <input
                    type="text"
                    name="input_ip"
                    id="ip-input"
                    placeholder="支持 IPv4/IPv6 地址"
                    autocomplete="off"
                >
                ${errorMessage ? `<div class="error-message show">${escapeHtml(errorMessage)}</div>` : '<div class="error-message" id="error-message"></div>'}
                <button type="submit" class="btn">
                    <span>查询</span>
                </button>
            </form>
        </div>

        <div class="ip-display">
            ${locationHtml}
        </div>
    </div>

    <script>
        // 页面加载后自动查询 IP 信息
        const currentIp = document.querySelector('.table-value').textContent;

        window.addEventListener('load', () => {
            queryIpInfo(currentIp);

            // 自动聚焦到输入框
            const ipInput = document.getElementById('ip-input');
            if (ipInput) {
                // 检测是否为移动设备
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
                              || window.innerWidth <= 768;

                if (isMobile) {
                    // 移动端：先设置 readonly 再聚焦，避免弹出键盘
                    ipInput.setAttribute('readonly', 'readonly');
                    ipInput.focus();

                    // 用户点击或触摸时移除 readonly，允许输入
                    ipInput.addEventListener('click', function() {
                        this.removeAttribute('readonly');
                    }, { once: true });

                    ipInput.addEventListener('touchstart', function() {
                        this.removeAttribute('readonly');
                    }, { once: true });
                } else {
                    // PC 端：直接聚焦，便于粘贴
                    ipInput.focus();
                }
            }
        });

        // 异步查询 IP 信息
        async function queryIpInfo(ip) {
            try {
                const response = await fetch('/api/query?ip=' + encodeURIComponent(ip));
                if (!response.ok) {
                    throw new Error('API 请求失败');
                }

                const data = await response.json();

                if (data && data.ret === 200) {
                    updateTable(data.data);
                } else {
                    showError('查询失败：' + (data.msg || 'API 无响应'));
                }
            } catch (error) {
                console.error('查询错误:', error);
                showError('查询失败：网络错误');
            }
        }

        // 更新表格数据（动态创建行）
        function updateTable(info) {
            const {
                isp, area,
                country, country_id,
                region, region_id,
                city, city_id,
                district, district_id,
                lat, lng
            } = info;

            // 1. 移除加载状态行
            const loadingRow = document.querySelector('.loading-row');
            if (loadingRow) {
                loadingRow.remove();
            }

            // 2. 定义字段映射（按顺序）
            const fields = [
                { key: 'country', label: '国家', value: country_id ? (country + ' (' + country_id + ')') : country },
                { key: 'area', label: '区域', value: area },
                { key: 'region', label: '省份', value: region_id ? (region + ' (' + region_id + ')') : region },
                { key: 'city', label: '城市', value: city_id ? (city + ' (' + city_id + ')') : city },
                { key: 'district', label: '区县', value: district_id ? (district + ' (' + district_id + ')') : district },
                { key: 'isp', label: '运营商', value: isp },
                { key: 'latlng', label: '经纬度', value: (lat && lng) ? (lat + ', ' + lng) : null }
            ];

            // 3. 动态创建行（只创建有值的行）
            const table = document.querySelector('.info-table');
            fields.forEach(field => {
                if (field.value) {
                    const row = document.createElement('div');
                    row.className = 'table-row';

                    const label = document.createElement('div');
                    label.className = 'table-label';
                    label.textContent = field.label;

                    const value = document.createElement('div');
                    value.className = 'table-value';
                    value.textContent = field.value;

                    row.appendChild(label);
                    row.appendChild(value);
                    table.appendChild(row);
                }
            });
        }

        // 显示错误信息
        function showError(message) {
            // 移除加载状态行
            const loadingRow = document.querySelector('.loading-row');
            if (loadingRow) {
                loadingRow.remove();
            }
        }

        // IP 验证函数（与服务端保持一致）
        function isValidIp(ip) {
            if (!ip || typeof ip !== 'string') return false;
            const ipv4Pattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
            const ipv6Pattern = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|::)$/;
            return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
        }

        // 处理表单提交
        function handleSubmit(event) {
            event.preventDefault();

            const input = document.getElementById('ip-input');
            const errorMsg = document.getElementById('error-message');
            const ip = input.value.trim();

            if (!ip) {
                if (errorMsg) {
                    errorMsg.textContent = '请输入 IP 地址';
                    errorMsg.classList.add('show');
                }
                return false;
            }

            if (!isValidIp(ip)) {
                if (errorMsg) {
                    errorMsg.textContent = '请输入有效的 IPv4 或 IPv6 地址';
                    errorMsg.classList.add('show');
                }
                return false;
            }

            // 隐藏错误消息
            if (errorMsg) {
                errorMsg.classList.remove('show');
            }

            // 跳转到新 IP 查询页面
            window.location.href = '/?ip=' + encodeURIComponent(ip);
            return false;
        }
    </script>
</body>
</html>`;
}
