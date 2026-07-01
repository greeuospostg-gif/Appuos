// js/config-env.js
(function() {
    'use strict';
    
    // تحديد البيئة تلقائياً
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || 
                   hostname === '127.0.0.1' || 
                   hostname === '';
    
    // إعداد الـ BASE_URL حسب البيئة
    window.APP_CONFIG = {
        BASE_URL: isLocal ? 
            'http://localhost:3000' : 
            'https://your-app.cyclic.app', // غير هذا لرابطك بعد الرفع
        
        ENV: isLocal ? 'development' : 'production',
        IS_LOCAL: isLocal
    };
    
    console.log(`🚀 تشغيل في وضع: ${window.APP_CONFIG.ENV}`);
    console.log(`🔗 BASE_URL: ${window.APP_CONFIG.BASE_URL}`);
})();