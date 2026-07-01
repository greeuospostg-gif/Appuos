// search.js - نظام البحث المزدوج مع الأسماء الصحيحة
class SearchApp {
    constructor() {
        this.state = {
            searchResults: [],
            currentPage: 1,
            itemsPerPage: 50
        };
        
        // النظام المزدوج المضاف
        this.usingSupabase = false;
        this.supabase = null;
        this.SUPABASE_URL = 'https://rvjacvrrpguehbapvewe.supabase.co';
        this.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2amFjdnJycGd1ZWhiYXB2ZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMjUxNTksImV4cCI6MjA3ODYwMTE1OX0.wSavKzxKOF7-56G-pzDMtbXNrCNAbGs0wvadw-cilBg';
        
        // الحفاظ على الـ APIs الأصلية
        this.BASE_URL = "http://localhost:3000";
        this.API = {
            SEARCH: `${this.BASE_URL}/api/searchbk`,
            STORES: `${this.BASE_URL}/api/stores`,
            SUPPLIERS: `${this.BASE_URL}/api/suppliers`
        };
        
        this.dom = this._initDOM();
        this._bindEvents();
        this.init();
    }

    _initDOM() {
        const ids = [
            'userInfo', 'storeSelect', 'itemSearch', 'supplierSelect',
            'searchResults', 'resultsCount', 'toast', 'connectionStatus',
            'statusText', 'statusIndicator', 'connectionInfo', 'switchBtn'
        ];
        const dom = {};
        ids.forEach(id => {
            dom[id] = document.getElementById(id);
        });
        return dom;
    }

