// src/utils/error-handler.js
export class ErrorHandler {
  static init() {
    if (typeof window === 'undefined') return;
    
    // 拦截 fetch 请求中的扩展错误
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      
      // 过滤广告拦截扩展的请求
      if (url.includes('adblock360.com') || url.includes('filtering.adblock360.com')) {
        console.log('🔕 阻止扩展请求:', url);
        return Promise.reject(new Error('Blocked by error handler'));
      }
      
      return originalFetch.apply(this, args).catch(error => {
        // 过滤扩展相关的网络错误
        if (error.message.includes('Failed to fetch') && url.includes('adblock')) {
          console.log('🔕 忽略扩展网络错误');
          return Promise.resolve(new Response(null, { status: 200 }));
        }
        throw error;
      });
    };
    
    // 拦截 XMLHttpRequest 中的扩展错误
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      if (typeof url === 'string' && 
          (url.includes('adblock360.com') || url.includes('filtering.adblock360.com'))) {
        console.log('🔕 阻止XHR扩展请求:', url);
        this._blocked = true;
        return;
      }
      originalXHROpen.apply(this, [method, url, ...rest]);
    };
    
    const originalXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(...args) {
      if (this._blocked) {
        console.log('🔕 跳过被阻止的XHR请求');
        return;
      }
      originalXHRSend.apply(this, args);
    };
  }
  
  static isExtensionError(error) {
    if (!error || !error.message) return false;
    const message = error.message.toLowerCase();
    return message.includes('adblock') || 
           message.includes('cors policy') || 
           message.includes('failed to fetch');
  }
}