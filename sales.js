class SalesApp {
    constructor() {
        this.initState();
        this.config = this.initConfig();
        this.initManagers();
        this._msgTimer = null;
        this.isSaving = false; // إضافة خاصية تتبع حالة الحفظ
        this.init();
    }

    initState() {
        this.state = {
            lines: [],
            itemsCache: [],
            currentMaster: null,
            currentItem: null,
            selectedIndex: -1,
            searchTimer: null,
            priceUnitMap: {},
            originalPrice: 0,
            isAdding: false,
            isPaymentOpen: false,
            connection: { mode: 'supabase', status: 'connecting', message: '🌐 جاري الاتصال...' }
        };
    }

    initConfig() {
        return {
            SUPABASE_URL: 'https://rvjacvrrpguehbapvewe.supabase.co',
            SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2amFjdnJycGd1ZWhiYXB2ZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMjUxNTksImV4cCI6MjA3ODYwMTE1OX0.wSavKzxKOF7-56G-pzDMtbXNrCNAbGs0wvadw-cilBg',
            UPDATE_INTERVAL: 1000 // تحديث الوقت كل ثانية
        };
    }

    initManagers() {
        this.dom = new DOMHandler(this);
        this.api = new APIManager(this);
        this.ui = new UIHandler(this);
        this.validation = new ValidationHandler(this);
        this.invoice = new InvoiceManager(this);
        this.inventory = new InventoryManager(this);
    }

    async init() {
        try {
            this.debugStorage();
            this.dom.initialize();
            this.ui.setCurrentDate();
            this.ui.updateDateTimeDisplay(); // تحديث التاريخ والوقت فوراً
            await this.api.initializeConnection();
            await this.loadInitialData();
            this.setupEventListeners();
            this.startDateTimeUpdater(); // بدأ التحديث التلقائي للوقت
            
            // تركيز المؤشر في حقل كود الصنف عند بداية التحميل
            this.focusItemField();
            
            this.ui.showMessage('✅ تم تهيئة النظام بنجاح', 'toast');
        } catch (error) {
            console.error('خطأ في التهيئة:', error);
            this.ui.showMessage('❌ فشل في تهيئة النظام', 'error');
        }
    }

    async loadInitialData() {
        try {
            await Promise.all([
                this.inventory.loadStores(),
                this.inventory.loadCustomers(),
                this.inventory.loadUnits()
            ]);
            await this.invoice.loadNextInvoiceNumber();
        } catch (error) {
            console.error('خطأ في تحميل البيانات:', error);
            this.invoice.setDefaultInvoiceNumber();
        }
    }

    setupEventListeners() {
        const events = [
            ['item_id', 'input', () => this.handleItemInput()],
            ['item_id', 'keydown', (e) => this.handleItemKeyDown(e)],
            ['price_type', 'change', () => this.updatePrice()],
            ['unit_type', 'change', () => this.updatePriceFromUnit()],
            ['store_id', 'change', () => this.handleStoreChange()],
            ['saveDraftBtn', 'click', () => this.saveDraft()],
            ['newInvoiceBtn', 'click', () => this.newInvoice()],
            ['completeSaleBtn', 'click', (e) => { e.preventDefault(); this.handleF6Save(); }],
            ['printInvoiceBtn', 'click', () => this.printThermal()],
            ['discountAll', 'input', () => this.renderLines()],
            ['paid_amount', 'input', () => this.renderLines()],
            ['tran_date', 'change', () => this.invoice.loadNextInvoiceNumber()]
        ];

        events.forEach(([id, event, handler]) => this.dom.bindEvent(id, event, handler));
        document.addEventListener('keydown', (e) => this.handleGlobalKeys(e));
        this.dom.getElement('searchDropdown')?.addEventListener('click', (e) => this.ui.handleDropdownClick(e));
    }

    // ========== HANDLERS الرئيسية ==========
    async handleItemInput() {
        const query = this.dom.getElement('item_id').value.trim();
        clearTimeout(this.state.searchTimer);
        
        if (!query) {
            this.ui.hideDropdown();
            return;
        }
        
        this.state.searchTimer = setTimeout(async () => {
            if (!this.dom.getElement('store_id').value) {
                this.ui.showMessage('⚠️ اختر الفرع أولاً', 'toast');
                this.dom.getElement('item_id').value = '';
                return;
            }
            /^\d+$/.test(query) ? await this.searchByItemCode(query) : await this.searchByItemName(query);
        }, /^\d+$/.test(query) ? 300 : 250);
    }

    handleItemKeyDown(e) {
        const handlers = {
            'Enter': () => this.handleEnterKey(),
            'ArrowDown': () => this.ui.moveSelection(1),
            'ArrowUp': () => this.ui.moveSelection(-1),
            'Escape': () => this.ui.hideDropdown()
        };
        if (handlers[e.key]) { e.preventDefault(); handlers[e.key](); }
    }

    handleEnterKey() {
        if (this.ui.isDropdownVisible()) {
            // إذا كانت القائمة المنسدلة ظاهرة، نختار العنصر النشط
            this.ui.selectActiveItem();
        } else if (this.state.currentItem && this.dom.getElement('item_id').value.trim()) {
            // إذا كان هناك صنف محدد، نضيفه
            this.addItemManually();
        } else if (this.dom.getElement('item_id').value.trim()) {
            // إذا كان هناك نص في الحقل، نبحث
            this.performSearch();
        }
    }

    async addItemManually() {
        if (!this.state.currentMaster || this.state.isAdding) return;
        
        this.state.isAdding = true;
        
        try {
            const validation = this.validation.validateItemForAddition();
            if (!validation.valid) return;
            
            const row = this.createItemRow(validation);
            this.state.lines.push(row);
            this.renderLines();
            this.ui.showMessage('✅ تم إضافة الصنف', 'toast', 1000);
            
            // إظهار بيانات المخزون
            if (this.state.currentMaster) {
                this.ui.showInventoryInfo(this.state.currentMaster);
            }
            
            // تفريغ الحقل وإعادة التركيز
            this.clearCurrentItem();
            
        } catch (error) {
            console.error(error);
            this.ui.showMessage('خطأ أثناء إضافة الصنف', 'toast');
        } finally {
            this.state.isAdding = false;
        }
    }

    async handleStoreChange() {
        const storeSelect = this.dom.getElement('store_id');
        const selectedStoreId = storeSelect.value;
        if (selectedStoreId) {
            const selectedOption = storeSelect.options[storeSelect.selectedIndex];
            this.inventory.saveStoreSelection(selectedStoreId, selectedOption.text);
        }
        await this.invoice.loadNextInvoiceNumber();
        this.clearCurrentItem();
    }

    handleF6Save() {
        if (this.state.lines.length === 0) {
            this.ui.showMessage('⚠️ يجب إضافة صنف واحد على الأقل قبل الحفظ', 'error');
            this.focusItemField();
            return;
        }
        this.openPaymentPopup();
    }

    openPaymentPopup() {
        const discountAll = parseFloat(this.dom.getElement('discountAll')?.value || 0) || 0;
        const totals = this.calculateTotals();
        const itemsDiscount = this.state.lines.reduce((sum, row) => sum + row.discount, 0);
        const finalTotal = totals.totalPrice - (itemsDiscount + discountAll);

        if (this.state.lines.length === 0) {
            this.ui.showMessage('⚠️ لا توجد أصناف بالفاتورة', 'error');
            return;
        }
        this.ui.openPaymentModal(finalTotal);
    }

    handleGlobalKeys(e) {
        const keyHandlers = {
            'F1': () => { e.preventDefault(); this.ui.showKeyboardHelp(); },
            'F2': () => { e.preventDefault(); this.focusItemField(); },
            'F5': () => { e.preventDefault(); this.newInvoice(); },
            'F6': () => { e.preventDefault(); this.handleF6Save(); },
            'F9': () => { e.preventDefault(); this.openPaymentPopup(); },
            'F12': () => { e.preventDefault(); this.printThermal(); },
            'Escape': () => { this.ui.hideDropdown(); }
        };
        if (keyHandlers[e.key]) keyHandlers[e.key]();
    }

    // ========== عمليات البحث ==========
    async searchByItemCode(code) {
        try {
            const item = await this.api.fetchItemByCode(code);
            if (!item) {
                this.ui.showMessage('لم يتم العثور على الصنف', 'toast');
                this.dom.getElement('item_id').value = '';
                return;
            }
            
            this.state.currentItem = item;
            this.dom.getElement('item_id').value = item.item_id;
            
            const success = await this.inventory.loadMasterForItem(this.dom.getElement('store_id').value, code);
            if (success) {
                this.ui.hideDropdown();
                this.updatePrice();
                
                // إظهار بيانات المخزون فوراً
                this.ui.showInventoryInfo(this.state.currentMaster);
                
                // لا نضيف الصنف تلقائياً، بل ننتظر الضغط على Enter
                this.ui.showMessage('📦 تم تحميل بيانات الصنف، اضغط Enter للإضافة', 'toast', 2000);
            }
        } catch (error) {
            this.ui.showMessage('خطأ في البحث بالكود', 'toast');
            this.dom.getElement('item_id').value = '';
        }
    }

    async searchByItemName(query) {
        try {
            const items = await this.api.searchItemsInStore(this.dom.getElement('store_id').value, query);
            if (!items.length) {
                this.ui.showDropdownMessage('❌ لا توجد أصناف متاحة');
                this.dom.getElement('item_id').value = '';
                return;
            }
            
            this.state.itemsCache = items;
            this.ui.showSearchResults(items);
        } catch (error) {
            console.error('خطأ في البحث:', error);
            this.ui.hideDropdown();
            this.dom.getElement('item_id').value = '';
        }
    }

    async performSearch() {
        const query = this.dom.getElement('item_id').value.trim();
        if (!query || !this.dom.getElement('store_id').value) return;
        
        /^\d+$/.test(query) ? await this.searchByItemCode(query) : await this.searchByItemName(query);
        
        setTimeout(() => {
            if (this.ui.isDropdownVisible()) {
                this.state.selectedIndex = 0;
                this.ui.highlightItem(0);
            }
        }, 60);
    }

    // ========== إدارة الأصناف ==========
    async selectItem(itemId) {
        try {
            const item = this.state.itemsCache.find(x => x.item_id == itemId) || await this.api.fetchItemByCode(itemId);
            this.state.currentItem = item;
            this.dom.getElement('item_id').value = item.item_id;
            
            const success = await this.inventory.loadMasterForItem(this.dom.getElement('store_id').value, itemId);
            if (!success) {
                this.dom.getElement('item_id').value = '';
                this.focusItemField();
                return false;
            }
            
            this.updatePrice();
            
            // إظهار بيانات المخزون فوراً
            this.ui.showInventoryInfo(this.state.currentMaster);
            
            // إظهار رسالة للإضافة بالضغط على Enter
            this.ui.showMessage('📦 تم تحميل الصنف، اضغط Enter للإضافة', 'toast', 2000);
            
            return true;
        } catch (error) {
            console.error(error);
            this.ui.showMessage('خطأ في اختيار الصنف', 'toast');
            return false;
        }
    }

    createItemRow(validation) {
        const master = this.state.currentMaster;
        const price = this.calculateCurrentPrice();
        const qty = parseFloat(validation.qty) || 1;
        const discount = parseFloat(validation.discount) || 0;
        const total = +(price * qty - discount).toFixed(2);
        
        return {
            item_id: master.item_id,
            item_nm: master.item_nm || this.state.currentItem?.item_nm || '',
            qty, unit: validation.unit, conv: validation.conv, base_qty: validation.baseQty,
            price, discount, total, batch_no: master.batch_no, expiry_date: master.expiry_date,
            has_offer: master.has_active_offer || false, original_price: this.state.originalPrice,
            offer_applied: master.has_active_offer ? price !== this.state.originalPrice : false
        };
    }

    calculateCurrentPrice() {
        const master = this.state.currentMaster;
        const priceType = this.dom.getElement('price_type')?.value || 'سعر1';
        const prices = {
            'سعر1': parseFloat(master.final_price1) || parseFloat(master.sale_price1) || 0,
            'سعر2': parseFloat(master.final_price2) || parseFloat(master.sale_price2) || 0,
            'سعر3': parseFloat(master.final_price3) || parseFloat(master.sale_price3) || 0
        };
        return prices[priceType] || prices['سعر1'];
    }

    editLine(index) {
        const row = this.state.lines[index];
        this.selectItem(row.item_id).then(() => {
            this.state.lines.splice(index, 1);
            this.renderLines();
            this.ui.showMessage('✏️ يمكنك تعديل الصنف الآن', 'toast');
        });
    }

    deleteLine(index) {
        if (!confirm('هل تريد حذف السطر؟')) return;
        this.state.lines.splice(index, 1);
        this.renderLines();
        this.ui.showMessage('🗑️ تم حذف الصنف', 'toast');
    }

    updateLineQty(index, newQty) {
        if (!this.validation.validateLineQuantity(index, newQty)) return this.renderLines();
        
        const row = this.state.lines[index];
        if (!row) return;

        const qty = parseFloat(newQty) || 0;
        row.qty = qty;
        row.total = +(row.price * qty - row.discount).toFixed(2);
        row.base_qty = qty * row.conv;

        this.renderLines();
        this.ui.showMessage('تم تحديث الكمية', 'toast', 1000);
    }

    updatePrice() {
        const master = this.state.currentMaster;
        if (!master) return;
        
        const price = this.calculateCurrentPrice();
        this.state.originalPrice = price;
        
        const priceType = this.dom.getElement('price_type')?.value || 'سعر1';
        let message = `💰 ${priceType}: ${Number(price).toFixed(2)}`;
        if (master.has_active_offer) message += ' 🏷️ (عرض نشط)';
        if (price > 0) this.ui.showMessage(message, 'toast', 1400);
    }

    updatePriceFromUnit() {
        const selectedUnit = this.dom.getElement('unit_type')?.value;
        if (!selectedUnit) return;
        
        for (const [priceType, unit] of Object.entries(this.state.priceUnitMap || {})) {
            if (unit === selectedUnit) {
                this.dom.getElement('price_type').value = priceType;
                this.updatePrice();
                return;
            }
        }
        this.dom.getElement('price_type').value = 'سعر1';
        this.updatePrice();
    }

    renderLines() {
        if (!this.dom.getElement('itemsList')) return;
        
        this.dom.getElement('itemsList').innerHTML = '';
        const totals = this.calculateTotals();
        
        this.state.lines.forEach((row, index) => {
            this.dom.getElement('itemsList').appendChild(this.ui.createLineElement(row, index));
        });
        
        this.updateSummary(totals);
    }

    calculateTotals() {
        return this.state.lines.reduce((acc, row) => {
            const price = parseFloat(row.price) || 0;
            const qty = parseFloat(row.qty) || 0;
            const discount = parseFloat(row.discount) || 0;
            acc.totalQty += qty;
            acc.totalPrice += qty * price;
            acc.totalDiscount += discount;
            return acc;
        }, { totalQty: 0, totalPrice: 0, totalDiscount: 0 });
    }

    updateSummary(totals) {
        const discountAll = parseFloat(this.dom.getElement('discountAll')?.value || 0) || 0;
        const itemsDiscount = this.state.lines.reduce((sum, row) => sum + row.discount, 0);
        const totalDiscount = itemsDiscount + discountAll;
        const finalTotal = totals.totalPrice - totalDiscount;
        const paid = parseFloat(this.dom.getElement('paid_amount')?.value || 0) || 0;
        const change = Math.max(0, paid - finalTotal);
        
        this.ui.updateSummaryDisplay({
            totalQty: totals.totalQty, totalPrice: totals.totalPrice,
            totalDiscount, finalTotal, change
        });
    }

    // ========== عمليات الحفظ ==========
    async saveSale() { return await this.saveSaleWithFocus(); }

    async saveDraft() {
        const previous = this.dom.getElement('sale_type')?.value;
        if (this.dom.getElement('sale_type')) this.dom.getElement('sale_type').value = 'مسودة';
        await this.saveSale();
        if (this.dom.getElement('sale_type')) this.dom.getElement('sale_type').value = previous;
    }

    async saveSaleWithFocus() {
        if (this.isSaving) {
            this.ui.showMessage('⏳ جاري حفظ الفاتورة السابقة...', 'toast');
            return false;
        }
        
        if (!this.validation.validateSaleForSave()) return false;

        this.isSaving = true;
        const saveButton = this.dom.getElement('completeSaleBtn');
        const originalText = saveButton ? saveButton.textContent : '';
        
        try {
            if (saveButton) {
                saveButton.disabled = true;
                saveButton.innerHTML = '⏳ جاري الحفظ...';
            }
            
            const { payloadInvoice, payloadItems } = this.invoice.buildPayload();
            
            // التحقق من وجود الفاتورة
            const invoiceCheck = await this.invoice.checkInvoiceExists(payloadInvoice.invoice_id);
            if (invoiceCheck.exists) {
                this.ui.showMessage(`⚠️ الفاتورة ${payloadInvoice.invoice_id} مسجلة مسبقاً`, 'error');
                this.invoice.incrementInvoiceNumber();
                this.ui.showMessage(`تم تغيير رقم الفاتورة إلى: ${this.dom.getElement('invoice_id').value}`, 'toast');
                return false;
            }

            console.log('💾 بدء عملية حفظ الفاتورة...');
            console.log('📊 بيانات الفاتورة:', payloadInvoice);
            console.log('📦 عدد الأصناف:', payloadItems.length);
            
            // حفظ الفاتورة
            const saved = await this.api.saveInvoice(payloadInvoice, payloadItems);
            
            if (saved) {
                // طباعة الفاتورة
                this.printThermal();
                
                // تنظيف الشاشة بعد الحفظ الناجح
                this.cleanScreenAfterSave();
                
                this.ui.showMessage('✅ تم حفظ الفاتورة بنجاح وتحديث المخزون', 'toast');
                return true;
            } else {
                this.ui.showMessage('❌ فشل في حفظ الفاتورة', 'error');
                return false;
            }

        } catch (error) {
            console.error('❌ خطأ في حفظ الفاتورة:', error);
            this.ui.showMessage(`❌ فشل في حفظ الفاتورة: ${error.message}`, 'error');
            return false;
        } finally {
            this.isSaving = false;
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.textContent = originalText;
            }
        }
    }
    
    // تنظيف الشاشة بعد الحفظ الناجح
    cleanScreenAfterSave() {
        // تفريغ قائمة الأصناف
        this.state.lines = [];
        this.renderLines();
        
        // إعادة تعيين القيم الافتراضية
        this.dom.setValue('discountAll', '0');
        this.dom.setValue('paid_amount', '0');
        this.dom.setValue('remarks', '');
        this.dom.setValue('customer_id', '');
        
        // إخفاء معلومات المخزون
        this.ui.hideInventoryInfo();
        
        // تفريغ الصنف الحالي
        this.clearCurrentItem();
        
        // زيادة رقم الفاتورة
        this.invoice.incrementInvoiceNumber();
        
        // التركيز على حقل البحث
        setTimeout(() => this.focusItemField(), 100);
    }

    // ========== الدوال المساعدة ==========
    clearCurrentItem() {
        this.state.currentMaster = null;
        this.state.currentItem = null;
        this.state.selectedIndex = -1;
        this.dom.getElement('item_id').value = '';
        this.ui.hideDropdown();
        this.ui.hideInventoryInfo();
        setTimeout(() => this.focusItemField(), 50);
    }

    focusItemField() {
        if (!this.state.isPaymentOpen) {
            const itemField = this.dom.getElement('item_id');
            if (itemField) {
                itemField.focus();
                itemField.select();
            }
        }
    }

    newInvoice(hard = false) { hard ? location.reload() : this.resetInvoice(); }

    resetInvoice() {
        this.state.lines = [];
        this.renderLines();
        this.clearCurrentItem();
        this.dom.setValue('discountAll', '0');
        this.dom.setValue('paid_amount', '0');
        this.dom.setValue('remarks', '');
        this.ui.showMessage('فاتورة جديدة', 'toast');
    }

    printThermal() { this.invoice.printThermal(); }

    // تحديث الوقت والتاريخ تلقائياً
    startDateTimeUpdater() {
        setInterval(() => {
            this.ui.updateDateTimeDisplay();
        }, this.config.UPDATE_INTERVAL);
    }

    debugStorage() {
        console.log('🔍 فحص كامل للتخزين:');
        ['localStorage', 'sessionStorage'].forEach(storage => {
            console.log(`🗂️ ${storage}:`);
            for (let i = 0; i < window[storage].length; i++) {
                const key = window[storage].key(i);
                console.log(`  ${key}: ${window[storage].getItem(key)}`);
            }
        });
    }
}

