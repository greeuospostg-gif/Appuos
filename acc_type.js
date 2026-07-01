// acc_type.js - إدارة أنواع الحسابات (Supabase فقط)

// ======================== 🎯 تعريف مدير أنواع الحسابات ========================
class AccountTypesManager {
    constructor() {
        console.log('🚀 إنشاء مثيل لمدير أنواع الحسابات...');
        
        // حالة التطبيق
        this.state = {
            allAccountTypes: [],
            currentPage: 1,
            itemsPerPage: 10,
            isEditing: false,
            originalAccountTypeId: null,
            sortColumn: 'account_type_id',
            sortDirection: 'asc'
        };
        
        // اتصال Supabase
        this.supabaseClient = null;
        
        // عناصر DOM
        this.dom = null;
        
        // تهيئة المدير
        this.init();
    }

    // ======================== 🏗️ تهيئة المدير ========================
    async init() {
        try {
            console.log('🔧 بدء تهيئة مدير أنواع الحسابات...');
            
            // التحقق من عناصر DOM
            if (!this.checkRequiredDOM()) {
                console.log('⏳ في انتظار تحميل DOM...');
                setTimeout(() => this.init(), 500);
                return;
            }
            
            // تهيئة Supabase
            await this.initSupabase();
            
            // إعداد الأحداث
            this.setupEventListeners();
            
            // تحميل البيانات
            await this.loadAccountTypes();
            
            console.log('✅ تم تهيئة مدير أنواع الحسابات بنجاح');
            
        } catch (error) {
            console.error('❌ خطأ في تهيئة المدير:', error);
            this.showAlert('خطأ في تهيئة النظام، جاري إعادة المحاولة...', 'danger');
            setTimeout(() => this.init(), 2000);
        }
    }

    // ======================== 🌐 نظام الاتصال Supabase ========================

    // ✅ تهيئة Supabase باستخدام النظام المركزي
    async initSupabase() {
        console.log('🌐 محاولة تهيئة Supabase...');
        
        try {
            // الطريقة المفضلة: استخدام النظام المركزي
            if (window.supabaseManager) {
                this.supabaseClient = await window.supabaseManager.getClient();
                
                if (this.supabaseClient) {
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
                this.supabaseClient = window.supabase.createClient(
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
        if (!this.supabaseClient) {
            await this.initSupabase();
        }
        return !!this.supabaseClient;
    }

    // ✅ تحديث حالة الاتصال
    updateConnectionStatus() {
        const statusDiv = document.getElementById('connectionStatus');
        if (!statusDiv) return;
        
        statusDiv.innerHTML = '<i class="fas fa-database text-success"></i> 🌐 متصل بـ Online';
        statusDiv.className = 'connection-status supabase';
    }

    // ======================== 🏗️ إدارة DOM ========================

    // ✅ التحقق من عناصر DOM المطلوبة
    checkRequiredDOM() {
        const requiredElements = [
            'accountTypeForm',
            'accountTypeName',
            'accountTypeCode',
            'searchBox',
            'tableBody',
            'accountTypesTable'
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
            accountTypeForm: document.getElementById('accountTypeForm'),
            accountTypeName: document.getElementById('accountTypeName'),
            accountTypeCode: document.getElementById('accountTypeCode'),
            accountTypeId: document.getElementById('accountTypeId'),
            modalTitle: document.getElementById('modalTitle'),
            
            // عناصر البحث والعرض
            searchBox: document.getElementById('searchBox'),
            tableBody: document.getElementById('tableBody'),
            accountTypesTable: document.getElementById('accountTypesTable'),
            loading: document.getElementById('loading'),
            
            // عناصر الترقيم والعدد
            pagination: document.getElementById('pagination'),
            itemCount: document.getElementById('itemCount'),
            
            // أزرار
            addAccountTypeBtn: document.getElementById('addAccountTypeBtn'),
            saveAccountTypeBtn: document.getElementById('saveAccountTypeBtn'),
            
            // المودال
            accountTypeModal: document.getElementById('accountTypeModal'),
            
            // حالة الاتصال
            connectionStatus: document.getElementById('connectionStatus'),
            
            // حاوية التنبيهات
            alertContainer: document.getElementById('alertContainer')
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
            
            // زر إضافة جديد
            if (this.dom.addAccountTypeBtn) {
                this.dom.addAccountTypeBtn.addEventListener('click', () => this.openAddModal());
            }
            
            // زر الحفظ
            if (this.dom.saveAccountTypeBtn) {
                this.dom.saveAccountTypeBtn.addEventListener('click', () => this.saveAccountType());
            }
            
            // البحث
            if (this.dom.searchBox) {
                this.dom.searchBox.addEventListener('input', () => {
                    this.state.currentPage = 1;
                    this.renderTable();
                });
            }
            
            // إدخال البيانات باستخدام Enter
            if (this.dom.accountTypeName) {
                this.dom.accountTypeName.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.saveAccountType();
                    }
                });
            }
            
            // إدخال الكود باستخدام Enter
            if (this.dom.accountTypeCode) {
                this.dom.accountTypeCode.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.saveAccountType();
                    }
                });
            }
            