    _bindEvents() {
        // بحث عند الضغط على Enter في حقل البحث
        this.dom.itemSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.search();
        });

        // زر تبديل المصدر
        if (this.dom.switchBtn) {
            this.dom.switchBtn.addEventListener('click', () => {
                this.switchDataSource();
            });
        }
    }

    async init() {
        try {
            // إضافة: تهيئة النظام المزدوج
            await this.initializeDualSystem();
            
            this._loadUserInfo();
            await this._loadStores();
            await this._loadSuppliers();
            this.showMessage('✅ تم تهيئة نظام البحث', 'success');
        } catch (error) {
            console.error('Error initializing:', error);
            this.showMessage('❌ خطأ في التهيئة', 'error');
        }
    }

    /**
     * إضافة: تهيئة النظام المزدوج
     */
    async initializeDualSystem() {
        try {
            this.updateConnectionStatus('connecting', '🔗 جاري الاتصال...', 'جاري اختبار الاتصال...');

            // محاولة الاتصال بـ Supabase أولاً
            await this.initializeSupabase();
            this.usingSupabase = true;
            this.updateConnectionStatus('supabase', '🌐 Supabase مباشر', 'اتصال مباشر بقاعدة البيانات');
            console.log('✅ النظام المزدوج: تم التوصيل بـ Supabase');
        } catch (error) {
            // الاستمرار بالنظام المحلي إذا فشل Supabase
            this.usingSupabase = false;
            this.updateConnectionStatus('local', '🔗 اتصال محلي', 'اتصال بخادم الاحتياطي');
            console.log('🔶 النظام المزدوج: استخدام النظام المحلي');
        }
    }

    /**
     * إضافة: تهيئة Supabase
     */
    async initializeSupabase() {
        return new Promise((resolve, reject) => {
            try {
                if (typeof window.supabase === 'undefined') {
                    const script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
                    script.onload = () => {
                        this.createSupabaseClient()
                            .then(() => resolve(true))
                            .catch(reject);
                    };
                    script.onerror = () => reject(new Error('فشل تحميل Supabase'));
                    document.head.appendChild(script);
                } else {
                    this.createSupabaseClient()
                        .then(() => resolve(true))
                        .catch(reject);
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * إضافة: إنشاء عميل Supabase
     */
    async createSupabaseClient() {
        return new Promise((resolve, reject) => {
            try {
                this.supabase = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_KEY);
                
                // اختبار الاتصال
                this.supabase.from('items').select('count').limit(1)
                    .then(({ error }) => {
                        if (error) reject(error);
                        else resolve(true);
                    })
                    .catch(reject);
                    
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * إضافة: تحديث شريط حالة الاتصال
     */
    updateConnectionStatus(status, message, info = '') {
        if (!this.dom.connectionStatus) return;

        const statusText = this.dom.statusText;
        const statusIndicator = this.dom.statusIndicator;
        const connectionInfo = this.dom.connectionInfo;
        const switchBtn = this.dom.switchBtn;

        if (!statusText || !statusIndicator || !connectionInfo || !switchBtn) return;

        // تحديث النص والمظهر
        this.dom.connectionStatus.className = `connection-status ${status}`;
        statusText.textContent = message;
        connectionInfo.textContent = info;

        // تحديث مؤشر الحالة
        if (status === 'supabase') {
            statusIndicator.className = 'status-indicator status-online';
            switchBtn.textContent = 'التبديل للمحلي';
            switchBtn.disabled = false;
        } else if (status === 'local') {
            statusIndicator.className = 'status-indicator status-local';
            switchBtn.textContent = 'التبديل للسيرفر';
            switchBtn.disabled = false;
        } else {
            statusIndicator.className = 'status-indicator status-offline';
            switchBtn.textContent = 'محاولة إعادة الاتصال';
            switchBtn.disabled = false;
        }
    }

    /**
     * إضافة: تبديل مصدر البيانات
     */
    switchDataSource() {
        try {
            const newMode = !this.usingSupabase;
            
            if (newMode) {
                // محاولة التبديل إلى Supabase
                this.initializeSupabase()
                    .then(() => {
                        this.usingSupabase = true;
                        this.updateConnectionStatus('supabase', '🌐 Supabase مباشر', 'اتصال مباشر بقاعدة البيانات');
                        this.showMessage('✅ تم التبديل إلى Supabase', 'success');
                        this.reloadData();
                    })
                    .catch(() => {
                        this.showMessage('❌ فشل الاتصال بـ Supabase', 'error');
                    });
            } else {
                // التبديل إلى المحلي
                this.usingSupabase = false;
                this.updateConnectionStatus('local', '🔗 اتصال محلي', 'اتصال بخادم الاحتياطي');
                this.showMessage('🔄 تم التبديل إلى الاتصال المحلي', 'success');
                this.reloadData();
            }
        } catch (error) {
            console.error('Error switching data source:', error);
            this.showMessage('❌ فشل في تبديل المصدر', 'error');
        }
    }

    /**
     * إضافة: إعادة تحميل البيانات
     */
    async reloadData() {
        try {
            await this._loadStores();
            await this._loadSuppliers();
            if (this.state.searchResults.length > 0) {
                this.search(); // إعادة البحث إذا كانت هناك نتائج سابقة
            }
        } catch (error) {
            console.error('Error reloading data:', error);
        }
    }

    _loadUserInfo() {
        const username = localStorage.getItem("username") || sessionStorage.getItem("username");
        if (username && this.dom.userInfo) {
            this.dom.userInfo.textContent = `مرحباً: ${username}`;
        }
    }

    async _loadStores() {
        try {
            let stores = [];

            // إضافة: محاولة التحميل من Supabase أولاً
            if (this.usingSupabase && this.supabase) {
                try {
                    const { data, error } = await this.supabase
                        .from('stores')
                        .select('store_id, store_name')
                        .order('store_name');
                    
                    if (!error && data) {
                        stores = data;
                        console.log('✅ تم تحميل المخازن من Supabase');
                    } else {
                        throw error;
                    }
                } catch (supabaseError) {
                    console.warn('⚠️ فشل تحميل المخازن من Supabase، استخدام المحلي');
                    // الاستمرار إلى النظام المحلي
                }
            }

            // النظام المحلي (الكود الأصلي)
            if (stores.length === 0) {
                const response = await fetch(`${this.API.STORES}`);
                if (!response.ok) {
                    throw new Error(`فشل في تحميل المخازن: ${response.status}`);
                }
                const data = await response.json();
                stores = data.stores || data;
            }
            
            if (this.dom.storeSelect) {
                this.dom.storeSelect.innerHTML = '<option value="">كل المخازن</option>';
                
                stores.forEach(store => {
                    const option = document.createElement('option');
                    option.value = store.store_id;
                    option.textContent = store.store_name || store.name || `الفرع ${store.store_id}`;
                    this.dom.storeSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading stores:', error);
            this.showMessage('❌ خطأ في تحميل المخازن', 'error');
        }
    }

    async _loadSuppliers() {
        try {
            let suppliers = [];

            // إضافة: محاولة التحميل من Supabase أولاً
            if (this.usingSupabase && this.supabase) {
                try {
                    const { data, error } = await this.supabase
                        .from('suppliers')
                        .select('supplierid, supplier_name')
                        .order('supplier_name');
                    
                    if (!error && data) {
                        suppliers = data;
                        console.log('✅ تم تحميل الموردين من Supabase');
                    } else {
                        throw error;
                    }
                } catch (supabaseError) {
                    console.warn('⚠️ فشل تحميل الموردين من Supabase، استخدام المحلي');
                    // الاستمرار إلى النظام المحلي
                }
            }

            // النظام المحلي (الكود الأصلي)
            if (suppliers.length === 0) {
                const response = await fetch(`${this.API.SUPPLIERS}`);
                if (!response.ok) {
                    throw new Error(`فشل في تحميل الموردين: ${response.status}`);
                }
                const data = await response.json();
                suppliers = data.suppliers || data;
            }
            
            if (this.dom.supplierSelect) {
                this.dom.supplierSelect.innerHTML = '<option value="">كل الموردين</option>';
                
                suppliers.forEach(supplier => {
                    const option = document.createElement('option');
                    option.value = supplier.supplierid;
                    option.textContent = supplier.supplier_nm || supplier.name || `المورد ${supplier.supplierid}`;
                    this.dom.supplierSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading suppliers:', error);
            this.showMessage('❌ خطأ في تحميل الموردين', 'error');
        }
    }

    async search() {
        const storeId = this.dom.storeSelect.value || '';
        const itemQuery = this.dom.itemSearch.value.trim() || '';
        const supplierId = this.dom.supplierSelect.value || '';

        if (!itemQuery && !storeId && !supplierId) {
            this.showMessage('⚠️ أدخل معايير البحث على الأقل', 'warning');
            return;
        }

        try {
            this.showMessage('🔍 جاري البحث...', 'info');

            let results = [];

            // إضافة: محاولة البحث في Supabase أولاً
            if (this.usingSupabase && this.supabase) {
                try {
                    results = await this.supabaseSearch(storeId, itemQuery, supplierId);
                    console.log('✅ تم البحث في Supabase');
                } catch (supabaseError) {
                    console.warn('⚠️ فشل البحث في Supabase، استخدام المحلي');
                    // الاستمرار إلى البحث المحلي
                }
            }

            // النظام المحلي (الكود الأصلي)
            if (results.length === 0) {
                const params = new URLSearchParams();
                if (itemQuery) params.append('q', itemQuery);
                if (storeId) params.append('store_id', storeId);
                if (supplierId) params.append('supplierid', supplierId);

                const response = await fetch(`${this.API.SEARCH}/inventory?${params}`);
                
                if (!response.ok) {
                    throw new Error(`فشل في البحث: ${response.status}`);
                }
                
                const data = await response.json();

                if (data.success && data.items && data.items.length > 0) {
                    results = data.items;
                }
            }

            if (results.length > 0) {
                this.state.searchResults = results;
                this.renderResults();
                this.showMessage(`✅ تم العثور على ${results.length} نتيجة`, 'success');
            } else {
                this.state.searchResults = [];
                this.renderResults();
                this.showMessage('❌ لم يتم العثور على نتائج', 'warning');
            }
        } catch (error) {
            console.error('Error searching:', error);
            this.showMessage('❌ خطأ في البحث', 'error');
        }
    }

    /**
     /**
 * إضافة: البحث في Supabase - مع التعامل مع الأعمدة المختلفة
 */
    async supabaseSearch(storeId, itemQuery, supplierId) {
        try {
            console.log('🔍 بدء البحث في Supabase...');
            
            // محاولة أولى: استخدام أعمدة أساسية فقط
            let query = this.supabase
                .from('items')
                .select('item_id, item_nm')
                .limit(100);

            // تطبيق الفلاتر الأساسية
            if (itemQuery) {
                query = query.or(`item_id.ilike.%${itemQuery}%,item_nm.ilike.%${itemQuery}%`);
            }
            if (storeId) {
                query = query.eq('store_id', storeId);
            }
            if (supplierId) {
                query = query.eq('supplierid', supplierId);
            }

            const { data, error } = await query;

            if (error) {
                console.warn('⚠️ فشل البحث الأساسي، محاولة البحث البديل...');
                return await this.fallbackSupabaseSearch(storeId, itemQuery, supplierId);
            }

            console.log(`✅ تم العثور على ${data.length} نتيجة من Supabase`);

            // تحويل البيانات إلى تنسيق متوافق
            return data.map(item => ({
                item_id: item.item_id,
                item_nm: item.item_nm,
                unit_type: 'قطعة',
                units_per_package: 1,
                tran_date: new Date().toISOString().split('T')[0],
                store_id: item.store_id || '',
                supplierid: item.supplierid || '',
                store_name: '',
                supplier_nm: '',
                item_qty: 0,
                discount_type: '',
                discount_value: 0,
                last_in_date: new Date().toISOString().split('T')[0],
                expiry_date: ''
            }));

        } catch (error) {
            console.error('❌ خطأ في البحث بـ Supabase:', error);
            throw error;
        }
    }

    /**
     * إضافة: مسح البحث
     */
    clearSearch() {
        this.dom.itemSearch.value = '';
        this.dom.storeSelect.value = '';
        this.dom.supplierSelect.value = '';
        
        this.state.searchResults = [];
        this.renderResults();
        
        if (this.dom.resultsCount) {
            this.dom.resultsCount.style.display = 'none';
        }
        
        this.showMessage('🗑️ تم مسح نتائج البحث', 'info');
    }

    // الحفاظ على جميع الدوال الأصلية بدون تغيير
    renderResults() {
        const resultsDiv = this.dom.searchResults;
        const countDiv = this.dom.resultsCount;
        
        if (!resultsDiv) return;

        if (this.state.searchResults.length === 0) {
            resultsDiv.innerHTML = '<div class="no-results">❌ لا توجد نتائج للبحث</div>';
            if (countDiv) countDiv.style.display = 'none';
            return;
        }

        // تحديث عداد النتائج
        if (countDiv) {
            countDiv.textContent = `عدد النتائج: ${this.state.searchResults.length}`;
            countDiv.style.display = 'inline-block';
        }

        // إنشاء الجدول
        const table = document.createElement('table');
        table.className = 'results-table';
        
        // رأس الجدول
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>التاريخ</th>
                <th>كود الفرع</th>
                <th>اسم الفرع</th>
                <th>كود المورد</th>
                <th>اسم المورد</th>
                <th>كود الصنف</th>
                <th>اسم الصنف</th>
                <th>الكمية</th>
                <th>الوحدة</th>
                <th>العبوة</th>
                <th>آخر دخول</th>
                <th>نوع الخصم</th>
                <th>قيمة الخصم</th>
                <th>انتهاء الصلاحية</th>
            </tr>
        `;
        table.appendChild(thead);

        // جسم الجدول
        const tbody = document.createElement('tbody');
        
        this.state.searchResults.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${this._formatDate(item.tran_date)}</td>
                <td>${item.store_id}</td>
                <td>${item.store_name || ''}</td>
                <td>${item.supplierid || ''}</td>
                <td>${item.supplier_nm || ''}</td>
                <td><strong>${item.item_id}</strong></td>
                <td>${item.item_nm || ''}</td>
                <td>${this._formatNumber(item.item_qty)}</td>
                <td>${item.unit_type || 'قطعة'}</td>
                <td>${this._formatNumber(item.units_per_package)}</td>
                <td>${this._formatDate(item.last_in_date)}</td>
                <td>${item.discount_type || 'لا يوجد'}</td>
                <td>${this._formatNumber(item.discount_value)}</td>
                <td>${this._formatDate(item.expiry_date)}</td>
            `;
            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        resultsDiv.innerHTML = '';
        resultsDiv.appendChild(table);
    }

    _formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ar-EG');
    }

    _formatNumber(number) {
        if (!number && number !== 0) return '';
        return parseFloat(number).toLocaleString('ar-EG');
    }

    showMessage(message, type = 'info') {
        const toast = this.dom.toast;
        if (!toast) {
            console.log(`${type}: ${message}`);
            return;
        }

        toast.textContent = message;
        toast.className = 'toast';
        if (type === 'error') toast.classList.add('error');
        if (type === 'warning') toast.classList.add('warning');
        
        toast.style.display = 'block';

        setTimeout(() => {
            toast.style.display = 'none';
        }, 4000);
    }
}

let searchApp;
document.addEventListener('DOMContentLoaded', () => {
    searchApp = new SearchApp();
});