class DOMHandler {
    constructor(app) {
        this.app = app;
        this.elements = {};
    }

    initialize() {
        this.cacheElements();
        this.createAlertBox();
        this.ensureDropdownStyles();
    }

    cacheElements() {
        const ids = ['tran_date','store_id','customer_id','invoice_id','sale_type','price_type','unit_type',
            'item_id','searchResults','inventoryInfo','stockInfo','batchInfo','expiryInfo','item_qty',
            'sale_price','item_discount','addItemBtn','itemsList','sumQty','sumPrice','sumTotal','sumDiscount',
            'discount','paid_amount','remarks','newInvoiceBtn','saveDraftBtn','completeSaleBtn','printInvoiceBtn',
            'cancelSaleBtn','toast','discountAll','changeAmount','exportBtn','importInput'];
        
        ids.forEach(id => this.elements[id] = document.getElementById(id));
        this.elements.searchDropdown = document.getElementById('search-dropdown') || this.elements.searchResults;
    }

    createAlertBox() {
        if (!document.getElementById('alertBox')) {
            const alertBox = document.createElement('div');
            alertBox.id = 'alertBox';
            alertBox.className = 'alert-box';
            document.body.appendChild(alertBox);
        }
    }

    ensureDropdownStyles() {
        if (!document.getElementById('dropdown-styles')) {
            const style = document.createElement('style');
            style.id = 'dropdown-styles';
            style.textContent = `
                #search-dropdown { background:white; border:1px solid #ccc; border-radius:4px; 
                    box-shadow:0 2px 10px rgba(0,0,0,0.1); max-height:200px; overflow-y:auto; 
                    z-index:1000; position:absolute; display:none; }
                .dropdown-item { padding:8px 12px; cursor:pointer; border-bottom:1px solid #eee; 
                    font-family:Arial, sans-serif; font-size:14px; }
                .dropdown-item:hover, .dropdown-item.active { background:#007bff; color:white; }
                .dropdown-item:last-child { border-bottom:none; }
            `;
            document.head.appendChild(style);
        }
    }

