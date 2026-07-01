class SalesReturnApp {
    constructor() {
        // ثوابت Supabase
        this.SUPABASE_URL = 'https://rvjacvrrpguehbapvewe.supabase.co';
        this.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2amFjdnJycGd1ZWhiYXB2ZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMjUxNTksImV4cCI6MjA3ODYwMTE1OX0.wSavKzxKOF7-56G-pzDMtbXNrCNAbGs0wvadw-cilBg';

        // تهيئة state موحد
        this.state = {
            // حالة التطبيق
            originalInvoice: null,
            returnLines: [],
            currentItem: null,
            currentStore: null,
            currentMode: 'with-invoice',
            searchTimer: null,
            user: null,
            
            // Supabase
            supabase: null,
            stores: [],
            fixedStoreId: null, // المخزن الثابت للمستخدم
            fixedStoreName: null,
            
            // عناصر DOM
            dom: null
        };
        
        // تهيئة DOM
        this.state.dom = this._initDOM();
        
        // استدعاء دوال التهيئة
        this._initSupabase();
        this._bindEvents();
        this.initEventListeners();
        this.init();
    }

    _initDOM() {
        return {
            storeSelect: document.getElementById('storeSelect'),
            invoiceSearch: document.getElementById('searchInvoice'),
            itemSearch: document.getElementById('itemSearch'),
            itemsTable: document.getElementById('returnItemsList'),
            totalQuantity: document.getElementById('totalQty'),
            totalAmount: document.getElementById('totalAmount'),
            totalItems: document.getElementById('totalItems'),
            customerRefund: document.getElementById('customerRefund'),
            returnQty: document.getElementById('returnQty'),
            returnPrice: document.getElementById('returnPrice'),
            returnReason: document.getElementById('returnReason'),
            returnRemarks: document.getElementById('returnRemarks')
        };
    }

    _initSupabase() {
        try {
            this.state.supabase = supabase.createClient(
                this.SUPABASE_URL,
                this.SUPABASE_KEY
            );
            console.log("✅ تم تهيئة Supabase لمرتجع المبيعات");
        } catch (error) {
            console.error("❌ فشل تهيئة Supabase:", error);
            this._showError("فشل في الاتصال بقاعدة البيانات");
        }
    }

    _bindEvents() {
        // التنقل ب Enter بين الحقول
        this._setupEnterNavigation();
    }

    _setupEnterNavigation() {
        // زر Enter في البحث عن الصنف
        this.state.dom.itemSearch?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.searchItem(this.state.dom.itemSearch.value);
            }
        });

        // زر Enter في البحث عن الفاتورة
        this.state.dom.invoiceSearch?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.searchInvoice();
            }
        });

        // زر Enter في كمية المرتجع - الانتقال للسعر
        this.state.dom.returnQty?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (this.state.dom.returnPrice) {
                    this.state.dom.returnPrice.focus();
                    this.state.dom.returnPrice.select();
                }
            }
        });

        // زر Enter في سعر المرتجع - الانتقال للإضافة
        this.state.dom.returnPrice?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addReturnItem();
            }
        });

        // زر Enter في سبب الإرجاع - الانتقال للملاحظات
        this.state.dom.returnReason?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (this.state.dom.returnRemarks) {
                    this.state.dom.returnRemarks.focus();
                }
            }
        });

        // زر Enter في الملاحظات - إضافة الصنف
        this.state.dom.returnRemarks?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addReturnItem();
            }
        });
    }

    initEventListeners() {
        // البحث عن الفاتورة
        this.state.dom.invoiceSearch?.addEventListener('input', (e) => {
            this.handleInvoiceSearch(e.target.value);
        });

        // البحث عن الصنف
        this.state.dom.itemSearch?.addEventListener('input', (e) => {
            this.handleItemSearch(e.target.value);
        });

        // أزرار التبويب
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.getAttribute('data-tab');
                this.setMode(tabId);
            });
        });
    }

    async init() {
        await this._loadUserAndStore(); // تحميل المستخدم والمخزن أولاً
        await this._loadStores();
        console.log("✅ تم تهيئة نظام مرتجعات المبيعات");
        
        // عرض المخزن الثابت للمستخدم
        this._updateStoreDisplay();
    }

    async _loadUserAndStore() {
        try {
            // جلب بيانات المستخدم من localStorage
            const userData = localStorage.getItem('userData') || 
                            sessionStorage.getItem('userData') ||
                            '{"user_id":1,"user_name":"المستخدم","store_id":1,"store_name":"المخزن الرئيسي"}';
            
            const user = JSON.parse(userData);
            this.state.user = user;
            
            // تعيين المخزن الثابت للمستخدم
            this.state.fixedStoreId = user.store_id;
            this.state.fixedStoreName = user.store_name;
            this.state.currentStore = user.store_id; // تعيين كمخزن افتراضي
            
            // تحديث واجهة المستخدم
            const userInfoElement = document.getElementById('userInfo');
            if (userInfoElement) {
                userInfoElement.textContent = `مرحباً: ${user.user_name} | المخزن: ${user.store_name}`;
            }
            
            console.log(`👤 المستخدم: ${user.user_name}, المخزن: ${user.store_name} (ID: ${user.store_id})`);
            
        } catch (error) {
            console.error("❌ خطأ في تحميل بيانات المستخدم:", error);
            // تعيين قيم افتراضية
            this.state.fixedStoreId = 1;
            this.state.fixedStoreName = "المخزن الرئيسي";
            this.state.currentStore = 1;
            this.state.user = { user_id: 1, user_name: "المستخدم" };
        }
    }

    _updateStoreDisplay() {
        if (this.state.dom.storeSelect) {
            // تعطيل اختيار المخزن وجعله للعرض فقط
            this.state.dom.storeSelect.disabled = true;
            this.state.dom.storeSelect.innerHTML = `
                <option value="${this.state.fixedStoreId}" selected>
                    ${this.state.fixedStoreName} (مخزنك الثابت)
                </option>
            `;
        }
        
        // عرض معلومات المخزن الثابت
        const storeInfo = document.createElement('div');
        storeInfo.className = 'store-info';
        storeInfo.innerHTML = `
            <div style="background:#e8f6f3; padding:10px; border-radius:5px; margin:10px 0; border-right:4px solid #27ae60;">
                <strong>📌 المخزن الثابت:</strong> ${this.state.fixedStoreName}
                <br><small>جم عمليات الإرجاع ستتم لهذا المخزن فقط</small>
            </div>
        `;
        
        const storeSelectParent = this.state.dom.storeSelect?.parentNode;
        if (storeSelectParent) {
            storeSelectParent.appendChild(storeInfo);
        }
    }

    async _loadStores() {
        console.log("🔄 جلب المخازن من Supabase");
        
        if (!this.state.supabase) {
            console.error("❌ Supabase غير مهيئ");
            return;
        }
        
        try {
            const { data, error } = await this.state.supabase
                .from('stores')
                .select('store_id, store_name')
                .order('store_name');
            
            if (error) {
                throw error;
            }
            
            if (data && data.length > 0) {
                this.state.stores = data;
                console.log(`✅ تم جلب ${data.length} مخزن من Supabase`);
                
                // التحقق من أن المخزن الثابت موجود في القائمة
                const userStoreExists = data.some(store => store.store_id === this.state.fixedStoreId);
                if (!userStoreExists) {
                    console.warn(`⚠️ المخزن ${this.state.fixedStoreId} غير موجود في قاعدة البيانات`);
                }
            } else {
                console.warn("⚠️ لم يتم العثور على مخازن في قاعدة البيانات");
            }
            
        } catch (error) {
            console.error("❌ فشل جلب المخازن:", error);
            this._showError("فشل في جلب المخازن من قاعدة البيانات");
        }
    }

    // البحث عن الفاتورة
    handleInvoiceSearch(searchTerm) {
        clearTimeout(this.state.searchTimer);
        
        if (searchTerm.length < 1) {
            this.state.originalInvoice = null;
            this._clearInvoiceResults();
            return;
        }
        
        this.state.searchTimer = setTimeout(async () => {
            if (searchTerm.length >= 1) {
                await this.searchInvoice();
            }
        }, 500);
    }

    async searchInvoice() {
        const invoiceNumber = this.state.dom.invoiceSearch.value.trim();
        
        if (!invoiceNumber) {
            this._showError("يرجى إدخال رقم الفاتورة");
            return;
        }
        
        console.log(`🔍 البحث عن الفاتورة: ${invoiceNumber}`);
        
        try {
            if (!this.state.supabase) {
                this._showError("فشل الاتصال بقاعدة البيانات");
                return;
            }

            // البحث في جدول sales باستخدام invoice_id والمخزن الثابت
            const { data, error } = await this.state.supabase
                .from('sales')
                .select(`
                    tran_date,
                    store_id,
                    customer_id,
                    invoice_id,
                    item_id,
                    item_qty,
                    sale_price,
                    total_price,
                    discount,
                    sale_type,
                    unit_type,
                    batch_no,
                    expiry_date,
                    remarks
                `)
                .eq('invoice_id', invoiceNumber)
                .eq('store_id', this.state.fixedStoreId) // البحث فقط في المخزن الثابت
                .order('tran_date', { ascending: false })
                .limit(50);

            if (error) {
                console.error("❌ خطأ في البحث:", error);
                this._showError("خطأ في البحث عن الفاتورة");
                return;
            }
            
            if (!data || data.length === 0) {
                this._showError(`لم يتم العثور على فاتورة رقم ${invoiceNumber} في المخزن ${this.state.fixedStoreName}`);
                this._clearInvoiceResults();
                return;
            }
            
            // تجميع بيانات الفاتورة
            const firstSale = data[0];
            const invoiceData = {
                invoice_id: firstSale.invoice_id,
                tran_date: firstSale.tran_date,
                store_id: firstSale.store_id,
                customer_id: firstSale.customer_id,
                sale_type: firstSale.sale_type,
                items: []
            };
            
            // جلب أسماء الأصناف
            const uniqueItemIds = [...new Set(data.map(item => item.item_id))];
            
            for (const itemId of uniqueItemIds) {
                // جلب معلومات الصنف
                const itemInfo = await this._getItemInfo(itemId);
                
                // جمع كل كميات هذا الصنف من الفاتورة
                const invoiceItems = data.filter(d => d.item_id === itemId);
                const totalQty = invoiceItems.reduce((sum, item) => sum + parseFloat(item.item_qty || 0), 0);
                const avgPrice = invoiceItems.reduce((sum, item) => sum + parseFloat(item.sale_price || 0), 0) / invoiceItems.length;
                
                invoiceData.items.push({
                    item_id: itemId,
                    item_name: itemInfo.item_nm || itemId,
                    item_code: itemInfo.item_code || itemId,
                    item_qty: totalQty,
                    sale_price: avgPrice,
                    total_price: totalQty * avgPrice,
                    store_id: firstSale.store_id,
                    unit_type: invoiceItems[0]?.unit_type || 'قطعة',
                    batch_no: invoiceItems[0]?.batch_no || '',
                    expiry_date: invoiceItems[0]?.expiry_date || null
                });
            }
            
            this.state.originalInvoice = invoiceData;
            this._displayInvoiceResults(invoiceData);
            console.log(`✅ تم العثور على الفاتورة مع ${invoiceData.items.length} أصناف`);
            
        } catch (error) {
            console.error("❌ خطأ في البحث عن الفاتورة:", error);
            this._showError("خطأ في البحث عن الفاتورة");
            this._clearInvoiceResults();
        }
    }

    async _getItemInfo(itemId) {
        if (!this.state.supabase) {
            return { item_nm: itemId, item_code: itemId };
        }
        
        try {
            const { data, error } = await this.state.supabase
                .from('items')
                .select('item_nm, item_code')
                .eq('item_id', itemId)
                .maybeSingle(); // تغيير من single إلى maybeSingle
            
            if (!error && data) {
                return data;
            } else {
                console.warn(`⚠️ الصنف ${itemId} غير موجود في جدول items أو لا يحتوي على بيانات`);
            }
        } catch (error) {
            console.error('خطأ في جلب معلومات الصنف:', error);
        }
        
        return { item_nm: `صنف ${itemId}`, item_code: itemId.toString() };
    }

    _displayInvoiceResults(invoice) {
        const resultsDiv = document.getElementById('invoiceResults');
        if (!resultsDiv) return;
        
        resultsDiv.style.display = 'block';
        
        // معلومات الفاتورة
        const invoiceDate = new Date(invoice.tran_date).toLocaleDateString('ar-SA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        let itemsHtml = '';
        
        if (invoice.items && invoice.items.length > 0) {
            itemsHtml = invoice.items.map(item => `
                <div class="search-item" onclick="app.selectInvoiceItem(${JSON.stringify(item).replace(/"/g, '&quot;')})">
                    <div>
                        <strong>${item.item_id}</strong>
                        <div class="text-muted small">${item.item_name || 'بدون اسم'}</div>
                        <small>${item.item_code ? `الكود: ${item.item_code} | ` : ''}المخزن: ${this.state.fixedStoreName}</small>
                    </div>
                    <div>
                        <small>الكمية: ${item.item_qty}</small><br>
                        <small>السعر: ${item.sale_price?.toFixed(2) || '0.00'} ج</small><br>
                        <small>الإجمالي: ${item.total_price?.toFixed(2) || '0.00'} ج</small>
                    </div>
                </div>
            `).join('');
        }
        
        resultsDiv.innerHTML = `
            <div class="invoice-info" style="padding:15px; background:#f8f9fa; border-radius:5px; margin-bottom:10px;">
                <strong>فاتورة #${invoice.invoice_id}</strong><br>
                <small>التاريخ: ${invoiceDate}</small><br>
                <small>المخزن: ${this.state.fixedStoreName}</small><br>
                <small>عدد الأصناف: ${invoice.items?.length || 0}</small>
            </div>
            ${itemsHtml ? `
                <div class="mt-2">
                    <strong>أصناف الفاتورة:</strong>
                    <div class="search-results">${itemsHtml}</div>
                </div>
            ` : '<div class="text-center text-muted">لا توجد أصناف في هذه الفاتورة</div>'}
        `;
    }

    _clearInvoiceResults() {
        const resultsDiv = document.getElementById('invoiceResults');
        if (resultsDiv) {
            resultsDiv.style.display = 'none';
            resultsDiv.innerHTML = '';
        }
    }

    // البحث عن الصنف (للوضع بدون فاتورة) - معدل بالكامل
    handleItemSearch(searchTerm) {
        clearTimeout(this.state.searchTimer);
        
        if (searchTerm.length < 1) {
            this._clearItemResults();
            return;
        }
        
        this.state.searchTimer = setTimeout(async () => {
            await this.searchItem(searchTerm);
        }, 300);
    }

    async searchItem(searchTerm) {
        console.log(`🔍 البحث عن الصنف: ${searchTerm}`);
        
        try {
            if (!this.state.supabase) {
                this._showError("فشل الاتصال بقاعدة البيانات");
                return;
            }
            
            let itemsData = [];
            
            // الخطوة 1: إذا كان البحث رقمي، ابحث في المبيعات أولاً
            if (!isNaN(searchTerm)) {
                const itemId = parseInt(searchTerm);
                
                // ابحث إذا كان هذا الصنف قد بيع في المخزن
                const { data: salesData, error: salesError } = await this.state.supabase
                    .from('sales')
                    .select('item_id, sale_price, tran_date')
                    .eq('store_id', this.state.fixedStoreId)
                    .eq('item_id', itemId)
                    .order('tran_date', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                
                if (!salesError && salesData) {
                    // الصنف موجود في المبيعات، أحصل على معلوماته
                    const itemInfo = await this._getItemInfo(itemId);
                    itemsData.push({
                        item_id: itemId,
                        item_nm: itemInfo.item_nm || `صنف ${itemId}`,
                        item_code: itemInfo.item_code || itemId.toString(),
                        last_sale_price: salesData.sale_price || 0,
                        exists_in_sales: true
                    });
                }
            }
            
            // الخطوة 2: إذا لم نجد بالرقم، جرب البحث في المبيعات بالاسم
            if (itemsData.length === 0) {
                // ابحث عن الأصناف المبيعة مؤخراً
                const { data: recentSales, error: recentError } = await this.state.supabase
                    .from('sales')
                    .select('item_id')
                    .eq('store_id', this.state.fixedStoreId)
                    .order('tran_date', { ascending: false })
                    .limit(50);
                
                if (!recentError && recentSales) {
                    const uniqueItemIds = [...new Set(recentSales.map(sale => sale.item_id))];
                    
                    // لكل صنف مبيع، تحقق مما إذا كان اسمه يتطابق مع البحث
                    for (const itemId of uniqueItemIds) {
                        if (itemsData.length >= 10) break; // حد أقصى 10 نتائج
                        
                        try {
                            const itemInfo = await this._getItemInfo(itemId);
                            
                            // إذا كان البحث نصي وتحقق من الاسم
                            if (itemInfo.item_nm && 
                                itemInfo.item_nm.toLowerCase().includes(searchTerm.toLowerCase())) {
                                
                                itemsData.push({
                                    item_id: itemId,
                                    item_nm: itemInfo.item_nm,
                                    item_code: itemInfo.item_code || itemId.toString()
                                });
                            }
                        } catch (error) {
                            console.warn(`⚠️ تخطي الصنف ${itemId}:`, error.message);
                        }
                    }
                }
            }
            
            // الخطوة 3: إذا لم نجد أي نتائج، جرب البحث بالمبيعات فقط
            if (itemsData.length === 0 && !isNaN(searchTerm)) {
                // حاول العثور على أي مبيعات لهذا الرقم في أي مخزن
                const { data: anySales, error: anyError } = await this.state.supabase
                    .from('sales')
                    .select('item_id')
                    .eq('item_id', parseInt(searchTerm))
                    .limit(1)
                    .maybeSingle();
                
                if (!anyError && anySales) {
                    const itemInfo = await this._getItemInfo(anySales.item_id);
                    itemsData.push({
                        item_id: anySales.item_id,
                        item_nm: itemInfo.item_nm || `صنف ${anySales.item_id}`,
                        item_code: itemInfo.item_code || anySales.item_id.toString(),
                        exists_in_sales: false, // لأنه ليس في المخزن الحالي
                        warning: '⚠️ موجود في مبيعات أخرى ولكن ليس في هذا المخزن'
                    });
                }
            }
            
            if (itemsData.length === 0) {
                this._showError(`لم يتم العثور على أصناف تطابق "${searchTerm}" في مبيعات المخزن ${this.state.fixedStoreName}`);
                this._clearItemResults();
                return;
            }
            
            const items = [];
            
            // إضافة معلومات المبيعات لكل صنف
            for (let item of itemsData) {
                if (!item.exists_in_sales || !item.last_sale_price) {
                    // إذا لم يكن لدينا معلومات المبيعات بعد، أحصل عليها
                    const { data: lastSale, error: saleError } = await this.state.supabase
                        .from('sales')
                        .select('sale_price, tran_date, store_id')
                        .eq('item_id', item.item_id)
                        .eq('store_id', this.state.fixedStoreId)
                        .order('tran_date', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    
                    item.last_sale_price = saleError ? 0 : (lastSale?.sale_price || 0);
                    item.exists_in_sales = !saleError && !!lastSale;
                    item.last_sale_store = lastSale?.store_id;
                    item.last_sale_date = lastSale?.tran_date;
                }
                
                items.push(item);
            }
            
            this._displayItemResults(items);
            
        } catch (error) {
            console.error("❌ خطأ في البحث عن الأصناف:", error);
            this._showError("خطأ في البحث عن الأصناف");
            this._clearItemResults();
        }
    }

    _displayItemResults(items) {
        const resultsDiv = document.getElementById('itemResults');
        if (!resultsDiv) return;
        
        resultsDiv.style.display = 'block';
        resultsDiv.innerHTML = items.map(item => `
            <div class="search-item" onclick="app.selectItem(${JSON.stringify(item).replace(/"/g, '&quot;')})">
                <div>
                    <strong>${item.item_id}</strong>
                    <div class="text-muted small">${item.item_nm || 'بدون اسم'}</div>
                    ${item.item_code ? `<small>الكود: ${item.item_code}</small><br>` : ''}
                    ${item.warning ? `<small class="text-warning">${item.warning}</small><br>` : ''}
                    ${!item.exists_in_sales ? 
                        '<small class="text-warning">⚠️ غير موجود في مبيعات المخزن</small>' : 
                        `<small class="text-success">✓ موجود في مبيعات المخزن</small>`}
                </div>
                <div>
                    ${item.exists_in_sales ? 
                        `<small>آخر سعر: ${item.last_sale_price || 0} ج</small><br>` : 
                        ''}
                    <small>المخزن: ${this.state.fixedStoreName}</small>
                </div>
            </div>
        `).join('');
    }

    _clearItemResults() {
        const resultsDiv = document.getElementById('itemResults');
        if (resultsDiv) {
            resultsDiv.style.display = 'none';
            resultsDiv.innerHTML = '';
        }
    }

    selectItem(item) {
        this.state.currentItem = {
            item_id: item.item_id,
            item_nm: item.item_nm || item.item_id,
            item_code: item.item_code || item.item_id,
            last_sale_price: item.last_sale_price || 0,
            exists_in_sales: item.exists_in_sales,
            store_id: this.state.fixedStoreId,
            warning: item.warning
        };
        
        this.state.dom.itemSearch.value = `${item.item_id} - ${item.item_nm || 'بدون اسم'}`;
        
        // تحديث السعر تلقائياً
        if (this.state.dom.returnPrice) {
            this.state.dom.returnPrice.value = item.last_sale_price || 0;
        }
        
        // تحذير إذا لم يكن موجوداً في المبيعات
        if (!item.exists_in_sales) {
            if (item.warning) {
                this._showWarning(item.warning);
            } else {
                this._showWarning(`⚠️ هذا الصنف غير موجود في مبيعات مخزن ${this.state.fixedStoreName}`);
            }
        }
        
        // التركيز على حقل الكمية
        if (this.state.dom.returnQty) {
            this.state.dom.returnQty.focus();
            this.state.dom.returnQty.select();
        }
        
        this._clearItemResults();
        console.log(`✅ تم اختيار الصنف: ${item.item_nm || item.item_id} للمخزن ${this.state.fixedStoreName}`);
    }

    selectInvoiceItem(item) {
        this.state.currentItem = {
            item_id: item.item_id,
            item_nm: item.item_name || item.item_id,
            item_code: item.item_code || item.item_id,
            last_sale_price: item.sale_price,
            exists_in_sales: true,
            original_invoice_id: this.state.originalInvoice?.invoice_id,
            store_id: item.store_id
        };
        
        // تحديث الحقول تلقائياً
        if (this.state.dom.itemSearch) {
            this.state.dom.itemSearch.value = `${item.item_id} - ${item.item_name || 'بدون اسم'}`;
        }
        
        if (this.state.dom.returnPrice) {
            this.state.dom.returnPrice.value = item.sale_price || 0;
        }
        
        if (this.state.dom.returnQty) {
            this.state.dom.returnQty.value = item.item_qty || 1;
            this.state.dom.returnQty.focus();
            this.state.dom.returnQty.select();
        }
        
        console.log(`✅ تم اختيار صنف من الفاتورة: ${item.item_id}`);
    }

    addReturnItem() {
        if (!this.state.currentItem) {
            this._showError("يجب اختيار الصنف أولاً");
            return;
        }

        // التحقق من المخزن (يجب أن يكون الإرجاع لنفس المخزن)
        if (this.state.currentItem.store_id && 
            this.state.currentItem.store_id !== this.state.fixedStoreId) {
            this._showError(`لا يمكن إرجاع هذا الصنف. تم بيعه من مخزن آخر (${this.state.currentItem.store_id})`);
            return;
        }

        // التحقق من وجود الصنف في المبيعات (للحالة بدون فاتورة)
        if (this.state.currentMode === 'without-invoice' && !this.state.currentItem.exists_in_sales) {
            const confirmMessage = `⚠️ هذا الصنف غير موجود في مبيعات مخزن ${this.state.fixedStoreName}. هل تريد الاستمرار في إضافه للمرتجع؟`;
            if (!confirm(confirmMessage)) {
                return;
            }
        }

        const quantity = parseFloat(this.state.dom.returnQty?.value) || 0;
        const price = parseFloat(this.state.dom.returnPrice?.value) || this.state.currentItem.last_sale_price || 0;
        const reason = this.state.dom.returnReason?.value || 'تالف';
        const remarks = this.state.dom.returnRemarks?.value || '';

        if (quantity <= 0) {
            this._showError("يجب إدخال كمية صحيحة أكبر من الصفر");
            return;
        }

        if (price < 0) {
            this._showError("السعر يجب أن يكون قيمة موجبة");
            return;
        }

        const returnLine = {
            item_id: this.state.currentItem.item_id,
            item_code: this.state.currentItem.item_code || this.state.currentItem.item_id,
            item_name: this.state.currentItem.item_nm || this.state.currentItem.item_id,
            quantity: quantity,
            price: price,
            total: quantity * price,
            reason: reason,
            remarks: remarks,
            store_id: this.state.fixedStoreId, // استخدام المخزن الثابت دائماً
            store_name: this.state.fixedStoreName,
            exists_in_sales: this.state.currentItem.exists_in_sales,
            original_invoice_id: this.state.currentItem.original_invoice_id || this.state.originalInvoice?.invoice_id,
            timestamp: new Date().toISOString()
        };

        this.state.returnLines.push(returnLine);
        this._updateReturnTable();
        this._updateTotals();
        this._clearItemForm();

        console.log("✅ تم إضافة صنف للمرتجع");
        this._showSuccess("تم إضافة الصنف للمرتجع بنجاح");
    }

    _updateReturnTable() {
        if (!this.state.dom.itemsTable) return;

        const itemsHTML = this.state.returnLines.map((line, index) => `
            <div class="item-row ${!line.exists_in_sales ? 'warning-row' : ''}">
                <div>${index + 1}</div>
                <div>
                    <strong>${line.item_id}</strong>
                    <div class="text-muted small">${line.item_name || 'بدون اسم'}</div>
                    ${line.original_invoice_id ? `<br><small class="text-info">فاتورة الأصلية: ${line.original_invoice_id}</small>` : ''}
                    ${!line.exists_in_sales ? '<br><small class="text-warning">⚠️ غير موجود في المبيعات</small>' : ''}
                </div>
                <div>${line.quantity}</div>
                <div>${line.price.toFixed(2)}</div>
                <div>${line.total.toFixed(2)}</div>
                <div>${line.reason}</div>
                <div>
                    <button class="btn btn-danger btn-sm" onclick="app.removeReturnLine(${index})" title="حذف الصنف">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');

        // تحديث الجدول مع الاحتفاظ بالرأس
        const tableContainer = this.state.dom.itemsTable;
        tableContainer.innerHTML = `
            <div class="item-row header">
                <div>#</div>
                <div>الصنف</div>
                <div>الكمية</div>
                <div>السعر</div>
                <div>الإجمالي</div>
                <div>السبب</div>
                <div>إجراءات</div>
            </div>
            ${itemsHTML}
        `;
    }

    _updateTotals() {
        const totalQty = this.state.returnLines.reduce((sum, line) => sum + line.quantity, 0);
        const totalAmount = this.state.returnLines.reduce((sum, line) => sum + line.total, 0);

        if (this.state.dom.totalQuantity) {
            this.state.dom.totalQuantity.textContent = totalQty.toFixed(2);
        }
        if (this.state.dom.totalAmount) {
            this.state.dom.totalAmount.textContent = totalAmount.toFixed(2);
        }
        if (this.state.dom.totalItems) {
            this.state.dom.totalItems.textContent = this.state.returnLines.length;
        }
        if (this.state.dom.customerRefund) {
            this.state.dom.customerRefund.textContent = totalAmount.toFixed(2);
        }
    }

    _clearItemForm() {
        this.state.currentItem = null;
        this.state.dom.itemSearch.value = '';
        if (this.state.dom.returnQty) this.state.dom.returnQty.value = '1';
        if (this.state.dom.returnPrice) this.state.dom.returnPrice.value = '';
        if (this.state.dom.returnRemarks) this.state.dom.returnRemarks.value = '';
        
        // التركيز على البحث عن الصنف
        if (this.state.dom.itemSearch) {
            this.state.dom.itemSearch.focus();
        }
        
        this._clearItemResults();
    }

    removeReturnLine(index) {
        if (confirm("هل تريد حذف هذا الصنف من المرتجع؟")) {
            this.state.returnLines.splice(index, 1);
            this._updateReturnTable();
            this._updateTotals();
            console.log("🗑️ تم حذف صنف من المرتجع");
            this._showSuccess("تم حذف الصنف من المرتجع");
        }
    }

    // الدوال الجديدة
    setMode(mode) {
        this.state.currentMode = mode;
        
        // تحديث الواجهة
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        const activeTab = document.querySelector(`[data-tab="${mode}"]`);
        const activeContent = document.getElementById(mode);
        
        if (activeTab) activeTab.classList.add('active');
        if (activeContent) activeContent.classList.add('active');
        
        // إعادة تعيين البيانات
        this._clearInvoiceResults();
        this._clearItemResults();
        this.state.currentItem = null;
        
        // التركيز على الحقل المناسب
        if (mode === 'with-invoice') {
            this.state.dom.invoiceSearch?.focus();
        } else {
            this.state.dom.itemSearch?.focus();
        }
        
        console.log(`🎛️ تم التبديل إلى: ${mode === 'with-invoice' ? 'مرتجع بفاتورة' : 'مرتجع بدون فاتورة'}`);
    }

    cancelReturn() {
        if (confirm("هل أنت متأكد من إلغاء المرتجع؟ سيتم فقدان جميع البيانات.")) {
            this.newReturn();
            this._showSuccess("تم إلغاء المرتجع بنجاح");
        }
    }

    async processReturn() {
        if (this.state.returnLines.length === 0) {
            this._showError("لا توجد أصناف في المرتجع");
            return;
        }

        try {
            const success = await this.saveReturn();
            if (success) {
                this._showSuccess("✅ تم معالجة المرتجع بنجاح");
                this.newReturn();
            } else {
                this._showError("❌ فشل في حفظ المرتجع");
            }
        } catch (error) {
            console.error("❌ فشل في معالجة المرتجع:", error);
            this._showError("❌ فشل في معالجة المرتجع");
        }
    }

    async saveReturn() {
        try {
            if (!this.state.supabase) {
                this._showError("فشل الاتصال بقاعدة البيانات");
                return false;
            }

            // توليد رقم فاتورة المرتجع
            const returnInvoiceId = await this._generateReturnInvoiceId();
            
            // إعداد بيانات المرتجع
            const returnLinesData = [];
            
            for (let i = 0; i < this.state.returnLines.length; i++) {
                const line = this.state.returnLines[i];
                
                returnLinesData.push({
                    tran_date: new Date().toISOString(),
                    store_id: this.state.fixedStoreId,
                    customer_id: this.state.originalInvoice?.customer_id || null,
                    invoice_id: returnInvoiceId,
                    item_id: line.item_id,
                    item_qty: line.quantity,
                    sale_price: line.price,
                    total_price: line.total,
                    discount: 0,
                    sale_type: 'مرتجع',
                    price_type: 'سعر1',
                    unit_type: 'قطعة',
                    batch_no: '',
                    expiry_date: null,
                    units_per_package: 1,
                    base_qty: line.quantity,
                    conversion_factor: 1,
                    remarks: line.remarks,
                    return_reason: line.reason,
                    original_invoice: line.original_invoice_id || this.state.originalInvoice?.invoice_id || null,
                    user_id: this.state.user?.user_id || 1,
                    user_stamp: new Date().toISOString(),
                    ser_no: i + 1
                });
            }

            // حفظ البيانات في جدول sales_return
            const { error } = await this.state.supabase
                .from('sales_return')
                .insert(returnLinesData);

            if (error) {
                console.error("❌ خطأ في حفظ المرتجع:", error);
                this._showError(`❌ فشل في حفظ المرتجع: ${error.message}`);
                return false;
            }

            console.log(`✅ تم حفظ ${returnLinesData.length} صنف في المرتجع #${returnInvoiceId}`);
            
            // تحديث المخزون بعد الإرجاع
            await this._updateInventoryAfterReturn();
            
            return true;
            
        } catch (error) {
            console.error("❌ خطأ في حفظ المرتجع:", error);
            this._showError("❌ فشل في حفظ المرتجع");
            return false;
        }
    }

    async _updateInventoryAfterReturn() {
        try {
            for (const line of this.state.returnLines) {
                // البحث عن الصنف في جدول a_master
                const { data: masterData, error: masterError } = await this.state.supabase
                    .from('a_master')
                    .select('item_qty')
                    .eq('item_id', line.item_id)
                    .eq('store_id', this.state.fixedStoreId)
                    .maybeSingle();
                
                if (masterError) {
                    console.warn(`⚠️ خطأ في جلب مخزون الصنف ${line.item_id}:`, masterError);
                    continue;
                }
                
                const currentQty = masterData?.item_qty || 0;
                const newQty = currentQty + line.quantity;
                
                // تحديث المخزون
                if (masterData) {
                    // تحديث المخزون الموجود
                    const { error: updateError } = await this.state.supabase
                        .from('a_master')
                        .update({ item_qty: newQty })
                        .eq('item_id', line.item_id)
                        .eq('store_id', this.state.fixedStoreId);
                    
                    if (updateError) {
                        console.warn(`⚠️ خطأ في تحديث مخزون الصنف ${line.item_id}:`, updateError);
                    } else {
                        console.log(`✅ تم تحديث مخزون الصنف ${line.item_id} من ${currentQty} إلى ${newQty}`);
                    }
                } else {
                    // إدخال جديد في المخزون
                    const { error: insertError } = await this.state.supabase
                        .from('a_master')
                        .insert({
                            item_id: line.item_id,
                            store_id: this.state.fixedStoreId,
                            item_qty: line.quantity,
                            min_qty: 0,
                            item_nm: line.item_name
                        });
                    
                    if (insertError) {
                        console.warn(`⚠️ خطأ في إدخال مخزون الصنف ${line.item_id}:`, insertError);
                    } else {
                        console.log(`✅ تم إضافة مخزون جديد للصنف ${line.item_id}: ${line.quantity}`);
                    }
                }
            }
        } catch (error) {
            console.error("❌ خطأ في تحديث المخزون:", error);
        }
    }

    async _generateReturnInvoiceId() {
        try {
            // البحث عن آخر رقم فاتورة مرتجع
            const { data, error } = await this.state.supabase
                .from('sales_return')
                .select('invoice_id')
                .order('invoice_id', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 يعني لا توجد بيانات
                console.error("❌ خطأ في جلب رقم الفاتورة:", error);
                return Date.now(); // استخدام الطابع الزمني كرقم فاتورة احتياطي
            }

            const lastInvoiceId = data?.invoice_id || 0;
            return parseInt(lastInvoiceId) + 1;
            
        } catch (error) {
            console.error("❌ خطأ في توليد رقم الفاتورة:", error);
            return Date.now(); // استخدام الطابع الزمني كرقم فاتورة احتياطي
        }
    }

    newReturn() {
        this.state.originalInvoice = null;
        this.state.returnLines = [];
        this.state.currentItem = null;

        this.state.dom.invoiceSearch.value = '';
        this.state.dom.itemSearch.value = '';

        if (this.state.dom.returnQty) this.state.dom.returnQty.value = '1';
        if (this.state.dom.returnPrice) this.state.dom.returnPrice.value = '';
        if (this.state.dom.returnRemarks) this.state.dom.returnRemarks.value = '';

        this._clearInvoiceResults();
        this._clearItemResults();
        this._updateReturnTable();
        this._updateTotals();

        // التركيز على البحث
        if (this.state.currentMode === 'with-invoice') {
            this.state.dom.invoiceSearch?.focus();
        } else {
            this.state.dom.itemSearch?.focus();
        }

        console.log("🆕 بدء مرتجع جديد");
    }

    _showError(message) {
        this._showToast(message, 'error');
        console.error(`❌ ${message}`);
    }

    _showSuccess(message) {
        this._showToast(message, 'success');
        console.log(`✅ ${message}`);
    }

    _showWarning(message) {
        this._showToast(message, 'warning');
        console.warn(`⚠️ ${message}`);
    }

    _showToast(message, type = 'success') {
        try {
            const toast = document.getElementById('toast');
            if (toast) {
                toast.textContent = message;
                toast.style.background = type === 'success' ? '#28a745' : 
                                        type === 'warning' ? '#ffc107' : '#dc3545';
                toast.style.display = 'block';
                
                setTimeout(() => {
                    toast.style.display = 'none';
                }, 3000);
            } else {
                alert(message);
            }
        } catch (error) {
            alert(message);
        }
    }
}

// تهيئة التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    window.app = new SalesReturnApp();
});