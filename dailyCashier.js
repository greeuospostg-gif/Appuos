// public/js/dailyCashier.js
class DailyCashier {
    constructor() {
        // إعدادات Supabase
        this.SUPABASE_URL = 'https://rvjacvrrpguehbapvewe.supabase.co';
        this.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2amFjdnJycGd1ZWhiYXB2ZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMjUxNTksImV4cCI6MjA3ODYwMTE1OX0.wSavKzxKOF7-56G-pzDMtbXNrCNAbGs0wvadw-cilBg';
        this.supabase = null;

        // 🔑 معلومات المستخدم من نظام الصلاحيات الذهبية
        this.userStoreId = localStorage.getItem('store_id') || sessionStorage.getItem('store_id') || '0';
        this.userName = localStorage.getItem('username') || sessionStorage.getItem('username') || 'مستخدم';
        this.userFullName = localStorage.getItem('full_name') || sessionStorage.getItem('full_name') || '';
        this.isSuperAdmin = this.userStoreId === '9999'; // 💎 قاعدة الصلاحيات الذهبية
        
        this.currentSales = [];
        this.currentReturns = [];
        this.summaryData = {};
        this.filtersData = {};
        
        this.init();
    }

    async init() {
        try {
            this.showLoading();
            await this.initSupabase();
            await this.loadUserInfo();
            await this.loadFilterData();
            await this.loadData();
            this.bindEvents();
            this.hideLoading();
            this.updateUserInfoUI(); // 🔑 تحديث واجهة معلومات المستخدم
        } catch (error) {
            console.error('خطأ في التهيئة:', error);
            this.showMessage('حدث خطأ أثناء تحميل البيانات', 'error');
        }
    }

    async initSupabase() {
        try {
            this.supabase = supabase.createClient(
                this.SUPABASE_URL,
                this.SUPABASE_KEY
            );
            console.log("✅ تم تهيئة Supabase للكاشير اليومي");
            
            // اختبار الاتصال
            const { data, error } = await this.supabase.auth.getSession();
            if (error) throw error;
            
            return true;
        } catch (error) {
            console.error("❌ فشل تهيئة Supabase:", error);
            throw new Error('تعذر الاتصال بقاعدة البيانات');
        }
    }