    getElement(id) { return this.elements[id]; }
    setValue(id, value) { const el = this.getElement(id); if (el) el.value = value; }
    bindEvent(elementId, event, handler) {
        const element = this.getElement(elementId);
        if (element) element.addEventListener(event, handler);
    }
}

class APIManager {
    constructor(app) { 
        this.app = app; 
        this.supabase = null; 
    }

    async initializeConnection() {
        try {
            this.updateConnectionStatus('connecting', '🌐 جاري الاتصال بـ Supabase...');
            console.log('🔍 تهيئة اتصال Supabase...');

            try {
                const supabaseSuccess = await this.initializeSupabase();
                if (supabaseSuccess) {
                    this.app.state.connection.mode = 'supabase';
                    this.updateConnectionStatus('supabase', '🌐 متصل بـ Online مباشر');
                    console.log('✅ الاتصال بـ Supabase ناجح');
                    return;
                }
            } catch (error) {
                console.error('❌ فشل الاتصال بـ Supabase:', error);
                throw error;
            }
        } catch (error) {
            console.error('❌ خطأ في initializeConnection:', error);
            this.updateConnectionStatus('error', '❌ خطأ في الاتصال');
        }
    }

    async initializeSupabase() {
        if (typeof window.supabase === 'undefined') await this.loadSupabaseLibrary();
        return await this.createSupabaseClient();
    }

