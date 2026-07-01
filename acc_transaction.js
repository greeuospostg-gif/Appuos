// acc_transaction.js - حركة الحسابات (باستخدام النظام الموحد)

// ======================== 🎯 تعريف مدير حركة الحسابات ========================
class AccountTransactionsManager {
    constructor() {
        console.log('🚀 إنشاء مثيل لمدير حركة الحسابات...');
        
        // حالة التطبيق
        this.state = {
            transactions: [],
            accounts: [],
            subAccounts: [],
            accountTypes: [],
            currentEntryLines: [],
            currentAccountType: "",
            searchFilters: {
                start_date: "",
                end_date: "",
                account_id: "",
                entry_number: ""
            },
            isLoading: false,
            isSubmitting: false,
            allAccounts: [],
            currentFieldIndex: 0
        };
        
        // اتصال Supabase
        this.supabase = null;
        
        // عناصر DOM
        this.dom = null;
        
        // تهيئة المدير
        this.init();
    }

    // ======================== 🏗️ تهيئة المدير ========================
    async init() {
        try {
            console.log('🔧 بدء تهيئة مدير حركة الحسابات...');
            
            // التحقق من عناصر DOM
            if (!this.checkRequiredDOM()) {
                console.log('⏳ في انتظار تحميل DOM...');
                setTimeout(() => this.init(), 500);
                return;
            }
            
            // تهيئة Supabase باستخدام النظام المركزي
            await this.initSupabase();
            
            // إعداد الأحداث
            this.setupEventListeners();
            
            // تعيين التواريخ الافتراضية
            this.setDefaultDates();
            
            // تحميل البيانات
            await this.loadInitialData();
            
            console.log('✅ تم تهيئة مدير حركة الحسابات بنجاح');
            
        } catch (error) {
            console.error('❌ خطأ في تهيئة المدير:', error);
            this.showAlert('خطأ في تهيئة النظام، جاري إعادة المحاولة...', 'danger');
            setTimeout(() => this.init(), 2000);
        }
    }

    // ======================== 🌐 نظام الاتصال Supabase ========================

    // ✅ تهيئة Supabase باستخدام النظام المركزي
    async initSupabase() {
        console.log('🌐 محاولة تهيئة Supabase باستخدام النظام المركزي...');
        
        try {
            // الطريقة المفضلة: استخدام النظام المركزي
            if (window.supabaseManager) {
                this.supabase = await window.supabaseManager.getClient();
                
                if (this.supabase) {
                    console.log('✅ تم استخدام النظام المركزي لـ Supabase');
                    
                    // تحديث حالة الاتصال إذا كان المكون موجوداً
                    if (window.connectionStatus) {
                        window.connectionStatus.update(true);
                    }
                    
                    return true;
                }
            }
            
            // الطريقة الاحتياطية: اتصال مباشر
            console.warn('⚠️ النظام المركزي غير متاح، استخدام اتصال مباشر');
            
            if (window.supabase && window.supabase.createClient) {
                this.supabase = window.supabase.createClient(
                    'https://rvjacvrrpguehbapvewe.supabase.co',
                    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2amFjdnJycGd1ZWhiYXB2ZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMjUxNTksImV4cCI6MjA3ODYwMTE1OX0.wSavKzxKOF7-56G-pzDMtbXNrCNAbGs0wvadw-cilBg'
                );
                
                console.log('✅ تم إنشاء اتصال مباشر بـ Supabase');
                return true;
            }
            
            throw new Error('لا يمكن تهيئة Supabase');
            
        } catch (error) {
            console.error('❌ فشل في تهيئة Supabase:', error);
            
            if (window.connectionStatus) {
                window.connectionStatus.update(false);
            }
            
            this.showAlert('خطأ في الاتصال بقاعدة البيانات', 'danger');
            return false;
        }
    }

    // ✅ التحقق من اتصال Supabase قبل أي عملية
    async checkSupabaseConnection() {
        if (!this.supabase) {
            await this.initSupabase();
        }
        return !!this.supabase;
    }

    // ======================== 🏗️ إدارة DOM ========================

    // ✅ التحقق من عناصر DOM المطلوبة
    checkRequiredDOM() {
        const requiredElements = [
            'transactionDate',
            'entryNumber',
            'accountType',
            'accountId'
        ];
        
        for (const elementId of requiredElements) {
            if (!document.getElementById(elementId)) {
                console.log(`⏳ في انتظار العنصر: ${elementId}`);
                return false;
            }
        }
        
        this.dom = this.initDOM();
        return true;
    }