            // إعادة تعيين النموذج عند إغلاق المودال
            if (this.dom.accountTypeModal) {
                this.dom.accountTypeModal.addEventListener('hidden.bs.modal', () => {
                    if (this.dom.accountTypeForm) {
                        this.dom.accountTypeForm.reset();
                        this.dom.accountTypeForm.classList.remove('was-validated');
                        this.state.isEditing = false;
                        this.state.originalAccountTypeId = null;
                    }
                });
            }
            
            // إعداد أحداث الترتيب
            this.setupSortListeners();
            
            console.log('✅ اكتمل إعداد مستمعي الأحداث');
            
        } catch (error) {
            console.error('❌ خطأ في إعداد مستمعي الأحداث:', error);
        }
    }

    // ✅ إعداد أحداث الترتيب
    setupSortListeners() {
        if (!this.dom.accountTypesTable) return;
        
        const sortableHeaders = this.dom.accountTypesTable.querySelectorAll('th[data-sort]');
        sortableHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const column = header.getAttribute('data-sort');
                this.sortTable(column);
            });
        });
    }

    // ✅ ترتيب الجدول
    sortTable(column) {
        // تغيير اتجاه الترتيب إذا كانت نفس العمود
        if (this.state.sortColumn === column) {
            this.state.sortDirection = this.state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.state.sortColumn = column;
            this.state.sortDirection = 'asc';
        }
        
        // تطبيق الترتيب على البيانات
        this.applySorting();
        
        // تحديث مؤشرات الترتيب في رأس الجدول
        this.updateSortIndicators();
        
        // إعادة عرض الجدول
        this.renderTable();
    }

    // ✅ تطبيق الترتيب على البيانات
    applySorting() {
        const { sortColumn, sortDirection } = this.state;
        
        this.state.allAccountTypes.sort((a, b) => {
            let aValue = a[sortColumn];
            let bValue = b[sortColumn];
            
            // معالجة القيم الخاصة
            if (sortColumn === 'account_type_id') {
                aValue = parseInt(aValue);
                bValue = parseInt(bValue);
            } else if (sortColumn === 'created_at') {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            } else {
                aValue = String(aValue || '').toLowerCase();
                bValue = String(bValue || '').toLowerCase();
            }
            
            if (sortDirection === 'asc') {
                return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
            } else {
                return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
            }
        });
    }

    // ✅ تحديث مؤشرات الترتيب
    updateSortIndicators() {
        if (!this.dom.accountTypesTable) return;
        
        const headers = this.dom.accountTypesTable.querySelectorAll('th[data-sort]');
        headers.forEach(header => {
            header.classList.remove('sorted-asc', 'sorted-desc');
            
            const column = header.getAttribute('data-sort');
            if (column === this.state.sortColumn) {
                header.classList.add(`sorted-${this.state.sortDirection}`);
            }
        });
    }

    // ======================== 📥 دوال تحميل البيانات ========================

    // ✅ تحميل أنواع الحسابات
    async loadAccountTypes() {
        const loadingDiv = this.dom.loading;
        if (loadingDiv) {
            loadingDiv.style.display = 'block';
        }
        
        try {
            console.log('🔄 جاري تحميل أنواع الحسابات من Supabase...');
            
            const connected = await this.checkSupabaseConnection();
            if (!connected) return;

            const { data, error } = await this.supabaseClient
                .from('account_types')
                .select('*')
                .order('account_type_id', { ascending: true });
            
            if (error) throw error;
            
            this.state.allAccountTypes = data || [];
            console.log(`✅ تم تحميل ${this.state.allAccountTypes.length} نوع حساب من Supabase`);
            
            // تطبيق الترتيب الافتراضي
            this.applySorting();
            
            // تحديث مؤشرات الترتيب
            this.updateSortIndicators();
            
            // تحديث حالة الاتصال
            this.updateConnectionStatus();
            
            // عرض البيانات
            this.renderTable();
            
        } catch (err) {
            console.error('❌ خطأ في تحميل أنواع الحسابات:', err);
            this.showAlert(`خطأ في تحميل أنواع الحسابات: ${err.message}`, 'danger');
            this.state.allAccountTypes = [];
            this.renderTable();
            
        } finally {
            if (loadingDiv) {
                loadingDiv.style.display = 'none';
            }
        }
    }

    // ======================== 💾 دوال الحفظ والتعديل ========================

    // ✅ فتح مودال الإضافة
    openAddModal() {
        if (this.dom.accountTypeForm) {
            this.dom.accountTypeForm.reset();
            this.dom.accountTypeForm.classList.remove('was-validated');
        }
        
        if (this.dom.modalTitle) {
            this.dom.modalTitle.textContent = 'إضافة نوع حساب جديد';
        }
        
        if (this.dom.accountTypeCode) {
            this.dom.accountTypeCode.removeAttribute('readonly');
            
            // توليد كود تلقائي جديد
            if (this.state.allAccountTypes.length > 0) {
                const maxId = Math.max(...this.state.allAccountTypes.map(item => item.account_type_id));
                this.dom.accountTypeCode.value = maxId + 1;
            } else {
                this.dom.accountTypeCode.value = 1;
            }
        }
        
        this.state.isEditing = false;
        this.state.originalAccountTypeId = null;
        
        const modal = new bootstrap.Modal(this.dom.accountTypeModal);
        modal.show();
        
        setTimeout(() => {
            if (this.dom.accountTypeCode) {
                this.dom.accountTypeCode.focus();
            }
        }, 500);
    }

    // ✅ حفظ نوع الحساب
    async saveAccountType() {
        if (!this.dom.accountTypeForm || !this.dom.accountTypeName || !this.dom.accountTypeCode) {
            return;
        }
        
        // التحقق من الصحة
        this.dom.accountTypeForm.classList.add('was-validated');
        
        const accountTypeCode = this.dom.accountTypeCode.value.trim();
        const accountTypeName = this.dom.accountTypeName.value.trim();
        
        if (!accountTypeCode || !accountTypeName) {
            return;
        }
        
        // التحقق من أن الكود رقم صحيح موجب
        const codeNumber = parseInt(accountTypeCode);
        if (isNaN(codeNumber) || codeNumber <= 0) {
            this.showAlert('كود الحساب يجب أن يكون رقماً صحيحاً موجباً', 'warning');
            return;
        }
        
        const accountTypeData = {
            account_type_id: codeNumber,
            account_type_name: accountTypeName
        };
        
        try {
            console.log(`💾 جاري حفظ نوع الحساب في Supabase...`);
            
            const connected = await this.checkSupabaseConnection();
            if (!connected) return;

            if (this.state.isEditing) {
                // التحقق من تغيير الكود
                const originalCode = parseInt(this.dom.accountTypeId.value);
                if (originalCode !== codeNumber) {
                    // التحقق من عدم وجود كود مكرر
                    const { data: existing } = await this.supabaseClient
                        .from('account_types')
                        .select('account_type_id')
                        .eq('account_type_id', codeNumber)
                        .neq('account_type_id', originalCode)
                        .single();
                    
                    if (existing) {
                        this.showAlert('كود الحساب موجود مسبقاً، الرجاء اختيار كود آخر', 'warning');
                        return;
                    }
                }
                
                // تعديل
                const { error } = await this.supabaseClient
                    .from('account_types')
                    .update(accountTypeData)
                    .eq('account_type_id', originalCode);
                
                if (error) throw error;
                
                this.showAlert('✅ تم تحديث نوع الحساب بنجاح', 'success');
            } else {
                // إضافة
                
                // التحقق من عدم وجود كود مكرر
                const { data: existing } = await this.supabaseClient
                    .from('account_types')
                    .select('account_type_id')
                    .eq('account_type_id', codeNumber)
                    .single();
                
                if (existing) {
                    this.showAlert('كود الحساب موجود مسبقاً، الرجاء اختيار كود آخر', 'warning');
                    return;
                }
                
                const { error } = await this.supabaseClient
                    .from('account_types')
                    .insert([accountTypeData]);
                
                if (error) throw error;
                
                this.showAlert('✅ تم إضافة نوع الحساب بنجاح', 'success');
            }

            // إغلاق المودال وإعادة التحميل
            const modal = bootstrap.Modal.getInstance(this.dom.accountTypeModal);
            if (modal) {
                modal.hide();
            }
            
            this.state.isEditing = false;
            this.state.originalAccountTypeId = null;
            
            await this.loadAccountTypes();
            
        } catch (err) {
            console.error('❌ خطأ أثناء الحفظ:', err);
            this.showAlert(`❌ حدث خطأ أثناء الحفظ: ${err.message}`, 'danger');
        }
    }

    // ✅ تعديل نوع الحساب
    async editAccountType(id) {
        try {
            console.log(`✏️ جاري تحميل بيانات نوع الحساب: ${id}`);
            
            const connected = await this.checkSupabaseConnection();
            if (!connected) return;

            const { data, error } = await this.supabaseClient
                .from('account_types')
                .select('*')
                .eq('account_type_id', id)
                .single();
            
            if (error) throw error;
            
            const accountType = data;
            
            if (this.dom.accountTypeId) {
                this.dom.accountTypeId.value = accountType.account_type_id;
            }
            
            if (this.dom.accountTypeCode) {
                this.dom.accountTypeCode.value = accountType.account_type_id;
                this.dom.accountTypeCode.setAttribute('readonly', true);
            }
            
            if (this.dom.accountTypeName) {
                this.dom.accountTypeName.value = accountType.account_type_name;
            }
            
            if (this.dom.modalTitle) {
                this.dom.modalTitle.textContent = 'تعديل نوع الحساب';
            }
            
            this.state.isEditing = true;
            this.state.originalAccountTypeId = accountType.account_type_id;
            
            const modal = new bootstrap.Modal(this.dom.accountTypeModal);
            modal.show();
            
            setTimeout(() => {
                if (this.dom.accountTypeName) {
                    this.dom.accountTypeName.focus();
                }
            }, 500);
            
        } catch (err) {
            console.error('❌ خطأ في التعديل:', err);
            this.showAlert('❌ فشل في تحميل بيانات نوع الحساب', 'danger');
        }
    }

    // ✅ حذف نوع الحساب
    async deleteAccountType(id) {
        if (!confirm('هل تريد حذف هذا النوع من الحساب؟')) return;
        
        try {
            console.log(`🗑️ جاري حذف نوع الحساب: ${id}`);
            
            const connected = await this.checkSupabaseConnection();
            if (!connected) return;

            const { error } = await this.supabaseClient
                .from('account_types')
                .delete()
                .eq('account_type_id', id);
            
            if (error) throw error;
            
            // تحديث البيانات المحلية
            this.state.allAccountTypes = this.state.allAccountTypes.filter(
                item => item.account_type_id !== parseInt(id)
            );
            
            this.renderTable();
            this.showAlert('✅ تم حذف نوع الحساب بنجاح', 'success');
            
        } catch (err) {
            console.error('❌ خطأ في الحذف:', err);
            this.showAlert('❌ فشل في حذف نوع الحساب', 'danger');
        }
    }

    // ======================== 🎨 دوال العرض ========================

    // ✅ عرض البيانات في الجدول
    renderTable() {
        if (!this.dom.tableBody || !this.dom.pagination || !this.dom.itemCount) {
            return;
        }
        
        const items = this.filteredItems();
        const totalPages = Math.ceil(items.length / this.state.itemsPerPage);
        const start = (this.state.currentPage - 1) * this.state.itemsPerPage;
        const end = start + this.state.itemsPerPage;
        const pageItems = items.slice(start, end);

        const tbody = this.dom.tableBody;
        tbody.innerHTML = '';
        
        if (items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted py-4">
                        <i class="fas fa-inbox fa-2x mb-3"></i>
                        <br>
                        لا توجد بيانات
                    </td>
                </tr>
            `;
            this.renderPagination(0);
            this.renderCount(0);
            return;
        }

        pageItems.forEach((item, index) => {
            const tr = document.createElement('tr');
            const serial = start + index + 1;
            
            // تنسيق التاريخ
            const date = new Date(item.created_at);
            const formattedDate = date.toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            tr.innerHTML = `
                <td>${serial}</td>
                <td>
                    <span class="code-cell">${item.account_type_id}</span>
                </td>
                <td>${this.escapeHtml(item.account_type_name)}</td>
                <td class="date-cell">${formattedDate}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-edit me-1" onclick="window.accountTypesManager.editAccountType(${item.account_type_id})">
                            <i class="fas fa-edit"></i> تعديل
                        </button>
                        <button class="btn btn-sm btn-delete" onclick="window.accountTypesManager.deleteAccountType(${item.account_type_id})">
                            <i class="fas fa-trash"></i> حذف
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        this.renderPagination(totalPages);
        this.renderCount(items.length);
    }

    // ✅ الترقيم
    renderPagination(totalPages) {
        if (!this.dom.pagination) return;
        
        const pagination = this.dom.pagination;
        pagination.innerHTML = '';
        
        if (totalPages <= 1) return;
        
        // زر الصفحة السابقة
        if (this.state.currentPage > 1) {
            const prevBtn = document.createElement('button');
            prevBtn.textContent = 'السابق';
            prevBtn.className = 'page-btn';
            prevBtn.onclick = () => {
                this.state.currentPage--;
                this.renderTable();
            };
            pagination.appendChild(prevBtn);
        }
        
        // أرقام الصفحات
        for (let i = 1; i <= totalPages; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.textContent = i;
            pageBtn.className = 'page-btn' + (i === this.state.currentPage ? ' active' : '');
            pageBtn.onclick = () => {
                this.state.currentPage = i;
                this.renderTable();
            };
            pagination.appendChild(pageBtn);
        }
        
        // زر الصفحة التالية
        if (this.state.currentPage < totalPages) {
            const nextBtn = document.createElement('button');
            nextBtn.textContent = 'التالي';
            nextBtn.className = 'page-btn';
            nextBtn.onclick = () => {
                this.state.currentPage++;
                this.renderTable();
            };
            pagination.appendChild(nextBtn);
        }
    }

    // ✅ عرض العدد
    renderCount(count) {
        if (!this.dom.itemCount) return;
        
        const items = this.filteredItems();
        const start = (this.state.currentPage - 1) * this.state.itemsPerPage + 1;
        const end = Math.min(start + this.state.itemsPerPage - 1, items.length);
        
        this.dom.itemCount.textContent = `عرض ${start}-${end} من ${count} نوع حساب`;
    }

    // ✅ البحث
    filteredItems() {
        if (!this.dom.searchBox) {
            return this.state.allAccountTypes;
        }
        
        const query = this.dom.searchBox.value.toLowerCase().trim();
        if (!query) return this.state.allAccountTypes;

        return this.state.allAccountTypes.filter(item => 
            item.account_type_name.toLowerCase().includes(query) ||
            item.account_type_id.toString().includes(query)
        );
    }

    // ======================== 🛠️ دوال مساعدة ========================

    // 💬 عرض التنبيهات
    showAlert(message, type = 'success') {
        try {
            if (!this.dom.alertContainer) return;
            
            // إزالة التنبيهات القديمة
            const oldAlerts = this.dom.alertContainer.querySelectorAll('.alert');
            oldAlerts.forEach(alert => {
                alert.style.opacity = '0';
                setTimeout(() => alert.remove(), 300);
            });

            const alertDiv = document.createElement('div');
            alertDiv.className = `alert alert-${type} alert-dismissible fade show alert-message`;
            alertDiv.innerHTML = `
                ${type === 'success' ? '<i class="fas fa-check-circle me-2"></i>' : 
                  type === 'danger' ? '<i class="fas fa-exclamation-circle me-2"></i>' :
                  type === 'warning' ? '<i class="fas fa-exclamation-triangle me-2"></i>' :
                  '<i class="fas fa-info-circle me-2"></i>'}
                ${message}
                <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
            `;
            
            this.dom.alertContainer.appendChild(alertDiv);
            
            // إزالة الرسالة بعد 5 ثوانٍ
            setTimeout(() => {
                if (alertDiv.parentElement) {
                    alertDiv.style.opacity = '0';
                    setTimeout(() => alertDiv.remove(), 300);
                }
            }, 5000);
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
    console.log('📄 الصفحة محملة بالكامل، بدء تهيئة مدير أنواع الحسابات...');
    
    // تأخير بسيط لضمان تحميل المكتبات
    setTimeout(() => {
        try {
            // إنشاء وتشغيل المدير
            window.accountTypesManager = new AccountTypesManager();
            console.log('🎉 تم إنشاء مدير أنواع الحسابات');
            
        } catch (error) {
            console.error('❌ فشل في إنشاء مدير أنواع الحسابات:', error);
        }
    }, 1000);
});