    async loadSupabaseLibrary() {
        return new Promise((resolve, reject) => {
            if (typeof window.supabase !== 'undefined') return resolve();
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('فشل تحميل مكتبة Supabase'));
            document.head.appendChild(script);
        });
    }

    async createSupabaseClient() {
        try {
            // استخدام العميل الموجود إذا كان متاحاً
            if (window.__SUPABASE_CLIENT__) {
                this.supabase = window.__SUPABASE_CLIENT__;
                console.log('✅ استخدام نسخة Supabase الموجودة');
                return true;
            }

            // إنشاء عميل جديد
            this.supabase = window.supabase.createClient(this.app.config.SUPABASE_URL, this.app.config.SUPABASE_KEY);
            window.__SUPABASE_CLIENT__ = this.supabase;
            
            // اختبار الاتصال
            const { error } = await this.supabase.from('sales').select('count').limit(1);
            if (error) throw error;
            
            console.log('✅ Supabase initialized successfully');
            return true;
            
        } catch (error) {
            console.error('❌ خطأ في createSupabaseClient:', error);
            throw error;
        }
    }

    updateConnectionStatus(status, message = '') {
        try {
            const statusDiv = document.getElementById('connectionStatus');
            const statusText = document.getElementById('statusText');
            if (!statusDiv) return;
            statusDiv.className = `connection-status ${status}`;
            if (statusText) statusText.textContent = message;
        } catch (error) {
            console.error('❌ خطأ في updateConnectionStatus:', error);
        }
    }

    async fetchItemByCode(code) {
        try {
            const { data, error } = await this.supabase
                .from('items')
                .select('*')
                .eq('item_id', code)
                .maybeSingle();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('خطأ في fetchItemByCode:', error);
            throw error;
        }
    }

    async searchItemsInStore(storeId, query) {
        try {
            const { data, error } = await this.supabase
                .from('items')
                .select('*')
                .or(`item_id.ilike.%${query}%,item_nm.ilike.%${query}%`)
                .limit(20);
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('خطأ في searchItemsInStore:', error);
            throw error;
        }
    }

    async saveInvoice(invoiceData, itemsData) {
        try {
            console.log(`💾 جاري حفظ الفاتورة ${invoiceData.invoice_id}...`);
            
            // التحقق من اتصال Supabase
            if (!this.supabase) {
                throw new Error('اتصال Supabase غير متوفر');
            }
            
            const savedItems = [];
            const failedItems = [];

            // حفظ كل صنف على حدة
            for (let i = 0; i < itemsData.length; i++) {
                const row = itemsData[i];
                
                try {
                    const supabasePayload = this.prepareSupabasePayload(invoiceData, row, i);
                    console.log(`📦 جاري حفظ الصنف ${i + 1}: ${row.item_id}`);
                    
                    // محاولة الحفظ مع ser_no
                    const { data, error } = await this.supabase
                        .from("sales")
                        .insert([supabasePayload])
                        .select();
                    
                    if (error) {
                        console.error(`❌ خطأ في حفظ الصنف ${row.item_id}:`, error);
                        
                        // محاولة بدون ser_no
                        const payloadWithoutSerNo = { ...supabasePayload };
                        delete payloadWithoutSerNo.ser_no;
                        
                        console.log(`🔄 محاولة حفظ الصنف ${row.item_id} بدون ser_no...`);
                        const { data: retryData, error: retryError } = await this.supabase
                            .from("sales")
                            .insert([payloadWithoutSerNo])
                            .select();
                        
                        if (retryError) {
                            console.error(`❌ فشل حفظ الصنف ${row.item_id}:`, retryError);
                            failedItems.push({ itemId: row.item_id, error: retryError });
                            continue;
                        }
                        
                        console.log(`✅ تم حفظ الصنف ${row.item_id} بدون ser_no`);
                    } else {
                        console.log(`✅ تم حفظ الصنف ${row.item_id} بنجاح`);
                    }
                    
                    savedItems.push(row.item_id);

                    // تحديث المخزون في a_master
                    try {
                        const inventoryUpdated = await this.updateInventory(row.item_id, invoiceData.store_id, row.base_qty);
                        if (inventoryUpdated) {
                            console.log(`✅ تم تحديث مخزون الصنف ${row.item_id}`);
                        } else {
                            console.warn(`⚠️ فشل في تحديث مخزون الصنف ${row.item_id}`);
                        }
                    } catch (invError) {
                        console.warn(`⚠️ خطأ في تحديث مخزون الصنف ${row.item_id}:`, invError);
                    }
                    
                } catch (itemError) {
                    console.error(`❌ خطأ في معالجة الصنف ${row.item_id}:`, itemError);
                    failedItems.push({ itemId: row.item_id, error: itemError });
                }
            }

            // عرض النتائج
            if (failedItems.length > 0) {
                console.error(`❌ فشل في حفظ ${failedItems.length} من ${itemsData.length} أصناف`);
                throw new Error(`فشل في حفظ ${failedItems.length} أصناف`);
            }
            
            console.log(`✅ تم حفظ الفاتورة ${invoiceData.invoice_id} بنجاح (${savedItems.length} صنف)`);
            return true;
            
        } catch (error) {
            console.error('❌ خطأ في حفظ الفاتورة:', error);
            throw error;
        }
    }

    prepareSupabasePayload(invoiceData, item, lineIndex) {
        const user_id = localStorage.getItem("user_id") || sessionStorage.getItem("user_id") || null;
        const currentDate = new Date().toISOString();
        
        return {
            tran_date: invoiceData.tran_date ? new Date(invoiceData.tran_date).toISOString() : currentDate,
            store_id: parseInt(invoiceData.store_id) || 1,
            customer_id: invoiceData.customer_id ? parseInt(invoiceData.customer_id) : null,
            invoice_id: parseInt(invoiceData.invoice_id) || 1,
            sale_type: invoiceData.sale_type || 'نقدي',
            price_type: invoiceData.price_type || 'سعر1',
            discount: parseFloat(invoiceData.discount) || 0,
            user_id: user_id ? parseInt(user_id) : null,
            user_stamp: currentDate,
            item_id: item.item_id.toString(),
            item_qty: parseFloat(item.item_qty) || 0,
            sale_price: parseFloat(item.price) || 0,
            total_price: parseFloat(item.total) || 0,
            unit_type: item.unit || 'قطعة',
            batch_no: item.batch_no || '',
            expiry_date: item.expiry_date || null,
            units_per_package: parseFloat(item.conv) || 1,
            base_qty: parseFloat(item.base_qty) || parseFloat(item.item_qty) || 0,
            conversion_factor: parseFloat(item.conv) || 1,
            remarks: invoiceData.remarks || '',
            ser_no: lineIndex + 1
        };
    }

    async updateInventory(itemId, storeId, quantity) {
        try {
            console.log(`📊 تحديث مخزون الصنف ${itemId} في المخزن ${storeId}...`);
            
            // التحقق من اتصال Supabase
            if (!this.supabase) {
                throw new Error('اتصال Supabase غير متوفر');
            }
            
            // جلب المخزون الحالي من a_master
            const { data: master, error: fetchError } = await this.supabase
                .from("a_master")
                .select("item_qty")
                .eq("item_id", itemId)
                .eq("store_id", storeId)
                .maybeSingle();

            if (fetchError) {
                console.error('❌ خطأ في جلب المخزون من a_master:', fetchError);
                return false;
            }

            if (!master) {
                console.warn(`⚠️ الصنف ${itemId} غير موجود في المخزن ${storeId} (جدول a_master)`);
                
                // محاولة البحث في جدول items
                const { data: itemData, error: itemError } = await this.supabase
                    .from("items")
                    .select("item_qty")
                    .eq("item_id", itemId)
                    .maybeSingle();
                    
                if (itemError) {
                    console.error('❌ خطأ في البحث عن الصنف في جدول items:', itemError);
                    return false;
                }
                
                if (!itemData) {
                    console.error(`❌ الصنف ${itemId} غير موجود في قاعدة البيانات`);
                    return false;
                }
                
                // إذا وجد في items ولكن ليس في a_master، ننشئ سجل جديد
                const currentQty = parseFloat(itemData.item_qty) || 0;
                const qtyToDeduct = parseFloat(quantity) || 0;
                const newQty = currentQty - qtyToDeduct;
                
                if (newQty < 0) {
                    console.warn(`⚠️ الكمية غير كافية: ${currentQty} < ${qtyToDeduct}`);
                    return false;
                }
                
                // إدخال سجل جديد في a_master
                const { error: insertError } = await this.supabase
                    .from("a_master")
                    .insert({
                        item_id: itemId,
                        store_id: storeId,
                        item_qty: newQty,
                        created_at: new Date().toISOString()
                    });
                    
                if (insertError) {
                    console.error('❌ خطأ في إنشاء سجل جديد في a_master:', insertError);
                    return false;
                }
                
                console.log(`✅ تم إنشاء سجل جديد في a_master للمخزون: ${newQty}`);
                return true;
            }

            // إذا كان السجل موجوداً في a_master
            const currentQty = parseFloat(master.item_qty) || 0;
            const qtyToDeduct = parseFloat(quantity) || 0;
            const newQty = currentQty - qtyToDeduct;

            if (newQty < 0) {
                console.warn(`⚠️ الكمية غير كافية: ${currentQty} < ${qtyToDeduct}`);
                return false;
            }

            // تحديث المخزون في a_master
            const { error: updateError } = await this.supabase
                .from("a_master")
                .update({ 
                    item_qty: newQty,
                    
                })
                .eq("item_id", itemId)
                .eq("store_id", storeId);

            if (updateError) {
                console.error('❌ خطأ في تحديث المخزون في a_master:', updateError);
                return false;
            }

            console.log(`✅ تم تحديث مخزون ${itemId} من ${currentQty} إلى ${newQty}`);
            return true;

        } catch (error) {
            console.error('❌ خطأ في تحديث المخزون:', error);
            return false;
        }
    }
}

class UIHandler {
    constructor(app) { this.app = app; }

    setCurrentDate() {
        const dateField = this.app.dom.getElement('tran_date');
        if (dateField) dateField.value = this.getCurrentLocalDateTime();
    }

    getCurrentLocalDateTime() {
        const now = new Date();
        return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }

    // تحديث عرض التاريخ والوقت في الشريط العلوي
    updateDateTimeDisplay() {
        try {
            const now = new Date();
            const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
            
            const currentDate = now.toLocaleDateString('ar-EG', dateOptions);
            const currentTime = now.toLocaleTimeString('ar-EG', timeOptions);
            
            // تحديث عنصر dateInfo في الشريط العلوي
            const dateInfoElement = document.getElementById('dateInfo');
            if (dateInfoElement) {
                dateInfoElement.innerHTML = `📅 ${currentDate} | 🕒 ${currentTime}`;
            }
            
            // تحديث معلومات المستخدم والفرع
            this.updateUserAndStoreInfo();
            
        } catch (error) {
            console.error('خطأ في تحديث الوقت:', error);
        }
    }