    // ✅ تهيئة عناصر DOM
    initDOM() {
        console.log('🔍 تهيئة عناصر DOM...');
        
        const domElements = {
            // عناصر النموذج
            transactionForm: document.getElementById("transactionForm"),
            transactionDate: document.getElementById("transactionDate"),
            entryNumber: document.getElementById("entryNumber"),
            accountType: document.getElementById("accountType"),
            accountId: document.getElementById("accountId"),
            debitAmount: document.getElementById("debitAmount"),
            creditAmount: document.getElementById("creditAmount"),
            lineDescription: document.getElementById("lineDescription"),
            
            // عناصر البحث
            searchStartDate: document.getElementById("searchStartDate"),
            searchEndDate: document.getElementById("searchEndDate"),
            searchAccountId: document.getElementById("searchAccountId"),
            searchEntryNumber: document.getElementById("searchEntryNumber"),
            
            // عناصر العرض
            tableBody: document.getElementById("tableBody"),
            currentEntryTable: document.getElementById("currentEntryTable"),
            loading: document.getElementById("loading"),
            totalDebit: document.getElementById("totalDebit"),
            totalCredit: document.getElementById("totalCredit"),
            balanceStatus: document.getElementById("balanceStatus"),
            
            // أزرار
            addLineBtn: document.getElementById("addLineBtn"),
            saveEntryBtn: document.getElementById("saveEntryBtn"),
            newEntryBtn: document.getElementById("newEntryBtn"),
            searchBtn: document.getElementById("searchBtn"),
            resetSearchBtn: document.getElementById("resetSearchBtn"),
            printBtn: document.getElementById("printBtn"),
            
            // حالة الاتصال
            connectionStatus: document.getElementById("connectionStatus")
        };
        
        // تسجيل العناصر التي تم العثور عليها
        const foundElements = Object.keys(domElements).filter(key => domElements[key]);
        console.log(`✅ تم العثور على ${foundElements.length} عنصر DOM`);
        
        return domElements;
    }

    // ======================== 🎯 إعداد الأحداث ========================

    // ✅ إعداد مستمعي الأحداث
    setupEventListeners() {
        try {
            console.log('🎯 إعداد مستمعي الأحداث...');
            
            // أزرار النموذج الرئيسي
            if (this.dom.addLineBtn) {
                this.dom.addLineBtn.addEventListener('click', () => this.addLine());
            }
            
            if (this.dom.saveEntryBtn) {
                this.dom.saveEntryBtn.addEventListener('click', () => this.saveEntry());
            }
            
            if (this.dom.newEntryBtn) {
                this.dom.newEntryBtn.addEventListener('click', () => this.newEntry());
            }
            
            // أزرار البحث
            if (this.dom.searchBtn) {
                this.dom.searchBtn.addEventListener('click', () => this.searchTransactions());
            }
            
            if (this.dom.resetSearchBtn) {
                this.dom.resetSearchBtn.addEventListener('click', () => this.resetSearch());
            }
            
            if (this.dom.printBtn) {
                this.dom.printBtn.addEventListener('click', () => this.printTransactions());
            }
            
            // تغيير نوع الحساب
            if (this.dom.accountType) {
                this.dom.accountType.addEventListener('change', (e) => this.onAccountTypeChange(e.target.value));
            }
            
            // تفعيل/تعطيل الحقول المتعارضة
            if (this.dom.debitAmount) {
                this.dom.debitAmount.addEventListener('input', (e) => {
                    this.updateSaveButtonState();
                    this.toggleCreditField(e.target.value);
                });
            }
            
            if (this.dom.creditAmount) {
                this.dom.creditAmount.addEventListener('input', (e) => {
                    this.updateSaveButtonState();
                    this.toggleDebitField(e.target.value);
                });
            }
            
            // إعداد التنقل بـ Enter
            this.setupEnterNavigation();
            
            // البحث عند تغيير التواريخ
            if (this.dom.searchStartDate) {
                this.dom.searchStartDate.addEventListener('change', () => this.searchTransactions());
            }
            
            if (this.dom.searchEndDate) {
                this.dom.searchEndDate.addEventListener('change', () => this.searchTransactions());
            }
            
            console.log('✅ اكتمل إعداد مستمعي الأحداث');
            
        } catch (error) {
            console.error('❌ خطأ في إعداد مستمعي الأحداث:', error);
        }
    }