    // 🔑 تحديث واجهة معلومات المستخدم مع الصلاحيات
    updateUserInfoUI() {
        // شريط معلومات المستخدم
        const userInfoDiv = document.createElement('div');
        userInfoDiv.id = 'userInfo';
        userInfoDiv.className = this.isSuperAdmin ? 
            'user-info-badge user-super-admin' : 
            'user-info-badge user-normal';
        
        userInfoDiv.style.cssText = `
            position: fixed;
            top: 15px;
            right: 15px;
            padding: 10px 15px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            font-size: 14px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        
        userInfoDiv.innerHTML = `
            <i class="fas ${this.isSuperAdmin ? 'fa-crown' : 'fa-user'} me-2"></i>
            ${this.userName} | 
            ${this.isSuperAdmin ? '👑 مدير عام' : `🏪 مخزن: ${this.userStoreId}`}
        `;
        
        // إزالة العنصر القديم إذا موجود
        const oldUserInfo = document.getElementById('userInfo');
        if (oldUserInfo) oldUserInfo.remove();
        
        document.body.appendChild(userInfoDiv);
    }

    async loadUserInfo() {
        try {
            document.getElementById('cashierName').textContent = `الكاشير: ${this.userFullName || this.userName}`;
            document.getElementById('branchName').textContent = `الفرع: ${this.userStoreId === '9999' ? 'جميع الفروع' : `المخزن ${this.userStoreId}`}`;
            document.getElementById('currentDate').textContent = new Date().toLocaleDateString('ar-EG');
            
            // تخزين مخزن المستخدم للفلاتر
            if (this.userStoreId && this.userStoreId !== '9999') {
                this.filtersData.userStoreId = this.userStoreId;
            }
        } catch (error) {
            console.error('خطأ في تحميل معلومات المستخدم:', error);
        }
    }

    // 🔑 تحميل بيانات الفلاتر مع تطبيق الصلاحيات
    async loadFilterData() {
        try {
            await this.loadFilterDataFromSupabase();
            this.populateFilterDropdowns();
        } catch (error) {
            console.error('خطأ في تحميل بيانات الفلاتر:', error);
            this.showMessage('حدث خطأ في تحميل قوائم الفلاتر', 'error');
        }
    }

    async loadFilterDataFromSupabase() {
        try {
            // 🔑 جلب المخازن مع تطبيق الصلاحيات
            let storesQuery = this.supabase
                .from('stores')
                .select('store_id, store_name')
                .order('store_name');
            
            const { data: stores, error: storesError } = await storesQuery;
            if (storesError) throw storesError;
            
            // 🔐 تطبيق قاعدة الصلاحيات الذهبية
            if (this.isSuperAdmin) {
                // 💎 المستخدم الخاص (9999): يرى جميع المخازن
                this.filtersData.stores = stores;
                console.log(`👑 صلاحيات كاملة: تحميل جميع ${stores.length} مخزن`);
            } else {
                // 💎 المستخدم العادي: يرى مخزنه فقط
                const userStore = stores.find(store => store.store_id == this.userStoreId);
                this.filtersData.stores = userStore ? [userStore] : [];
                console.log(`🔒 صلاحيات محدودة: تحميل مخزن المستخدم فقط (${this.userStoreId})`);
            }

            // جلب الكاشيرات من جدول users مع تطبيق الصلاحيات
            let cashiersQuery = this.supabase
                .from('users')
                .select('user_id, username, full_name, role, store_id')
                .eq('active', true)
                .order('username');
            
            // 🔐 تطبيق الصلاحيات على الكاشيرات
            if (!this.isSuperAdmin && this.userStoreId !== '9999') {
                // المستخدم العادي: يرى فقط كاشيرات مخزنه
                cashiersQuery = cashiersQuery.eq('store_id', this.userStoreId);
            }
            
            const { data: cashiers, error: cashiersError } = await cashiersQuery;
            if (cashiersError) throw cashiersError;
            
            this.filtersData.cashiers = cashiers;
            console.log(`✅ تم تحميل ${cashiers.length} كاشير`);

        } catch (error) {
            console.error('خطأ في جلب بيانات الفلاتر من Supabase:', error);
            throw error;
        }
    }

    // 🔑 تعبئة قوائم الفلاتر مع تطبيق الصلاحيات
    populateFilterDropdowns() {
        const storeFilter = document.getElementById('storeFilter');
        const cashierFilter = document.getElementById('cashierFilter');

        // 🔐 تعبئة المخازن مع تطبيق الصلاحيات
        storeFilter.innerHTML = '<option value="">جميع الفروع</option>';
        this.filtersData.stores.forEach(store => {
            storeFilter.innerHTML += `<option value="${store.store_id}">${store.store_name}</option>`;
        });

        // 🔒 إعدادات فلتر المخزن للمستخدم العادي
        if (!this.isSuperAdmin && this.userStoreId && this.userStoreId !== '9999') {
            storeFilter.value = this.userStoreId;
            storeFilter.disabled = true; // غير قابل للتعديل للمستخدم العادي
            console.log(`🔒 تم قفل فلتر المخزن على: ${this.userStoreId}`);
        } else {
            storeFilter.disabled = false; // قابل للتعديل للمدير العام
        }

        // تعبئة الكاشيرات
        cashierFilter.innerHTML = '<option value="">جميع الكاشيرات</option>';
        this.filtersData.cashiers.forEach(cashier => {
            const displayName = cashier.full_name || cashier.username;
            storeFilter.innerHTML += `<option value="${cashier.user_id}">${displayName}</option>`;
        });

        // تعيين الكاشير الحالي كافتراضي
        const currentUserId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');
        if (currentUserId) {
            cashierFilter.value = currentUserId;
        }
    }

    async loadData() {
        try {
            await Promise.all([
                this.loadSummary(),
                this.loadSales(),
                this.loadReturns()
            ]);
            this.renderTable();
        } catch (error) {
            console.error('خطأ في تحميل البيانات:', error);
            this.showMessage('حدث خطأ في تحميل البيانات', 'error');
        }
    }

    // 🔑 تحميل الإحصائيات مع تطبيق الصلاحيات
    async loadSummary() {
        try {
            await this.loadSummaryFromSupabase();
        } catch (error) {
            console.error('خطأ في جلب الإحصائيات:', error);
            throw error;
        }
    }

    async loadSummaryFromSupabase() {
        const { startDate, endDate, storeId, cashierId } = this.getFilterValues();
        
        // 🔐 تطبيق قاعدة الصلاحيات الذهبية على فلتر المخزن
        let effectiveStoreId = storeId;
        if (!this.isSuperAdmin && this.userStoreId !== '9999') {
            effectiveStoreId = this.userStoreId; // إجبار مخزن المستخدم العادي
        }
        
        console.log(`🔍 جلب إحصائيات: تاريخ ${startDate} إلى ${endDate}, مخزن: ${effectiveStoreId || 'الكل'}`);
        
        try {
            // جلب المبيعات مع تطبيق الصلاحيات
            let salesQuery = this.supabase
                .from('sales')
                .select('total_price, discount', { count: 'exact' });
            
            if (startDate) salesQuery = salesQuery.gte('tran_date', startDate);
            if (endDate) salesQuery = salesQuery.lte('tran_date', endDate);
            if (effectiveStoreId) salesQuery = salesQuery.eq('store_id', effectiveStoreId);
            if (cashierId) salesQuery = salesQuery.eq('user_id', cashierId);
            
            const { data: salesData, error: salesError, count: salesCount } = await salesQuery;
            if (salesError) throw salesError;

            // جلب المرتجعات مع تطبيق الصلاحيات
            let returnsQuery = this.supabase
                .from('sales_return')
                .select('total_price, discount', { count: 'exact' });
            
            if (startDate) returnsQuery = returnsQuery.gte('tran_date', startDate);
            if (endDate) returnsQuery = returnsQuery.lte('tran_date', endDate);
            if (effectiveStoreId) returnsQuery = returnsQuery.eq('store_id', effectiveStoreId);
            if (cashierId) returnsQuery = returnsQuery.eq('user_id', cashierId);
            
            const { data: returnsData, error: returnsError, count: returnsCount } = await returnsQuery;
            if (returnsError) throw returnsError;

            // حساب الإحصائيات
            const totalSalesAmount = salesData?.reduce((sum, sale) => sum + (parseFloat(sale.total_price) || 0), 0) || 0;
            const totalReturnsAmount = returnsData?.reduce((sum, ret) => sum + (parseFloat(ret.total_price) || 0), 0) || 0;
            
            this.summaryData = {
                total_sales: {
                    amount: totalSalesAmount,
                    invoices: salesCount || 0
                },
                total_returns: {
                    amount: totalReturnsAmount,
                    invoices: returnsCount || 0
                },
                net_sales: {
                    amount: totalSalesAmount - totalReturnsAmount,
                    invoices: (salesCount || 0) + (returnsCount || 0)
                },
                store_filter: effectiveStoreId,
                is_super_admin: this.isSuperAdmin
            };
            
            this.updateSummaryCards();
            console.log(`✅ تم جلب الإحصائيات: ${salesCount || 0} فاتورة بيع، ${returnsCount || 0} فاتورة مرتجع`);
            
        } catch (error) {
            console.error('خطأ في جلب الإحصائيات من Supabase:', error);
            throw error;
        }
    }

    // 🔑 تحميل المبيعات مع تطبيق الصلاحيات
    async loadSales() {
        try {
            await this.loadSalesFromSupabase();
        } catch (error) {
            console.error('خطأ في جلب المبيعات:', error);
            this.currentSales = [];
            throw error;
        }
    }

    async loadSalesFromSupabase() {
        const { startDate, endDate, storeId, cashierId } = this.getFilterValues();
        
        // 🔐 تطبيق قاعدة الصلاحيات الذهبية على فلتر المخزن
        let effectiveStoreId = storeId;
        if (!this.isSuperAdmin && this.userStoreId !== '9999') {
            effectiveStoreId = this.userStoreId; // إجبار مخزن المستخدم العادي
        }
        
        console.log(`🔍 جلب المبيعات للمخزن: ${effectiveStoreId || 'الكل'}`);
        
        try {
            // أولاً: جلب البيانات الأساسية من sales مع تطبيق الصلاحيات
            let query = this.supabase
                .from('sales')
                .select('*');
            
            if (startDate) query = query.gte('tran_date', startDate);
            if (endDate) query = query.lte('tran_date', endDate);
            if (effectiveStoreId) query = query.eq('store_id', effectiveStoreId);
            if (cashierId) query = query.eq('user_id', cashierId);
            
            const { data, error } = await query;
            if (error) throw error;

            // ثانياً: جلب البيانات المرتبطة
            if (data && data.length > 0) {
                await this.enrichSalesData(data);
            } else {
                this.currentSales = [];
            }
            
            console.log(`✅ تم جلب ${this.currentSales.length} عملية بيع`);
            
        } catch (error) {
            console.error('خطأ في جلب المبيعات من Supabase:', error);
            throw error;
        }
    }

    async enrichSalesData(salesData) {
        try {
            // جلب أسماء المخازن
            const storeIds = [...new Set(salesData.map(sale => sale.store_id))];
            const { data: stores, error: storesError } = await this.supabase
                .from('stores')
                .select('store_id, store_name')
                .in('store_id', storeIds);
            
            const storeMap = {};
            if (!storesError && stores) {
                stores.forEach(store => {
                    storeMap[store.store_id] = store.store_name;
                });
            }

            // جلب أسماء الكاشيرات
            const userIds = [...new Set(salesData.map(sale => sale.user_id))];
            const { data: users, error: usersError } = await this.supabase
                .from('users')
                .select('user_id, username, full_name')
                .in('user_id', userIds);
            
            const userMap = {};
            if (!usersError && users) {
                users.forEach(user => {
                    userMap[user.user_id] = user.full_name || user.username;
                });
            }

            // جلب أسماء الأصناف
            const itemIds = [...new Set(salesData.map(sale => sale.item_id))];
            const { data: items, error: itemsError } = await this.supabase
                .from('items')
                .select('item_id, item_nm, item_code')
                .in('item_id', itemIds);
            
            const itemMap = {};
            if (!itemsError && items) {
                items.forEach(item => {
                    itemMap[item.item_id] = {
                        item_name: item.item_nm,
                        item_code: item.item_code
                    };
                });
            }

            // دمج جميع البيانات
            this.currentSales = salesData.map(sale => {
                const itemInfo = itemMap[sale.item_id] || {};
                
                return {
                    ...sale,
                    type: 'sale',
                    displayType: 'بيع',
                    cashier_name: userMap[sale.user_id] || '',
                    store_name: storeMap[sale.store_id] || '',
                    item_name: itemInfo.item_name || sale.item_id,
                    item_code: itemInfo.item_code || sale.item_id
                };
            });

        } catch (error) {
            console.error('خطأ في إثراء بيانات المبيعات:', error);
            // الاستمرار بالبيانات الأساسية حتى مع وجود خطأ
            this.currentSales = salesData.map(sale => ({
                ...sale,
                type: 'sale',
                displayType: 'بيع',
                cashier_name: '',
                store_name: '',
                item_name: sale.item_id,
                item_code: sale.item_id
            }));
        }
    }

    // 🔑 تحميل المرتجعات مع تطبيق الصلاحيات
    async loadReturns() {
        try {
            await this.loadReturnsFromSupabase();
        } catch (error) {
            console.error('خطأ في جلب المرتجعات:', error);
            this.currentReturns = [];
            throw error;
        }
    }

    async loadReturnsFromSupabase() {
        const { startDate, endDate, storeId, cashierId } = this.getFilterValues();
        
        // 🔐 تطبيق قاعدة الصلاحيات الذهبية على فلتر المخزن
        let effectiveStoreId = storeId;
        if (!this.isSuperAdmin && this.userStoreId !== '9999') {
            effectiveStoreId = this.userStoreId; // إجبار مخزن المستخدم العادي
        }
        
        console.log(`🔍 جلب المرتجعات للمخزن: ${effectiveStoreId || 'الكل'}`);
        
        try {
            // أولاً: جلب البيانات الأساسية من sales_return مع تطبيق الصلاحيات
            let query = this.supabase
                .from('sales_return')
                .select('*');
            
            if (startDate) query = query.gte('tran_date', startDate);
            if (endDate) query = query.lte('tran_date', endDate);
            if (effectiveStoreId) query = query.eq('store_id', effectiveStoreId);
            if (cashierId) query = query.eq('user_id', cashierId);
            
            const { data, error } = await query;
            if (error) throw error;

            // ثانياً: جلب البيانات المرتبطة
            if (data && data.length > 0) {
                await this.enrichReturnsData(data);
            } else {
                this.currentReturns = [];
            }
            
            console.log(`✅ تم جلب ${this.currentReturns.length} عملية مرتجع`);
            
        } catch (error) {
            console.error('خطأ في جلب المرتجعات من Supabase:', error);
            throw error;
        }
    }

    async enrichReturnsData(returnsData) {
        try {
            // جلب أسماء المخازن
            const storeIds = [...new Set(returnsData.map(ret => ret.store_id))];
            const { data: stores, error: storesError } = await this.supabase
                .from('stores')
                .select('store_id, store_name')
                .in('store_id', storeIds);
            
            const storeMap = {};
            if (!storesError && stores) {
                stores.forEach(store => {
                    storeMap[store.store_id] = store.store_name;
                });
            }

            // جلب أسماء الكاشيرات
            const userIds = [...new Set(returnsData.map(ret => ret.user_id))];
            const { data: users, error: usersError } = await this.supabase
                .from('users')
                .select('user_id, username, full_name')
                .in('user_id', userIds);
            
            const userMap = {};
            if (!usersError && users) {
                users.forEach(user => {
                    userMap[user.user_id] = user.full_name || user.username;
                });
            }

            // جلب أسماء الأصناف
            const itemIds = [...new Set(returnsData.map(ret => ret.item_id))];
            const { data: items, error: itemsError } = await this.supabase
                .from('items')
                .select('item_id, item_nm, item_code')
                .in('item_id', itemIds);
            
            const itemMap = {};
            if (!itemsError && items) {
                items.forEach(item => {
                    itemMap[item.item_id] = {
                        item_name: item.item_nm,
                        item_code: item.item_code
                    };
                });
            }

            // دمج جميع البيانات
            this.currentReturns = returnsData.map(returnItem => {
                const itemInfo = itemMap[returnItem.item_id] || {};
                
                return {
                    ...returnItem,
                    type: 'return',
                    displayType: 'مرتجع',
                    cashier_name: userMap[returnItem.user_id] || '',
                    store_name: storeMap[returnItem.store_id] || '',
                    item_name: itemInfo.item_name || returnItem.item_id,
                    item_code: itemInfo.item_code || returnItem.item_id
                };
            });

        } catch (error) {
            console.error('خطأ في إثراء بيانات المرتجعات:', error);
            // الاستمرار بالبيانات الأساسية حتى مع وجود خطأ
            this.currentReturns = returnsData.map(returnItem => ({
                ...returnItem,
                type: 'return',
                displayType: 'مرتجع',
                cashier_name: '',
                store_name: '',
                item_name: returnItem.item_id,
                item_code: returnItem.item_id
            }));
        }
    }

    getFilterValues() {
        return {
            startDate: document.getElementById('startDateFilter').value,
            endDate: document.getElementById('endDateFilter').value,
            storeId: document.getElementById('storeFilter').value,
            cashierId: document.getElementById('cashierFilter').value
        };
    }

    updateSummaryCards() {
        const summary = this.summaryData;
        
        // 🔑 إضافة معلومات الصلاحيات في عرض الملخص
        let storeInfo = '';
        if (this.isSuperAdmin) {
            storeInfo = summary.store_filter ? 
                `(مخزن: ${summary.store_filter})` : 
                '(جميع المخازن)';
        } else {
            storeInfo = `(مخزنك: ${this.userStoreId})`;
        }
        
        document.getElementById('totalSales').textContent = 
            this.formatCurrency(summary.total_sales?.amount || 0);
        document.getElementById('totalSalesInvoices').textContent = 
            `${summary.total_sales?.invoices || 0} فاتورة ${storeInfo}`;
        
        document.getElementById('totalReturns').textContent = 
            this.formatCurrency(summary.total_returns?.amount || 0);
        document.getElementById('totalReturnsInvoices').textContent = 
            `${summary.total_returns?.invoices || 0} فاتورة ${storeInfo}`;
        
        document.getElementById('netSales').textContent = 
            this.formatCurrency(summary.net_sales?.amount || 0);
        document.getElementById('netSalesInvoices').textContent = 
            `${summary.net_sales?.invoices || 0} فاتورة صافية ${storeInfo}`;
    }

    // 🔑 عرض البيانات مع معلومات الصلاحيات
    renderTable() {
        const tableBody = document.getElementById('transactionsTable');
        const typeFilter = document.getElementById('typeFilter').value;
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();

        let allTransactions = [...this.currentSales, ...this.currentReturns];
        
        // تطبيق الفلاتر
        if (typeFilter !== 'all') {
            allTransactions = allTransactions.filter(
                transaction => transaction.type === typeFilter
            );
        }
        
        if (searchTerm) {
            allTransactions = allTransactions.filter(transaction =>
                (transaction.item_id && transaction.item_id.toString().toLowerCase().includes(searchTerm)) ||
                (transaction.item_name && transaction.item_name.toLowerCase().includes(searchTerm)) ||
                (transaction.invoice_id && transaction.invoice_id.toString().includes(searchTerm)) ||
                (transaction.item_code && transaction.item_code.toString().toLowerCase().includes(searchTerm))
            );
        }

        // ترتيب حسب التاريخ
        allTransactions = allTransactions.sort((a, b) => 
            new Date(b.tran_date) - new Date(a.tran_date)
        );

        if (allTransactions.length === 0) {
            // 🔑 إضافة معلومات الصلاحيات في رسالة عدم وجود بيانات
            let noDataMessage = `
                <tr>
                    <td colspan="10" class="text-center py-4">
                        <i class="fas fa-inbox fa-2x text-muted mb-2"></i><br>
                        لا توجد حركات متطابقة مع معايير البحث
                    </td>
                </tr>
            `;
            
            if (!this.isSuperAdmin) {
                noDataMessage = `
                    <tr>
                        <td colspan="10" class="text-center py-4">
                            <i class="fas fa-inbox fa-2x text-muted mb-2"></i><br>
                            لا توجد حركات لمخزنك (${this.userStoreId})<br>
                            <small class="text-muted">يتم عرض بيانات مخزنك فقط</small>
                        </td>
                    </tr>
                `;
            }
            
            tableBody.innerHTML = noDataMessage;
            return;
        }

        // 🔑 إضافة ترويسة توضح الصلاحيات
        let headerInfo = '';
        if (allTransactions.length > 0) {
            const storeFilter = document.getElementById('storeFilter');
            const selectedStoreText = storeFilter.selectedOptions[0]?.textContent || '';
            
            headerInfo = `
                <tr class="table-info">
                    <td colspan="10" style="background-color: #e3f2fd; font-weight: bold;">
                        📊 عرض ${allTransactions.length} حركة | 
                        ${this.isSuperAdmin ? 
                            (selectedStoreText ? `مخزن: ${selectedStoreText}` : 'جميع المخازن') : 
                            `مخزنك: ${selectedStoreText}`
                        }
                    </td>
                </tr>
            `;
        }

        const rows = allTransactions.map(transaction => this.createTableRow(transaction));
        tableBody.innerHTML = headerInfo + rows.join('');
    }

    createTableRow(transaction) {
        const isSale = transaction.type === 'sale';
        const rowClass = isSale ? 'sale-row' : 'return-row';
        const typeBadge = isSale ? 
            '<span class="badge bg-success">بيع</span>' : 
            '<span class="badge bg-danger">مرتجع</span>';
        
        const totalClass = isSale ? 'positive' : 'negative';
        const totalSign = isSale ? '+' : '-';

        return `
            <tr class="${rowClass}">
                <td>${typeBadge}</td>
                <td>${this.formatDateTime(transaction.tran_date)}</td>
                <td>${transaction.invoice_id || ''}</td>
                <td>
                    <div>${transaction.item_code || transaction.item_id || ''}</div>
                    <small class="text-muted">${transaction.item_name || ''}</small>
                </td>
                <td>${this.formatNumber(transaction.item_qty)}</td>
                <td>${this.formatCurrency(transaction.sale_price)}</td>
                <td>${this.formatCurrency(transaction.discount || 0)}</td>
                <td class="${totalClass}">
                    ${totalSign} ${this.formatCurrency(transaction.total_price)}
                </td>
                <td>${transaction.cashier_name || ''}</td>
                <td class="mobile-hidden">${transaction.store_name || ''}</td>
            </tr>
        `;
    }

    // 🔑 إعادة تعيين الفلاتر مع تطبيق الصلاحيات
    resetFilters() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('startDateFilter').value = today;
        document.getElementById('endDateFilter').value = today;
        document.getElementById('cashierFilter').value = '';
        document.getElementById('typeFilter').value = 'all';
        document.getElementById('searchInput').value = '';
        
        // 🔒 إعادة تعيين فلتر المخزن بناءً على الصلاحيات
        if (this.isSuperAdmin) {
            document.getElementById('storeFilter').value = '';
            document.getElementById('storeFilter').disabled = false;
        } else {
            document.getElementById('storeFilter').value = this.userStoreId;
            document.getElementById('storeFilter').disabled = true;
        }
        
        this.applyFilters();
    }

    formatCurrency(amount) {
        const num = parseFloat(amount || 0);
        return num.toLocaleString('ar-EG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + ' ج.م';
    }

    formatNumber(number) {
        const num = parseFloat(number || 0);
        return num.toLocaleString('ar-EG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    formatDateTime(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleString('ar-EG', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    bindEvents() {
        document.getElementById('applyFilters').addEventListener('click', () => this.applyFilters());
        document.getElementById('resetFilters').addEventListener('click', () => this.resetFilters());
        document.getElementById('refreshData').addEventListener('click', () => this.refreshData());
        
        document.getElementById('searchInput').addEventListener('input', () => this.renderTable());
        document.getElementById('typeFilter').addEventListener('change', () => this.renderTable());
        
        // تحديث التاريخ الافتراضي
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('startDateFilter').value = today;
        document.getElementById('endDateFilter').value = today;
    }

    async applyFilters() {
        try {
            this.showLoading();
            await this.loadData();
            this.hideLoading();
            this.showMessage('تم تطبيق الفلاتر بنجاح', 'success');
        } catch (error) {
            this.hideLoading();
            this.showMessage('حدث خطأ أثناء تطبيق الفلاتر', 'error');
        }
    }

    async refreshData() {
        try {
            this.showLoading();
            await this.loadData();
            this.hideLoading();
            this.showMessage('تم تحديث البيانات بنجاح', 'success');
        } catch (error) {
            this.hideLoading();
            this.showMessage('حدث خطأ أثناء تحديث البيانات', 'error');
        }
    }

    showLoading() {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) spinner.classList.remove('d-none');
    }

    hideLoading() {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) spinner.classList.add('d-none');
    }

    showMessage(message, type = 'info') {
        try {
            const messageDiv = document.createElement('div');
            messageDiv.className = `alert alert-${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'info'} alert-dismissible fade show`;
            messageDiv.innerHTML = `
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
            
            const container = document.querySelector('.container-fluid');
            if (container) {
                container.insertBefore(messageDiv, container.firstChild);
                
                setTimeout(() => {
                    if (messageDiv.parentElement) {
                        messageDiv.remove();
                    }
                }, 5000);
            } else {
                alert(message);
            }
        } catch (error) {
            console.error('خطأ في عرض الرسالة:', error);
            alert(message);
        }
    }
}

// تهيئة التطبيق
document.addEventListener('DOMContentLoaded', () => {
    window.dailyCashierApp = new DailyCashier();
});