    // تحديث معلومات المستخدم والفرع
    updateUserAndStoreInfo() {
        try {
            // معلومات المستخدم
            const currentUser = localStorage.getItem("user_name") || 
                               sessionStorage.getItem("user_name") || 
                               "المستخدم";
            
            const currentUserElement = document.getElementById('currentUser');
            if (currentUserElement) {
                currentUserElement.textContent = `👤 ${currentUser}`;
            }
            
            // معلومات الفرع
            const storeName = localStorage.getItem("store_name") || 
                             sessionStorage.getItem("store_name") || 
                             "الفرع";
            
            const storeInfoElement = document.getElementById('storeInfo');
            if (storeInfoElement) {
                storeInfoElement.textContent = `🏪 ${storeName}`;
            }
            
            // تحديث userInfo في الزاوية
            const userInfoElement = document.getElementById('userInfo');
            if (userInfoElement) {
                const userId = localStorage.getItem("user_id") || 
                              sessionStorage.getItem("user_id") || 
                              "";
                userInfoElement.innerHTML = `👤 ${currentUser} ${userId ? `(${userId})` : ''}`;
            }
            
        } catch (error) {
            console.error('خطأ في تحديث معلومات المستخدم:', error);
        }
    }

    showMessage(msg, type = 'info', duration = 3000) {
        clearTimeout(this.app._msgTimer);
        
        if (type === 'toast' || !this.app.dom.getElement('alertBox')) {
            const toast = this.app.dom.getElement('toast');
            if (toast) {
                toast.textContent = msg;
                toast.style.display = 'block';
                this.app._msgTimer = setTimeout(() => toast.style.display = 'none', duration);
            } else alert(msg);
            return;
        }
        
        const alertBox = this.app.dom.getElement('alertBox');
        alertBox.textContent = msg;
        alertBox.style.display = 'block';
        alertBox.style.background = type === 'error' ? '#f44336' : (type === 'warn' ? '#f1c232' : '#0b6cf6');
        alertBox.style.color = type === 'warn' ? '#333' : '#fff';
        this.app._msgTimer = setTimeout(() => alertBox.style.display = 'none', duration);
    }

    showSearchResults(items) {
        this.app.state.itemsCache = items;
        const dropdownItems = items.map((item, index) => ({
            text: `${item.item_id} | ${item.item_nm||''} | ${item.item_qty||0}`,
            value: item.item_id, raw: item
        }));
        this.showDropdown(dropdownItems);
    }

    showDropdown(items) {
        const container = this.app.dom.getElement('searchDropdown');
        if (!container) return;
        container.innerHTML = items.map((item, index) => 
            `<div class="dropdown-item" data-index="${index}" data-value="${item.value}">${item.text}</div>`
        ).join('');
        this.positionDropdown(container);
        container.style.display = 'block';
        this.app.state.selectedIndex = -1;
    }

    showDropdownMessage(msg) {
        const container = this.app.dom.getElement('searchDropdown');
        if (!container) return;
        container.innerHTML = `<div style="padding:12px;text-align:center;color:#666;">${msg}</div>`;
        container.style.display = 'block';
        this.app.state.selectedIndex = -1;
    }

    hideDropdown() {
        const container = this.app.dom.getElement('searchDropdown');
        if (container) container.style.display = 'none';
        this.app.state.selectedIndex = -1;
    }

    isDropdownVisible() {
        const container = this.app.dom.getElement('searchDropdown');
        return container && container.style.display === 'block';
    }

    positionDropdown(container) {
        try {
            const field = this.app.dom.getElement('item_id') || document.activeElement;
            const rect = field.getBoundingClientRect();
            container.style.position = 'absolute';
            container.style.left = rect.left + 'px';
            container.style.top = (rect.bottom + window.scrollY) + 'px';
            container.style.width = rect.width + 'px';
            container.style.zIndex = '1000';
        } catch (e) { console.warn('خطأ في تحديد موقع القائمة:', e); }
    }

    moveSelection(step) {
        const container = this.app.dom.getElement('searchDropdown');
        if (!container || container.style.display !== 'block') return;
        const items = Array.from(container.querySelectorAll('.dropdown-item'));
        if (!items.length) return;
        this.app.state.selectedIndex = (this.app.state.selectedIndex + step + items.length) % items.length;
        this.highlightItem(this.app.state.selectedIndex);
    }

    highlightItem(index) {
        const container = this.app.dom.getElement('searchDropdown');
        if (!container) return;
        const items = Array.from(container.querySelectorAll('.dropdown-item'));
        items.forEach((el, i) => el.classList.toggle('active', i === index));
        if (items[index]) items[index].scrollIntoView({ block: 'nearest' });
    }

    selectActiveItem() {
        const container = this.app.dom.getElement('searchDropdown');
        if (!container || container.style.display !== 'block') return;
        const items = Array.from(container.querySelectorAll('.dropdown-item'));
        if (this.app.state.selectedIndex < 0 || this.app.state.selectedIndex >= items.length) return;
        const selectedItem = items[this.app.state.selectedIndex];
        const itemId = selectedItem.dataset.value;
        if (itemId) {
            this.app.selectItem(itemId).then(() => {
                this.hideDropdown();
            });
        }
    }

    handleDropdownClick(e) {
        const itemElement = e.target.closest('.dropdown-item');
        if (!itemElement) return;
        const itemId = itemElement.dataset.value;
        if (itemId) {
            this.app.selectItem(itemId).then(() => {
                this.hideDropdown();
            });
        }
    }

    showInventoryInfo(master) {
        const inventoryInfo = this.app.dom.getElement('inventoryInfo');
        const stockInfo = this.app.dom.getElement('stockInfo');
        const batchInfo = this.app.dom.getElement('batchInfo');
        const expiryInfo = this.app.dom.getElement('expiryInfo');
        
        if (inventoryInfo) inventoryInfo.style.display = 'block';
        if (stockInfo) stockInfo.textContent = `الرصيد: ${master.item_qty}`;
        if (batchInfo) batchInfo.textContent = `تشغيلة: ${master.batch_no||'-'}`;
        if (expiryInfo) expiryInfo.textContent = `صلاحية: ${master.expiry_date||'-'}`;
        
        if (master.has_active_offer && inventoryInfo) this.showOfferBadge(inventoryInfo);
    }

    showOfferBadge(container) {
        const existingOfferInfo = document.getElementById('offerInfo');
        if (existingOfferInfo) existingOfferInfo.remove();
        const offerInfo = document.createElement('span');
        offerInfo.id = 'offerInfo';
        offerInfo.innerHTML = ` | 🏷️ <strong>عرض نشط</strong>`;
        offerInfo.style.color = '#e91e63';
        offerInfo.style.fontWeight = 'bold';
        container.appendChild(offerInfo);
    }

    hideInventoryInfo() {
        const inventoryInfo = this.app.dom.getElement('inventoryInfo');
        if (inventoryInfo) inventoryInfo.style.display = 'none';
    }

    createLineElement(row, index) {
        const div = document.createElement('div');
        div.className = `item-row ${row.has_offer ? 'with-offer' : ''}`;
        div.style.cssText = 'display:grid;grid-template-columns:40px 1fr 100px 80px 90px 100px 100px 80px;align-items:center;gap:8px;padding:6px;border-bottom:1px solid #eee;position:relative;';
        
        const price = parseFloat(row.price) || 0;
        const total = parseFloat(row.total) || 0;
        const discount = parseFloat(row.discount) || 0;
        const offerBadge = row.has_offer ? '<span class="offer-badge">عرض</span>' : '';
        
        div.innerHTML = `
            <div>${index + 1}</div>
            <div>${offerBadge}<strong>${row.item_id}</strong> — ${row.item_nm}</div>
            <div>${row.unit}</div>
            <div>
                <input type="number" value="${row.qty}" min="0.01" step="0.01" 
                        style="width:70px;padding:2px;text-align:center;border:1px solid #ddd;border-radius:3px;" 
                        onchange="window.salesApp.updateLineQty(${index}, this.value)"
                        onblur="window.salesApp.updateLineQty(${index}, this.value)">
            </div>
            <div>${price.toFixed(2)} ${row.offer_applied ? '🌟' : ''}</div>
            <div>${total.toFixed(2)}</div>
            <div>${discount.toFixed(2)}</div>
            <div style="display:flex;gap:6px;justify-content:flex-end">
                <button class="smallBtn" data-edit="${index}" style="padding:4px 8px;background:#ffc107;border:none;border-radius:3px;cursor:pointer">✏️</button>
                <button class="smallBtn" data-delete="${index}" style="padding:4px 8px;background:#dc3545;color:white;border:none;border-radius:3px;cursor:pointer">🗑️</button>
            </div>`;
        
        div.querySelector('[data-edit]')?.addEventListener('click', () => this.app.editLine(index));
        div.querySelector('[data-delete]')?.addEventListener('click', () => this.app.deleteLine(index));
        return div;
    }

    updateSummaryDisplay(totals) {
        const { totalQty, totalPrice, totalDiscount, finalTotal, change } = totals;
        if (this.app.dom.getElement('sumQty')) this.app.dom.getElement('sumQty').textContent = totalQty.toFixed(2);
        if (this.app.dom.getElement('sumPrice')) this.app.dom.getElement('sumPrice').textContent = totalPrice.toFixed(2);
        if (this.app.dom.getElement('sumDiscount')) this.app.dom.getElement('sumDiscount').textContent = totalDiscount.toFixed(2);
        if (this.app.dom.getElement('sumTotal')) this.app.dom.getElement('sumTotal').textContent = finalTotal.toFixed(2);
        if (this.app.dom.getElement('changeAmount')) {
            this.app.dom.getElement('changeAmount').value = change.toFixed(2);
            this.app.dom.getElement('changeAmount').style.color = change > 0 ? '#4caf50' : '#666';
        }
    }