    // ✅ إعداد التنقل بـ Enter
    setupEnterNavigation() {
        const fields = [
            this.dom.transactionDate,
            this.dom.entryNumber,
            this.dom.accountType,
            this.dom.accountId,
            this.dom.debitAmount,
            this.dom.creditAmount,
            this.dom.lineDescription
        ];

        fields.forEach((field, index) => {
            if (field) {
                field.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        
                        if (field === this.dom.lineDescription) {
                            this.addLine();
                        } else {
                            const nextIndex = index + 1;
                            if (nextIndex < fields.length && fields[nextIndex]) {
                                fields[nextIndex].focus();
                            }
                        }
                    }
                });
            }
        });

        // تفعيل Enter على زر الحفظ
        if (this.dom.saveEntryBtn) {
            this.dom.saveEntryBtn.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.saveEntry();
                }
            });
        }

        // تفعيل Enter في حقول البحث
        const searchFields = [
            this.dom.searchStartDate,
            this.dom.searchEndDate,
            this.dom.searchAccountId,
            this.dom.searchEntryNumber
        ];

        searchFields.forEach(field => {
            if (field) {
                field.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.searchTransactions();
                    }
                });
            }
        });
    }

    // ======================== 📥 دوال تحميل البيانات ========================

    // ✅ تحميل البيانات الأولية
    async loadInitialData() {
        try {
            await this.loadAccountTypes();
            await this.loadAllAccounts();
            await this.loadActiveAccounts();
            await this.loadLastEntryNumber();
            await this.loadTransactions();
            
            console.log('✅ تم تحميل جميع البيانات الأولية');
            
        } catch (error) {
            console.error('❌ خطأ في تحميل البيانات الأولية:', error);
            this.showAlert('خطأ في تحميل البيانات', 'danger');
        }
    }

    // ✅ تحميل أنواع الحسابات
    async loadAccountTypes() {
        console.log('📊 جاري تحميل أنواع الحسابات...');

        try {
            const connected = await this.checkSupabaseConnection();
            if (!connected) return;

            const { data, error } = await this.supabase
                .from('account_types')
                .select('*')
                .order('account_type_name');

            if (error) throw error;

            this.state.accountTypes = data || [];
            this.renderAccountTypesDropdown();
            
            console.log(`✅ تم تحميل ${this.state.accountTypes.length} نوع حساب`);
            
        } catch (error) {
            console.error('❌ خطأ في تحميل أنواع الحسابات:', error);
            this.showAlert('خطأ في تحميل أنواع الحسابات', 'danger');
        }
    }

    // ✅ تحميل جميع الحسابات
    async loadAllAccounts() {
        console.log('📊 جاري تحميل جميع الحسابات...');

        try {
            const connected = await this.checkSupabaseConnection();
            if (!connected) return;

            const { data, error } = await this.supabase
                .from('accounts')
                .select('*, account_types(account_type_name)')
                .order('account_code');

            if (error) throw error;

            this.state.allAccounts = (data || []).map(account => ({
                ...account,
                account_type_name: account.account_types?.account_type_name || ''
            }));
            
            console.log(`✅ تم تحميل ${this.state.allAccounts.length} حساب`);
            
        } catch (error) {
            console.error('❌ خطأ في تحميل الحسابات:', error);
            this.showAlert('خطأ في تحميل الحسابات', 'danger');
        }
    }

    // ✅ تحميل الحسابات النشطة للبحث
    async loadActiveAccounts() {
        console.log('📊 جاري تحميل الحسابات النشطة...');

        try {
            const connected = await this.checkSupabaseConnection();
            if (!connected) return;

            const { data, error } = await this.supabase
                .from('accounts')
                .select('*, account_types(account_type_name)')
                .eq('is_active', true)
                .order('account_code');

            if (error) throw error;

            this.state.accounts = (data || []).map(account => ({
                ...account,
                account_type_name: account.account_types?.account_type_name || ''
            }));
            
            this.renderSearchAccountsDropdown();
            
            console.log(`✅ تم تحميل ${this.state.accounts.length} حساب نشط`);
            
        } catch (error) {
            console.error('❌ خطأ في تحميل الحسابات النشطة:', error);
            this.showAlert('خطأ في تحميل الحسابات', 'danger');
        }
    }

    // ✅ تحميل الحسابات الفرعية حسب النوع
    async loadSubAccountsByType(accountTypeName) {
        console.log(`📊 جاري تحميل الحسابات الفرعية لنوع: ${accountTypeName}`);

        try {
            const connected = await this.checkSupabaseConnection();
            if (!connected) return;

            // البحث عن نوع الحساب بالاسم
            const { data: accountType, error: typeError } = await this.supabase
                .from('account_types')
                .select('account_type_id')
                .eq('account_type_name', accountTypeName)
                .single();

            if (typeError) throw typeError;

            if (!accountType) {
                this.state.subAccounts = [];
                this.renderSubAccountsDropdown();
                return;
            }

            // تحميل الحسابات المرتبطة بهذا النوع
            const { data: accounts, error: accountsError } = await this.supabase
                .from('accounts')
                .select('*, account_types(account_type_name)')
                .eq('account_type_id', accountType.account_type_id)
                .eq('is_active', true)
                .order('account_code');

            if (accountsError) throw accountsError;

            this.state.subAccounts = (accounts || []).map(account => ({
                ...account,
                account_type_name: account.account_types?.account_type_name || ''
            }));
            
            this.renderSubAccountsDropdown();
            
            console.log(`✅ تم تحميل ${this.state.subAccounts.length} حساب فرعي`);
            
        } catch (error) {
            console.error('❌ خطأ في تحميل الحسابات الفرعية:', error);
            this.state.subAccounts = [];
            this.renderSubAccountsDropdown();
            this.showAlert('خطأ في تحميل الحسابات الفرعية', 'danger');
        }
    }

    // ✅ تحميل آخر رقم قيد
    async loadLastEntryNumber() {
        console.log('🔢 جاري تحميل آخر رقم قيد...');

        try {
            const connected = await this.checkSupabaseConnection();
            if (!connected) return;

            const { data, error } = await this.supabase
                .from('account_transactions')
                .select('entry_number')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (data) {
                const lastNumber = data.entry_number;
                const match = lastNumber.match(/(\d+)$/);
                if (match) {
                    const nextNumber = parseInt(match[1]) + 1;
                    this.dom.entryNumber.value = `JRNL-${nextNumber.toString().padStart(4, '0')}`;
                } else {
                    this.dom.entryNumber.value = "";
                }
            } else {
                this.dom.entryNumber.value = "";
            }
            
            console.log(`✅ تم تعيين رقم القيد: ${this.dom.entryNumber.value}`);
            
        } catch (error) {
            console.error('❌ خطأ في تحميل آخر رقم قيد:', error);
            this.dom.entryNumber.value = "";
        }
    }

    // ✅ تحميل الحركات
    async loadTransactions() {
        this.setLoading(true);
        console.log('📋 جاري تحميل الحركات...');

        try {
            const connected = await this.checkSupabaseConnection();
            if (!connected) return;

            let query = this.supabase
                .from('account_transactions')
                .select(`
                    *,
                    accounts!inner(
                        account_id,
                        account_code, 
                        account_name, 
                        account_types!inner(account_type_name)
                    )
                `)
                .order('transaction_date', { ascending: false })
                .order('created_at', { ascending: false });

            // تطبيق عوامل التصفية
            if (this.state.searchFilters.start_date) {
                query = query.gte('transaction_date', this.state.searchFilters.start_date);
            }
            if (this.state.searchFilters.end_date) {
                query = query.lte('transaction_date', this.state.searchFilters.end_date);
            }
            if (this.state.searchFilters.account_id) {
                query = query.eq('account_id', this.state.searchFilters.account_id);
            }
            if (this.state.searchFilters.entry_number) {
                query = query.ilike('entry_number', `%${this.state.searchFilters.entry_number}%`);
            }

            const { data, error } = await query;

            if (error) throw error;

            // معالجة البيانات
            this.state.transactions = (data || []).map(transaction => ({
                ...transaction,
                accounts: {
                    ...transaction.accounts,
                    account_type_name: transaction.accounts?.account_types?.account_type_name || ''
                }
            }));
            
            this.renderTransactionsTable();
            
            console.log(`✅ تم تحميل ${this.state.transactions.length} حركة`);
            
        } catch (error) {
            console.error('❌ خطأ في تحميل الحركات:', error);
            this.showAlert('خطأ في تحميل الحركات', 'danger');
            this.state.transactions = [];
        } finally {
            this.setLoading(false);
        }
    }

    // ======================== 🎨 دوال العرض ========================

    // 🎨 عرض أنواع الحسابات
    renderAccountTypesDropdown() {
        if (!this.dom.accountType) return;

        if (this.state.accountTypes.length === 0) {
            this.dom.accountType.innerHTML = '<option value="">لا توجد أنواع حسابات</option>';
            return;
        }

        const options = this.state.accountTypes.map(type => `
            <option value="${this.escapeHtml(type.account_type_name)}">
                ${this.escapeHtml(type.account_type_name)}
            </option>
        `).join('');
        
        this.dom.accountType.innerHTML = `
            <option value="">اختر نوع الحساب</option>
            ${options}
        `;
    }

    // 🎨 عرض الحسابات الفرعية
    renderSubAccountsDropdown() {
        if (!this.dom.accountId) return;

        if (this.state.subAccounts.length === 0) {
            this.dom.accountId.innerHTML = '<option value="">اختر نوع الحساب أولاً</option>';
            return;
        }

        const options = this.state.subAccounts.map(account => `
            <option value="${account.account_id}">
                ${this.escapeHtml(account.account_code)} - ${this.escapeHtml(account.account_name)}
            </option>
        `).join('');
        
        this.dom.accountId.innerHTML = `
            <option value="">اختر الحساب الفرعي</option>
            ${options}
        `;
    }

    // 🎨 عرض الحسابات في البحث
    renderSearchAccountsDropdown() {
        if (!this.dom.searchAccountId) return;

        if (this.state.accounts.length === 0) {
            this.dom.searchAccountId.innerHTML = '<option value="">لا توجد حسابات</option>';
            return;
        }

        const options = this.state.accounts.map(account => `
            <option value="${account.account_id}">
                ${this.escapeHtml(account.account_code)} - ${this.escapeHtml(account.account_name)}
            </option>
        `).join('');
        
        this.dom.searchAccountId.innerHTML = `
            <option value="">جميع الحسابات</option>
            ${options}
        `;
    }

    // 🎨 عرض الحركات في الجدول
    renderTransactionsTable() {
        if (!this.dom.tableBody) return;

        const { transactions } = this.state;
        
        if (transactions.length === 0) {
            this.dom.tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted">
                        <i class="fas fa-inbox me-2"></i>لا توجد حركات
                    </td>
                </tr>
            `;
            return;
        }

        let tableHTML = '';
        let currentEntry = '';
        
        transactions.forEach((transaction, index) => {
            if (transaction.entry_number !== currentEntry) {
                currentEntry = transaction.entry_number;
                tableHTML += `
                    <tr class="table-primary">
                        <td colspan="8" class="fw-bold">
                            <i class="fas fa-file-invoice me-2"></i>رقم القيد: ${this.escapeHtml(transaction.entry_number)}
                            <small class="text-muted ms-2">
                                ${new Date(transaction.transaction_date).toLocaleDateString('ar-EG')}
                            </small>
                            <button class="btn btn-sm btn-outline-danger float-start me-2" onclick="window.accountTransactionsManager.deleteEntry('${transaction.entry_number}')">
                                <i class="fas fa-trash me-1"></i>حذف
                            </button>
                        </td>
                    </tr>
                `;
            }
            
            tableHTML += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${new Date(transaction.transaction_date).toLocaleDateString('ar-EG')}</td>
                    <td>${this.escapeHtml(transaction.accounts.account_code)} - ${this.escapeHtml(transaction.accounts.account_name)}</td>
                    <td>${this.escapeHtml(transaction.accounts.account_type_name || '')}</td>
                    <td class="text-success fw-bold">${transaction.debit_amount > 0 ? parseFloat(transaction.debit_amount).toLocaleString() : ''}</td>
                    <td class="text-danger fw-bold">${transaction.credit_amount > 0 ? parseFloat(transaction.credit_amount).toLocaleString() : ''}</td>
                    <td>${this.escapeHtml(transaction.line_description || '')}</td>
                    <td>${transaction.username || 'System'}</td>
                </tr>
            `;
        });

        this.dom.tableBody.innerHTML = tableHTML;
    }

    // 🎨 عرض بنود القيد الحالي
    renderCurrentEntryTable() {
        if (!this.dom.currentEntryTable || !this.dom.totalDebit || !this.dom.totalCredit || !this.dom.balanceStatus || !this.dom.saveEntryBtn) {
            return;
        }
        
        const { currentEntryLines } = this.state;
        
        if (currentEntryLines.length === 0) {
            this.dom.currentEntryTable.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted">لا توجد بنود مضافة</td>
                </tr>
            `;
            this.dom.totalDebit.textContent = '0';
            this.dom.totalCredit.textContent = '0';
            this.dom.balanceStatus.className = 'badge bg-secondary';
            this.dom.balanceStatus.textContent = 'غير متوازن';
            this.dom.saveEntryBtn.disabled = true;
            return;
        }

        const totalDebit = currentEntryLines.reduce((sum, line) => sum + parseFloat(line.debit_amount || 0), 0);
        const totalCredit = currentEntryLines.reduce((sum, line) => sum + parseFloat(line.credit_amount || 0), 0);
        const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

        this.dom.currentEntryTable.innerHTML = currentEntryLines.map((line, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${this.escapeHtml(line.account_name)}</td>
                <td class="text-success fw-bold">${line.debit_amount > 0 ? parseFloat(line.debit_amount).toLocaleString() : ''}</td>
                <td class="text-danger fw-bold">${line.credit_amount > 0 ? parseFloat(line.credit_amount).toLocaleString() : ''}</td>
                <td>${this.escapeHtml(line.line_description)}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="window.accountTransactionsManager.removeLine(${index})">
                        <i class="fas fa-times"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        this.dom.totalDebit.textContent = totalDebit.toLocaleString();
        this.dom.totalCredit.textContent = totalCredit.toLocaleString();
        
        if (isBalanced && currentEntryLines.length >= 2) {
            this.dom.balanceStatus.className = 'badge bg-success';
            this.dom.balanceStatus.textContent = 'متوازن';
            this.dom.saveEntryBtn.disabled = false;
        } else {
            this.dom.balanceStatus.className = 'badge bg-danger';
            this.dom.balanceStatus.textContent = 'غير متوازن';
            this.dom.saveEntryBtn.disabled = true;
        }
    }

    // ======================== ⚙️ دوال الوظائف الرئيسية ========================

    // ➕ إضافة بند للقيد الحالي
    addLine() {
        try {
            const accountId = this.dom.accountId?.value;
            const accountName = this.dom.accountId?.options[this.dom.accountId.selectedIndex]?.text;
            
            if (!accountId || (!this.dom.debitAmount?.value && !this.dom.creditAmount?.value)) {
                this.showAlert('يرجى اختيار الحساب وإدخال قيمة في المدين أو الدائن', 'warning');
                return;
            }

            const newLine = {
                account_id: parseInt(accountId),
                account_name: accountName || '',
                debit_amount: parseFloat(this.dom.debitAmount.value) || 0,
                credit_amount: parseFloat(this.dom.creditAmount.value) || 0,
                line_description: (this.dom.lineDescription?.value || '').trim() || 'قيد محاسبي'
            };

            this.state.currentEntryLines.push(newLine);
            this.renderCurrentEntryTable();
            
            // إعادة تعيين الحقول المتعارضة
            this.resetAmountFields();
            
            // مسح حقول البند
            this.clearLineFields();
            
            // العودة لحقل نوع الحساب
            if (this.dom.accountType) this.dom.accountType.focus();
            
        } catch (error) {
            console.error('❌ خطأ في إضافة البند:', error);
            this.showAlert('خطأ في إضافة البند', 'danger');
        }
    }

    // 🗑️ حذف بند من القيد الحالي
    removeLine(index) {
        try {
            if (index >= 0 && index < this.state.currentEntryLines.length) {
                this.state.currentEntryLines.splice(index, 1);
                this.renderCurrentEntryTable();
            }
        } catch (error) {
            console.error('❌ خطأ في حذف البند:', error);
        }
    }

    // 🔄 تغيير نوع الحساب
    async onAccountTypeChange(value) {
        try {
            this.state.currentAccountType = value;
            
            if (value) {
                await this.loadSubAccountsByType(value);
                if (this.dom.accountId) this.dom.accountId.focus();
            } else {
                this.state.subAccounts = [];
                this.renderSubAccountsDropdown();
            }
        } catch (error) {
            console.error('❌ خطأ في تغيير نوع الحساب:', error);
        }
    }

    // 💾 حفظ القيد المحاسبي
    async saveEntry() {
        try {
            if (this.state.currentEntryLines.length < 2) {
                this.showAlert('يجب إضافة بندين على الأقل للقيد المحاسبي', 'warning');
                return;
            }

            const totalDebit = this.state.currentEntryLines.reduce((sum, line) => sum + parseFloat(line.debit_amount || 0), 0);
            const totalCredit = this.state.currentEntryLines.reduce((sum, line) => sum + parseFloat(line.credit_amount || 0), 0);
            
            if (Math.abs(totalDebit - totalCredit) > 0.01) {
                this.showAlert(`القيد غير متوازن. المدين: ${totalDebit}, الدائن: ${totalCredit}`, 'warning');
                return;
            }

            if (!this.dom.entryNumber?.value?.trim()) {
                this.showAlert('يرجى إدخال رقم القيد', 'warning');
                if (this.dom.entryNumber) this.dom.entryNumber.focus();
                return;
            }

            if (!this.dom.transactionDate?.value) {
                this.showAlert('يرجى إدخال تاريخ القيد', 'warning');
                if (this.dom.transactionDate) this.dom.transactionDate.focus();
                return;
            }

            // التحقق من اتصال Supabase
            const connected = await this.checkSupabaseConnection();
            if (!connected) return;

            // تحديث واجهة المستخدم
            if (this.dom.saveEntryBtn) {
                this.dom.saveEntryBtn.disabled = true;
                this.dom.saveEntryBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>جاري الحفظ...';
            }

            // حفظ كل حركة على حدة
            const transactions = this.state.currentEntryLines.map(line => ({
                transaction_date: this.dom.transactionDate.value,
                account_id: line.account_id,
                debit_amount: line.debit_amount,
                credit_amount: line.credit_amount,
                entry_number: this.dom.entryNumber.value.trim(),
                line_description: line.line_description,
                user_id: 1
            }));

            const { error } = await this.supabase
                .from('account_transactions')
                .insert(transactions);

            if (error) throw error;

            this.showAlert('✅ تم حفظ القيد بنجاح في Supabase', 'success');

            this.newEntry();
            await this.loadTransactions();

        } catch (error) {
            console.error('❌ خطأ في حفظ القيد:', error);
            this.showAlert(`❌ خطأ في حفظ القيد: ${error.message}`, 'danger');
        } finally {
            if (this.dom.saveEntryBtn) {
                this.dom.saveEntryBtn.disabled = false;
                this.dom.saveEntryBtn.innerHTML = '<i class="fas fa-save me-2"></i>حفظ القيد';
            }
        }
    }

    // 🆕 قيد جديد
    newEntry() {
        try {
            this.state.currentEntryLines = [];
            this.state.subAccounts = [];
            this.renderCurrentEntryTable();
            this.clearLineFields();
            this.resetAmountFields();
            this.renderSubAccountsDropdown();
            this.loadLastEntryNumber();
            if (this.dom.transactionDate) this.dom.transactionDate.focus();
            
        } catch (error) {
            console.error('❌ خطأ في إنشاء قيد جديد:', error);
        }
    }

    // 🔍 البحث في الحركات
    async searchTransactions() {
        try {
            this.state.searchFilters = {
                start_date: this.dom.searchStartDate?.value || '',
                end_date: this.dom.searchEndDate?.value || '',
                account_id: this.dom.searchAccountId?.value || '',
                entry_number: this.dom.searchEntryNumber?.value || ''
            };
            
            await this.loadTransactions();
        } catch (error) {
            console.error('❌ خطأ في البحث:', error);
        }
    }

    // 🔄 إعادة تعيين البحث
    resetSearch() {
        try {
            this.setDefaultDates();
            if (this.dom.searchAccountId) this.dom.searchAccountId.value = '';
            if (this.dom.searchEntryNumber) this.dom.searchEntryNumber.value = '';
            this.searchTransactions();
        } catch (error) {
            console.error('❌ خطأ في إعادة تعيين البحث:', error);
        }
    }

    // 🗑️ حذف قيد محاسبي
    async deleteEntry(entryNumber) {
        try {
            if (!confirm(`هل أنت متأكد من حذف القيد ${entryNumber}؟`)) return;

            const connected = await this.checkSupabaseConnection();
            if (!connected) return;

            const { error } = await this.supabase
                .from('account_transactions')
                .delete()
                .eq('entry_number', entryNumber);

            if (error) throw error;

            this.showAlert('✅ تم حذف القيد المحاسبي بنجاح', 'success');
            await this.loadTransactions();

        } catch (error) {
            console.error('❌ خطأ في حذف القيد:', error);
            this.showAlert(`❌ خطأ في حذف القيد: ${error.message}`, 'danger');
        }
    }

    // 🖨️ طباعة الحركات
    printTransactions() {
        try {
            const { transactions } = this.state;
            
            if (transactions.length === 0) {
                this.showAlert('لا توجد حركات للطباعة', 'warning');
                return;
            }

            if (!this.dom.tableBody) {
                this.showAlert('لا يمكن الطباعة، البيانات غير متوفرة', 'warning');
                return;
            }

            const printWindow = window.open('', '_blank');
            const printDate = new Date().toLocaleDateString('ar-EG');
            
            printWindow.document.write(`
                <!DOCTYPE html>
                <html dir="rtl" lang="ar">
                <head>
                    <meta charset="UTF-8">
                    <title>كشف الحركات المالية</title>
                    <style>
                        @media print {
                            @page { size: A4; margin: 1cm; }
                            body { font-family: 'Arial', sans-serif; margin: 0; padding: 20px; color: #000; }
                            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px; }
                            .company-name { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
                            .report-title { font-size: 18px; margin-bottom: 10px; }
                            .print-date { font-size: 14px; color: #666; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                            th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                            th { background-color: #f0f0f0; font-weight: bold; }
                            .text-success { color: #008000; }
                            .text-danger { color: #ff0000; }
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="company-name">شركة المحاسبة</div>
                        <div class="report-title">كشف الحركات المالية</div>
                        <div class="print-date">تاريخ الطباعة: ${printDate}</div>
                    </div>
                    ${this.dom.tableBody.innerHTML}
                </body>
                </html>
            `);

            printWindow.document.close();
            setTimeout(() => {
                printWindow.print();
            }, 500);
            
        } catch (error) {
            console.error('❌ خطأ في الطباعة:', error);
            this.showAlert('خطأ في الطباعة', 'danger');
        }
    }

    // ======================== 🛠️ دوال مساعدة ========================

    // 📅 تعيين التواريخ الافتراضية
    setDefaultDates() {
        try {
            const today = new Date();
            const todayFormatted = today.toISOString().split('T')[0];
            
            if (this.dom.transactionDate) {
                this.dom.transactionDate.value = todayFormatted;
            }
            
            const firstDay = new Date();
            firstDay.setDate(1);
            const firstDayFormatted = firstDay.toISOString().split('T')[0];
            
            if (this.dom.searchStartDate) {
                this.dom.searchStartDate.value = firstDayFormatted;
            }
            
            if (this.dom.searchEndDate) {
                this.dom.searchEndDate.value = todayFormatted;
            }
            
            this.state.searchFilters.start_date = this.dom.searchStartDate?.value || '';
            this.state.searchFilters.end_date = this.dom.searchEndDate?.value || '';
            
        } catch (error) {
            console.error('❌ خطأ في تعيين التواريخ:', error);
        }
    }

    // 🧹 مسح حقول البند
    clearLineFields() {
        try {
            if (this.dom.accountType) this.dom.accountType.value = '';
            if (this.dom.accountId) this.dom.accountId.innerHTML = '<option value="">اختر الحساب الفرعي</option>';
            if (this.dom.lineDescription) this.dom.lineDescription.value = '';
        } catch (error) {
            console.error('❌ خطأ في مسح حقول البند:', error);
        }
    }

    // 🔄 إعادة تعيين الحقول المتعارضة
    resetAmountFields() {
        if (this.dom.debitAmount) {
            this.dom.debitAmount.disabled = false;
            this.dom.debitAmount.value = '';
            this.dom.debitAmount.placeholder = 'أدخل المبلغ';
            this.dom.debitAmount.classList.remove('disabled-field');
        }
        
        if (this.dom.creditAmount) {
            this.dom.creditAmount.disabled = false;
            this.dom.creditAmount.value = '';
            this.dom.creditAmount.placeholder = 'أدخل المبلغ';
            this.dom.creditAmount.classList.remove('disabled-field');
        }
    }

    // 👇 تعطيل حقل الدائن عند إدخال قيمة في المدين
    toggleCreditField(debitValue) {
        if (this.dom.creditAmount) {
            if (debitValue && parseFloat(debitValue) > 0) {
                this.dom.creditAmount.disabled = true;
                this.dom.creditAmount.value = '';
                this.dom.creditAmount.placeholder = 'غير مسموح (يوجد مدين)';
                this.dom.creditAmount.classList.add('disabled-field');
            } else {
                this.dom.creditAmount.disabled = false;
                this.dom.creditAmount.placeholder = 'أدخل المبلغ';
                this.dom.creditAmount.classList.remove('disabled-field');
            }
        }
    }

    // 👇 تعطيل حقل المدين عند إدخال قيمة في الدائن
    toggleDebitField(creditValue) {
        if (this.dom.debitAmount) {
            if (creditValue && parseFloat(creditValue) > 0) {
                this.dom.debitAmount.disabled = true;
                this.dom.debitAmount.value = '';
                this.dom.debitAmount.placeholder = 'غير مسموح (يوجد دائن)';
                this.dom.debitAmount.classList.add('disabled-field');
            } else {
                this.dom.debitAmount.disabled = false;
                this.dom.debitAmount.placeholder = 'أدخل المبلغ';
                this.dom.debitAmount.classList.remove('disabled-field');
            }
        }
    }

    // 🔄 تحديث حالة زر الحفظ
    updateSaveButtonState() {
        if (!this.dom.saveEntryBtn) return;
        
        const totalDebit = this.state.currentEntryLines.reduce((sum, line) => sum + parseFloat(line.debit_amount || 0), 0);
        const totalCredit = this.state.currentEntryLines.reduce((sum, line) => sum + parseFloat(line.credit_amount || 0), 0);
        const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
        
        this.dom.saveEntryBtn.disabled = !(isBalanced && this.state.currentEntryLines.length >= 2);
    }

    // ⏳ تعيين حالة التحميل
    setLoading(loading) {
        this.state.isLoading = loading;
        if (this.dom.loading) {
            this.dom.loading.style.display = loading ? 'block' : 'none';
        }
    }

    // 💬 عرض التنبيهات
    showAlert(message, type) {
        try {
            const oldAlerts = document.querySelectorAll('.alert');
            oldAlerts.forEach(alert => alert.remove());

            const alertDiv = document.createElement('div');
            alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
            alertDiv.innerHTML = `
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
            
            const container = document.querySelector('.container');
            if (container) {
                container.insertBefore(alertDiv, container.firstChild);
                
                setTimeout(() => {
                    if (alertDiv.parentElement) {
                        alertDiv.remove();
                    }
                }, 5000);
            }
        } catch (error) {
            console.error('❌ خطأ في عرض التنبيه:', error);
        }
    }

    // 🛡️ حماية من XSS
    escapeHtml(unsafe) {
        if (!unsafe) return '';
        try {
            return unsafe
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        } catch (error) {
            return String(unsafe);
        }
    }
}

// ======================== 🚀 تشغيل التطبيق ========================

// تشغيل التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 الصفحة محملة بالكامل، بدء تهيئة مدير حركة الحسابات...');
    
    // تأخير بسيط لضمان تحميل جميع المكتبات
    setTimeout(() => {
        try {
            // إنشاء وتشغيل المدير
            window.accountTransactionsManager = new AccountTransactionsManager();
            console.log('🎉 تم إنشاء مدير حركة الحسابات');
            
        } catch (error) {
            console.error('❌ فشل في إنشاء مدير حركة الحسابات:', error);
        }
    }, 1000);
});

// إضافة CSS للحقول المعطلة
if (!document.querySelector('#acc-transaction-styles')) {
    const style = document.createElement('style');
    style.id = 'acc-transaction-styles';
    style.textContent = `
        .disabled-field {
            background-color: #f8f9fa !important;
            cursor: not-allowed !important;
            opacity: 0.6 !important;
        }
        
        .disabled-field::placeholder {
            color: #6c757d !important;
            font-style: italic !important;
        }
    `;
    document.head.appendChild(style);
}