    openPaymentModal(finalTotal) {
        this.app.state.isPaymentOpen = true;
        const modal = document.getElementById('paymentModal');
        const finalAmount = document.getElementById('finalAmount');
        const modalPaid = document.getElementById('modalPaid');
        const modalRemaining = document.getElementById('modalRemaining');

        if (!modal || !finalAmount || !modalPaid || !modalRemaining) {
            console.error('عناصر نافذة الدفع غير موجودة');
            return;
        }

        finalAmount.textContent = finalTotal.toFixed(2);
        modalPaid.value = finalTotal.toFixed(2);
        modalRemaining.textContent = '0.00';
        modal.style.display = 'flex';
        setTimeout(() => {
            modalPaid.focus();
            modalPaid.select();
        }, 50);
        this.setupPaymentModalEvents(modal, modalPaid, modalRemaining, finalTotal);
    }

    setupPaymentModalEvents(modal, modalPaid, modalRemaining, finalTotal) {
        modalPaid.oninput = () => {
            const paid = parseFloat(modalPaid.value || 0);
            const remaining = finalTotal - paid;
            modalRemaining.textContent = remaining.toFixed(2);
            
            // تغيير اللون حسب الحالة
            if (paid < 0) {
                modalRemaining.style.color = '#f44336';
                modalPaid.style.borderColor = '#f44336';
            } else if (paid === 0) {
                modalRemaining.style.color = '#ff9800';
                modalPaid.style.borderColor = '#ff9800';
            } else if (paid < finalTotal) {
                modalRemaining.style.color = '#ff9800';
                modalPaid.style.borderColor = '#ff9800';
            } else if (paid === finalTotal) {
                modalRemaining.style.color = '#4caf50';
                modalPaid.style.borderColor = '#4caf50';
            } else {
                modalRemaining.style.color = '#4caf50';
                modalPaid.style.borderColor = '#4caf50';
            }
        };

        modalPaid.onkeydown = (e) => {
            if (e.key === "Enter") document.getElementById('confirmPaymentBtn').click();
        };

        document.getElementById('confirmPaymentBtn').onclick = async () => {
            const paid = parseFloat(modalPaid.value || 0);
            
            // التحقق من أن المبلغ ليس أقل من 0
            if (isNaN(paid) || paid < 0) {
                this.showMessage('⚠️ المبلغ لا يمكن أن يكون أقل من الصفر', 'error');
                modalPaid.focus();
                modalPaid.select();
                return;
            }
            
            // التحقق من أن المبلغ أقل من المطلوب
            if (paid < finalTotal) {
                const confirmSave = confirm(`المبلغ المدفوع (${paid.toFixed(2)}) أقل من المطلوب (${finalTotal.toFixed(2)}). هل تريد المتابعة؟`);
                if (!confirmSave) {
                    modalPaid.focus();
                    modalPaid.select();
                    return;
                }
            }

            // حفظ المبلغ المدفوع في الحقل الرئيسي
            this.app.dom.getElement('paid_amount').value = paid;
            
            // إغلاق النافذة
            modal.style.display = 'none';
            this.app.state.isPaymentOpen = false;
            
            // حفظ الفاتورة
            const saved = await this.app.saveSaleWithFocus();
            
            if (!saved) {
                // إذا فشل الحفظ، نعيد فتح النافذة
                setTimeout(() => {
                    this.openPaymentModal(finalTotal);
                }, 100);
            }
        };

        this.addFullPaymentButton(modalPaid, finalTotal);
    }

    addFullPaymentButton(modalPaid, finalTotal) {
        const existingBtn = document.getElementById('fullPaymentBtn');
        if (existingBtn) existingBtn.remove();
        const fullPaymentBtn = document.createElement('button');
        fullPaymentBtn.id = 'fullPaymentBtn';
        fullPaymentBtn.textContent = '💰 الدفع الكامل';
        fullPaymentBtn.style.cssText = `padding:8px 12px;background:#4caf50;color:white;border:none;border-radius:4px;cursor:pointer;margin-top:10px;font-size:12px;`;
        fullPaymentBtn.onclick = () => {
            modalPaid.value = finalTotal.toFixed(2);
            modalPaid.dispatchEvent(new Event('input'));
            modalPaid.focus();
            modalPaid.select();
        };
        modalPaid.parentNode.appendChild(fullPaymentBtn);
    }

    showKeyboardHelp() {
        const existing = document.getElementById('keyboardHelp');
        if (existing) existing.remove();
        const help = document.createElement('div');
        help.id = 'keyboardHelp';
        help.innerHTML = `
            <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:20px;border-radius:10px;box-shadow:0 0 20px rgba(0,0,0,0.3);z-index:10000;max-width:400px;direction:rtl">
                <h3 style="margin-top:0;text-align:center;color:#007bff">🔤 اختصارات</h3>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:15px">
                    <div><kbd>F1</kbd></div><div>عرض المساعدة</div>
                    <div><kbd>F2</kbd></div><div>الذهاب لبحث الأصناف</div>
                    <div><kbd>F5</kbd></div><div>فاتورة جديدة</div>
                    <div><kbd>F6</kbd></div><div>حفظ الفاتورة</div>
                    <div><kbd>F9</kbd></div><div>فتح نافذة الدفع</div>
                    <div><kbd>F12</kbd></div><div>طباعة</div>
                </div>
                <div style="text-align:center;margin-top:15px;padding-top:15px;border-top:1px solid #eee">
                    <button onclick="document.getElementById('keyboardHelp').remove()" style="padding:8px 20px;background:#007bff;color:white;border:none;border-radius:5px;cursor:pointer">فهمت</button>
                </div>
            </div>`;
        document.body.appendChild(help);
    }
}

class ValidationHandler {
    constructor(app) { this.app = app; }

    validateSaleForSave() {
        if (!this.app.dom.getElement('store_id')?.value) {
            this.app.ui.showMessage('⚠️ يجب اختيار الفرع أولاً', 'error');
            this.app.dom.getElement('store_id').focus();
            return false;
        }
        
        if (this.app.state.lines.length === 0) {
            this.app.ui.showMessage('⚠️ يجب إضافة عناصر إلى الفاتورة', 'error');
            this.app.focusItemField();
            return false;
        }
        
        const discountAll = parseFloat(this.app.dom.getElement('discountAll')?.value || 0) || 0;
        const totals = this.app.calculateTotals();
        
        if (discountAll > totals.totalPrice) {
            this.app.ui.showMessage('⚠️ الخصم الإجمالي لا يمكن أن يزيد عن المجموع الكلي', 'error');
            this.app.dom.getElement('discountAll').focus();
            return false;
        }
        
        const paid = parseFloat(this.app.dom.getElement('paid_amount')?.value || 0) || 0;
        if (paid < 0) {
            this.app.ui.showMessage('⚠️ المبلغ المدفوع لا يمكن أن يكون سالباً', 'error');
            this.app.dom.getElement('paid_amount').focus();
            return false;
        }
        
        const finalTotal = totals.totalPrice - (this.app.state.lines.reduce((sum, row) => sum + row.discount, 0) + discountAll);
        if (finalTotal < 0) {
            this.app.ui.showMessage('⚠️ القيمة النهائية لا يمكن أن تكون سالبة', 'error');
            return false;
        }
        
        return true;
    }

    validateItemForAddition() {
        const master = this.app.state.currentMaster;
        if (!master) return { valid: false, error: 'لا يوجد صنف محدد' };

        const expiry = master.expiry_date ? new Date(master.expiry_date) : null;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        
        if (expiry && expiry < today) {
            this.app.ui.showMessage('🚫 الصنف منتهي الصلاحية', 'error');
            return { valid: false, error: 'الصنف منتهي الصلاحية' };
        }
        
        const qty = 1;
        const unit = this.app.dom.getElement('unit_type').value || master.unit_type || 'قطعة';
        const conversion = this.getConversionFactor(unit);
        const baseQty = qty * conversion;
        const stock = Number(master.item_qty || 0);
        
        if (baseQty > stock) {
            this.app.ui.showMessage('الكمية المطلوبة أكبر من الرصيد المتاح', 'error');
            return { valid: false, error: 'الكمية غير متوفرة' };
        }
        
        return { valid: true, qty, unit, conv: conversion, baseQty, discount: 0 };
    }

    getConversionFactor(unit) {
        return Number(this.app.state.currentMaster?.conversion_factor || this.app.state.currentMaster?.units_per_package || 1) || 1;
    }

    validateLineQuantity(index, newQty) {
        const qty = parseFloat(newQty) || 0;
        if (qty <= 0) {
            this.app.ui.showMessage('الكمية يجب أن تكون أكبر من الصفر', 'error');
            return false;
        }
        return !!this.app.state.lines[index];
    }
}

class InvoiceManager {
    constructor(app) { this.app = app; }

    buildPayload() {
        const discountAll = parseFloat(this.app.dom.getElement('discountAll')?.value || 0) || 0;
        const paidAmount = parseFloat(this.app.dom.getElement('paid_amount')?.value || 0) || 0;
        const totals = this.app.calculateTotals();
        const itemsDiscount = this.app.state.lines.reduce((sum, row) => sum + row.discount, 0);
        const finalTotal = totals.totalPrice - (itemsDiscount + discountAll);

        const payloadInvoice = {
            tran_date: this.app.dom.getElement('tran_date')?.value,
            store_id: this.app.dom.getElement('store_id')?.value,
            customer_id: this.app.dom.getElement('customer_id')?.value || null,
            invoice_id: this.app.dom.getElement('invoice_id')?.value,
            sale_type: this.app.dom.getElement('sale_type')?.value,
            price_type: this.app.dom.getElement('price_type')?.value,
            discount: discountAll,
            paid_amount: paidAmount,
            total_amount: finalTotal,
            remaining: Math.max(0, finalTotal - paidAmount),
            remarks: this.app.dom.getElement('remarks')?.value || ''
        };

        const payloadItems = this.app.state.lines.map(row => ({
            item_id: row.item_id, item_qty: row.qty, base_qty: row.base_qty || row.qty,
            sale_price: row.price, discount: row.discount, total_price: row.total,
            batch_no: row.batch_no, expiry_date: row.expiry_date, unit_type: row.unit,
            conv: row.conv, original_price: row.original_price || row.price, has_offer: row.has_offer || false
        }));

        return { payloadInvoice, payloadItems };
    }

    async loadNextInvoiceNumber() {
        const date = this.app.dom.getElement('tran_date').value;
        const store = this.app.dom.getElement('store_id').value;
        const user = document.getElementById('userInfo')?.dataset?.userid || localStorage.getItem("user_id") || sessionStorage.getItem("user_id") || null;

        if (!date || !store) return this.setDefaultInvoiceNumber();

        try {
            const userIdParam = user && !isNaN(parseInt(user)) ? user : '';
            
            // جلب رقم الفاتورة التالي من Supabase
            if (this.app.api.supabase) {
                const { data, error } = await this.app.api.supabase
                    .from('sales')
                    .select('invoice_id')
                    .eq('store_id', store)
                    .gte('tran_date', new Date(date).toISOString().split('T')[0])
                    .order('invoice_id', { ascending: false })
                    .limit(1);

                if (error) throw error;

                let nextInvoice = 1;
                if (data && data.length > 0 && data[0].invoice_id) {
                    nextInvoice = parseInt(data[0].invoice_id) + 1;
                }

                this.app.dom.getElement('invoice_id').value = nextInvoice.toString();
                localStorage.setItem('last_invoice_number', nextInvoice.toString());
                this.app.ui.showMessage(`📝 رقم الفاتورة: ${nextInvoice}`, 'toast', 2000);
            }
        } catch (err) {
            console.error("خطأ في تحميل رقم الفاتورة:", err);
            this.setDefaultInvoiceNumber();
        }
    }

    setDefaultInvoiceNumber() {
        if (this.app.dom.getElement('invoice_id')) {
            let lastInvoice = localStorage.getItem('last_invoice_number') || "1";
            this.app.dom.getElement('invoice_id').value = lastInvoice;
        }
    }

    incrementInvoiceNumber() {
        if (this.app.dom.getElement('invoice_id') && this.app.dom.getElement('invoice_id').value) {
            const currentNum = parseInt(this.app.dom.getElement('invoice_id').value) || 1;
            const newNum = currentNum + 1;
            this.app.dom.getElement('invoice_id').value = newNum.toString();
            localStorage.setItem('last_invoice_number', newNum.toString());
        }
    }

    async checkInvoiceExists(invoiceId) {
        try {
            if (!invoiceId) return { exists: false };
            const invoiceIdNum = parseInt(invoiceId);
            if (isNaN(invoiceIdNum)) return { exists: false };
            
            const date = this.app.dom.getElement('tran_date').value;
            const store = this.app.dom.getElement('store_id').value;
            if (!date || !store) return { exists: false };
            
            const { data, error } = await this.app.api.supabase
                .from('sales')
                .select('invoice_id')
                .eq('invoice_id', invoiceIdNum)
                .eq('store_id', store)
                .limit(1);
                
            if (error) {
                console.error('خطأ في التحقق من الفاتورة في Supabase:', error);
                return { exists: false };
            }
            return { exists: data && data.length > 0 };
            
        } catch (error) {
            console.error('خطأ في التحقق من الفاتورة:', error);
            return { exists: false };
        }
    }

    printThermal() {
        const shopName = document.getElementById('userInfo')?.textContent || 'المؤسسة';
        const date = new Date().toLocaleString('ar-EG');
        const invoice = this.app.dom.getElement('invoice_id')?.value || '-';
        const store = this.app.dom.getElement('store_id')?.options[this.app.dom.getElement('store_id').selectedIndex]?.text || '-';
        const user = document.getElementById('userInfo')?.textContent || '-';
        const paid = parseFloat(this.app.dom.getElement('paid_amount')?.value || 0) || 0;
        const discountAll = parseFloat(this.app.dom.getElement('discountAll')?.value || 0) || 0;
        const total = parseFloat(this.app.dom.getElement('sumTotal')?.textContent || 0) || 0;
        const change = Math.max(0, +(paid - total).toFixed(2));
        
        const itemsRows = this.app.state.lines.map(row => {
            const price = parseFloat(row.price) || 0;
            const qty = parseFloat(row.qty) || 0;
            const itemTotal = price * qty;
            const offerText = row.has_offer ? ' 🏷️عرض' : '';
            
            return `<tr>
                <td style="text-align:right">${row.item_nm || row.item_id}${offerText}</td>
                <td style="text-align:center">${qty}</td>
                <td style="text-align:center">${price.toFixed(2)}</td>
                <td style="text-align:center">${itemTotal.toFixed(2)}</td>
            </tr>`;
        }).join('');

        const hasOffersInInvoice = this.app.state.lines.some(row => row.has_offer);

        const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/><title>فاتورة ${invoice}</title>
            <style>@media print{body{margin:0!important;padding:0!important;width:58mm!important;font-family:'Cairo',Tahoma,sans-serif!important;}}
            body{font-family:'Cairo',Tahoma,sans-serif;font-size:12px;padding:3px;color:#000;margin:0;width:58mm;background:white;}
            .center{text-align:center;font-weight:bold;padding:2px 0;}table{width:100%;border-collapse:collapse;margin-top:4px;font-size:11px;}
            th,td{padding:2px;border-bottom:1px dashed #444;}hr{border:none;border-top:1px dashed #000;margin:4px 0;}
            .offer-note{background:#fff3e0;padding:3px;border-radius:3px;margin:3px 0;text-align:center;font-size:10px;border:1px dashed #ff9800;}
            </style></head><body>
            <div class="center" style="font-size:14px;">${shopName}</div>
            <div class="center" style="font-size:12px;">فاتورة بيع</div>
            ${hasOffersInInvoice?'<div class="offer-note">🏷️ تحتوي على عروض</div>':''}
            <div>التاريخ: ${date}</div><div>رقم الفاتورة: ${invoice}</div><div>الفرع: ${store}</div><div>المستخدم: ${user}</div><hr/>
            <table><thead><tr><th style="text-align:right">الصنف</th><th style="text-align:center">الكمية</th><th style="text-align:center">السعر</th><th style="text-align:center">الإجمالي</th></tr></thead>
            <tbody>${itemsRows}</tbody></table><hr/>
            <div>الخصم: ${discountAll.toFixed(2)}</div><div>الصافي: ${total.toFixed(2)}</div>
            <div>المدفوع: ${paid.toFixed(2)}</div><div>الباقي: ${change.toFixed(2)}</div><hr/>
            <div class="center" style="font-size:10px;">شكراً لزيارتكم</div>
            ${hasOffersInInvoice?'<div class="center" style="font-size:9px; color: #666;">🏷️ أسعار العروض مطبقة</div>':''}
            </body></html>`;

        this.printHTML(html);
    }

    printHTML(html) {
        try {
            let printWindow = window.open('', 'printWindow', 'width=350,height=600,scrollbars=no,toolbar=no,location=no,status=no');
            if (!printWindow) {
                this.app.ui.showMessage('⚠️ يرجى السماح بالنوافذ المنبثقة للطباعة', 'toast');
                return;
            }
            printWindow.document.write(html);
            printWindow.document.close();
            setTimeout(() => {
                printWindow.print();
                setTimeout(() => {
                    printWindow.close();
                    window.focus();
                }, 500);
            }, 300);
        } catch (error) {
            console.error('خطأ في الطباعة:', error);
            this.app.ui.showMessage('⚠️ حدث خطأ أثناء الطباعة', 'toast');
        }
    }
}

class InventoryManager {
    constructor(app) { 
        this.app = app; 
    }

    async loadStores() {
        try {
            let stores = [];
            if (this.app.api.supabase) {
                const { data, error } = await this.app.api.supabase.from('stores').select('*').order('store_name');
                if (error) throw error;
                stores = data || [];
            }
            this.populateStoreSelect(stores);
        } catch (err) {
            console.error('خطأ في تحميل المخازن:', err);
            this.setStoreFallback();
        }
    }

    populateStoreSelect(stores) {
        const storeName = localStorage.getItem("store_name") || sessionStorage.getItem("store_name");
        if (storeName && !["null", "undefined"].includes(storeName)) {
            const foundStore = stores.find(store => (store.store_name || store.name) === storeName);
            if (foundStore) {
                const storeId = foundStore.store_id || foundStore.id;
                this.setStoreSelect([{value: storeId, text: storeName}], true);
                return;
            }
        }
        const options = stores.map(s => ({value: s.store_id, text: s.store_name || s.name}));
        this.setStoreSelect(options, false);
    }

    setStoreSelect(options, isDisabled) {
        const storeSelect = this.app.dom.getElement('store_id');
        storeSelect.innerHTML = isDisabled ? '' : '<option value="">اختر الفرع</option>';
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.text = opt.text;
            if (isDisabled) option.selected = true;
            storeSelect.appendChild(option);
        });
        storeSelect.disabled = isDisabled;
    }

    setStoreFallback() {
        const storeName = localStorage.getItem("store_name") || sessionStorage.getItem("store_name");
        if (storeName && this.app.dom.getElement('store_id')) {
            this.setStoreSelect([{value: "1", text: storeName}], true);
        }
    }

    saveStoreSelection(storeId, storeName) {
        localStorage.setItem("store_id", storeId);
        sessionStorage.setItem("store_id", storeId);
        localStorage.setItem("store_name", storeName);
        sessionStorage.setItem("store_name", storeName);
    }

    async loadCustomers() {
        try {
            let data = [];
            if (this.app.api.supabase) {
                const { data: customers, error } = await this.app.api.supabase.from('customers').select('*').order('customer_name');
                if (error) throw error;
                data = customers || [];
            }
            this.populateCustomerSelect(data);
        } catch (err) { 
            console.error(err); 
            this.app.ui.showMessage('خطأ في تحميل العملاء','toast'); 
        }
    }

    populateCustomerSelect(customers) {
        const customerSelect = this.app.dom.getElement('customer_id');
        if (customerSelect) {
            customerSelect.innerHTML = '<option value="">-- نقدي --</option>' + 
                customers.map(c => `<option value="${c.customer_id}">${c.customer_name||c.name}</option>`).join('');
        }
    }

    async loadUnits() {
        try {
            // قائمة الوحدات الأساسية
            const unitsData = [
                { unit_type: 'قطعة', unit_name: 'قطعة' },
                { unit_type: 'علبة', unit_name: 'علبة' },
                { unit_type: 'كرتونة', unit_name: 'كرتونة' }
            ];
            
            this.app.state.units = unitsData;
            this.app.state.priceUnitMap = {'سعر1':'قطعة','سعر2':'علبة','سعر3':'كرتونة'};
            
            // ملء حقل نوع الوحدة
            this.populateUnitSelect();
            
            this.app.ui.showMessage('✅ تم تحميل الوحدات بنجاح', 'toast', 2000);
        } catch (err) { 
            console.error('خطأ في تحميل الوحدات:', err); 
            this.app.ui.showMessage('⚠️ خطأ في تحميل الوحدات','toast'); 
        }
    }

    populateUnitSelect() {
        const unitSelect = this.app.dom.getElement('unit_type');
        if (!unitSelect) {
            console.error('❌ حقل unit_type غير موجود');
            return;
        }
        
        if (this.app.state.units && this.app.state.units.length > 0) {
            // حفظ القيمة الحالية إذا كانت موجودة
            const currentValue = unitSelect.value;
            
            // مسح الخيارات الحالية
            unitSelect.innerHTML = '';
            
            // إضافة الخيارات الجديدة
            this.app.state.units.forEach(unit => {
                const option = document.createElement('option');
                option.value = unit.unit_type;
                option.textContent = unit.unit_name || unit.unit_type;
                unitSelect.appendChild(option);
            });
            
            // استعادة القيمة السابقة إذا كانت صالحة
            if (currentValue && this.app.state.units.some(u => u.unit_type === currentValue)) {
                unitSelect.value = currentValue;
            } else if (this.app.state.units.length > 0) {
                unitSelect.value = this.app.state.units[0].unit_type;
            }
            
            console.log('✅ تم تعبئة حقل الوحدات بنجاح:', this.app.state.units.length, 'وحدة');
        } else {
            console.warn('⚠️ لا توجد وحدات متاحة لتعبيتها');
            unitSelect.innerHTML = '<option value="قطعة">قطعة</option>';
        }
    }

    async loadMasterForItem(storeId, itemId) {
        try {
            console.log(`جاري تحميل بيانات الصنف ${itemId} من المخزن ${storeId}`);
            let res;

            if (this.app.api.supabase) {
                const { data, error } = await this.app.api.supabase
                    .from('a_master').select('*').eq('store_id', storeId).eq('item_id', itemId).maybeSingle();
                if (error) throw error;
                res = data;
                
                if (!res) {
                    console.warn(`لم يتم العثور على الصنف ${itemId} في جدول a_master`);
                    const { data: itemData, error: itemError } = await this.app.api.supabase
                        .from('items').select('*').eq('item_id', itemId).maybeSingle();
                    if (itemError) throw itemError;
                    if (itemData) {
                        res = {
                            item_id: itemData.item_id, item_nm: itemData.item_nm, item_qty: 0,
                            store_id: storeId, sale_price1: itemData.sale_price1 || 0,
                            sale_price2: itemData.sale_price2 || 0, sale_price3: itemData.sale_price3 || 0,
                            unit_type: 'قطعة'
                        };
                        console.log(`تم استخدام بيانات أساسية للصنف ${itemId}`);
                    }
                }
            }
            
            if (!res) {
                const errorMsg = `⚠️ الصنف ${itemId} غير موجود في الفرع المحدد`;
                this.app.ui.showMessage(errorMsg, 'warn');
                return false;
            }

            this.app.state.currentMaster = {
                item_id: res.item_id || itemId, store_id: res.store_id || storeId, 
                item_qty: res.item_qty ?? res.qty ?? 0, batch_no: res.batch_no || '', 
                expiry_date: res.expiry_date || res.exp_date || null, unit_type: res.unit_type || 'قطعة', 
                min_qty: res.min_qty ?? 0, sale_price1: res.sale_price1 ?? res.sale_price_1 ?? 0,
                sale_price2: res.sale_price2 ?? res.sale_price_2 ?? 0, sale_price3: res.sale_price3 ?? res.sale_price_3 ?? 0,
                buy_price: res.buy_price ?? 0, conversion_factor: res.conversion_factor ?? res.units_per_package ?? 1,
                item_nm: res.item_nm || this.app.state.currentItem?.item_nm || `صنف ${itemId}`,
                has_active_offer: res.has_active_offer || false, final_price1: res.final_price1 || res.sale_price1 || 0,
                final_price2: res.final_price2 || res.sale_price2 || 0, final_price3: res.final_price3 || res.sale_price3 || 0
            };

            console.log('بيانات المخزون المحملة:', this.app.state.currentMaster);
            return true;
        } catch (err) {
            console.error('خطأ في تحميل بيانات المخزون:', err);
            this.app.ui.showMessage(`❌ خطأ في جلب بيانات المخزون: ${err.message}`, 'error');
            return false;
        }
    }
}

// التهيئة العامة
window.editLine = (index) => window.salesApp?.editLine(index);
window.deleteLine = (index) => window.salesApp?.deleteLine(index);
window.printThermal = () => window.salesApp?.printThermal();
window.app = window.salesApp;

// دالة debug
window.debugSalesApp = function() {
    console.log('🔍 فحص تطبيق المبيعات:');
    console.log('1. حالة الاتصال:', window.salesApp?.state?.connection || 'غير محمل');
    console.log('2. عدد الأصناف:', window.salesApp?.state?.lines?.length || 0);
    console.log('3. المخزن المحدد:', window.salesApp?.dom?.getElement('store_id')?.value || 'غير محدد');
    console.log('4. رقم الفاتورة:', window.salesApp?.dom?.getElement('invoice_id')?.value || 'غير محدد');
    console.log('5. حالة Supabase:', window.salesApp?.api?.supabase ? 'موجود' : 'غير موجود');
    console.log('6. الوحدات المتاحة:', window.salesApp?.state?.units?.length || 0);
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 تهيئة تطبيق المبيعات (الإصدار النهائي)...');
    window.salesApp = new SalesApp();
    console.log('✅ تم تهيئة تطبيق المبيعات بنجاح');
});