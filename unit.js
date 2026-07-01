// Unit Management System - Front-end with Supabase Support
class UnitAPI {
    constructor() {
        this.SUPABASE_URL = 'https://rvjacvrrpguehbapvewe.supabase.co';
        this.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2amFjdnJycGd1ZWhiYXB2ZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMjUxNTksImV4cCI6MjA3ODYwMTE1OX0.wSavKzxKOF7-56G-pzDMtbXNrCNAbGs0wvadw-cilBg';
        
        this.baseUrl = 'http://localhost:3000/api/units';
        this.supabase = null;
        this.useSupabase = true; // جعل Supabase هو الافتراضي
        this._initSupabase();
    }

    // ======================== 🔌 تهيئة Supabase ========================
    async _initSupabase() {
        try {
            // التحقق مما إذا كانت مكتبة Supabase محملة
            if (typeof supabase === 'undefined') {
                console.warn('⚠️ مكتبة Supabase غير محملة، جاري التحميل...');
                await this._loadSupabaseLibrary();
            }
            
            this.supabase = supabase.createClient(this.SUPABASE_URL, this.SUPABASE_KEY);
            console.log('✅ تم تهيئة Supabase بنجاح');
        } catch (error) {
            console.error('❌ Failed to initialize Supabase:', error);
            this.supabase = null;
            this.useSupabase = false; // الرجوع للاتصال المحلي إذا فشل Supabase
        }
    }

    // ======================== 📚 تحميل مكتبة Supabase ========================
    async _loadSupabaseLibrary() {
        return new Promise((resolve, reject) => {
            // التحقق إذا كانت المكتبة محملة مسبقاً
            if (typeof supabase !== 'undefined') {
                resolve();
                return;
            }

            // إنشاء عنصر script لتحميل المكتبة
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.onload = () => {
                console.log('✅ تم تحميل مكتبة Supabase بنجاح');
                resolve();
            };
            script.onerror = () => {
                console.error('❌ فشل في تحميل مكتبة Supabase');
                reject(new Error('فشل في تحميل مكتبة Supabase'));
            };
            
            document.head.appendChild(script);
        });
    }

    // ======================== 📡 طلب عام مع دعم Supabase ========================
    async request(endpoint, options = {}) {
        // المحاولة الأولى: استخدام Supabase إذا كان متاحاً
        if (this.useSupabase && this.supabase) {
            try {
                return await this._supabaseRequest(endpoint, options);
            } catch (supabaseError) {
                console.warn('⚠️ فشل الاتصال بـ Supabase، جاري المحاولة مع API المحلي:', supabaseError.message);
                this.useSupabase = false;
            }
        }

        // المحاولة الثانية: استخدام API المحلي
        try {
            return await this._localAPIRequest(endpoint, options);
        } catch (localError) {
            console.error('❌ فشل الاتصال بالخادم المحلي:', localError.message);
            throw new Error('فشل في الاتصال بكلا المصدرين: Supabase والخادم المحلي');
        }
    }

    // ======================== 📡 طلب API المحلي ========================
    async _localAPIRequest(endpoint, options = {}) {
        console.log('📡 جاري الاتصال بـ:', `${this.baseUrl}${endpoint}`);

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        console.log('✅ استجابة السيرفر:', response.status);

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('الرابط غير موجود. تأكد من أن السيرفر يعمل على port 3000');
            }
            throw new Error(`خطأ ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    }

    // ======================== 📡 طلب Supabase ========================
    async _supabaseRequest(endpoint, options = {}) {
        console.log('🔄 استخدام Supabase للوحدات');

        const method = options.method || 'GET';
        const body = options.body ? JSON.parse(options.body) : null;

        switch (method) {
            case 'GET':
                if (endpoint === '/') {
                    // الحصول على جميع الوحدات
                    const { data, error } = await this.supabase
                        .from('units')
                        .select('*')
                        .order('unit_id', { ascending: true });
                    
                    if (error) throw error;
                    return { success: true, data };
                } else if (endpoint.startsWith('/search')) {
                    // البحث في الوحدات
                    return await this._supabaseSearchUnits(endpoint);
                } else if (endpoint.startsWith('/') && endpoint !== '/') {
                    // الحصول على وحدة بواسطة المعرف
                    const unitId = endpoint.replace('/', '');
                    const { data, error } = await this.supabase
                        .from('units')
                        .select('*')
                        .eq('unit_id', unitId)
                        .single();
                    
                    if (error) throw error;
                    return { success: true, data };
                }
                break;

            case 'POST':
                // إضافة وحدة جديدة
                const { data: insertData, error: insertError } = await this.supabase
                    .from('units')
                    .insert([body])
                    .select();
                
                if (insertError) throw insertError;
                return { success: true, data: insertData[0], message: 'تم إضافة الوحدة بنجاح' };

            case 'PUT':
                // تحديث وحدة
                const unitId = endpoint.replace('/', '');
                const { data: updateData, error: updateError } = await this.supabase
                    .from('units')
                    .update(body)
                    .eq('unit_id', unitId)
                    .select();
                
                if (updateError) throw updateError;
                return { success: true, data: updateData[0], message: 'تم تحديث الوحدة بنجاح' };

            case 'DELETE':
                // حذف وحدة
                const deleteId = endpoint.replace('/', '');
                const { error: deleteError } = await this.supabase
                    .from('units')
                    .delete()
                    .eq('unit_id', deleteId);
                
                if (deleteError) throw deleteError;
                return { success: true, message: 'تم حذف الوحدة بنجاح' };

            case 'PATCH':
                // تغيير حالة الوحدة
                const toggleId = endpoint.replace('/toggle', '').replace('/', '');
                const { data: currentUnit, error: fetchError } = await this.supabase
                    .from('units')
                    .select('is_active')
                    .eq('unit_id', toggleId)
                    .single();
                
                if (fetchError) throw fetchError;
                
                const { error: toggleError } = await this.supabase
                    .from('units')
                    .update({ is_active: !currentUnit.is_active })
                    .eq('unit_id', toggleId);
                
                if (toggleError) throw toggleError;
                return { success: true, message: 'تم تغيير حالة الوحدة بنجاح' };
        }

        throw new Error('الطلب غير مدعوم في Supabase');
    }

    // ======================== 🔍 البحث في الوحدات باستخدام Supabase ========================
    async _supabaseSearchUnits(endpoint) {
        const urlParams = new URLSearchParams(endpoint.replace('/search?', ''));
        const searchTerm = urlParams.get('search');
        const unitType = urlParams.get('type');
        const status = urlParams.get('status');

        let query = this.supabase
            .from('units')
            .select('*');

        // تطبيق الفلاتر
        if (searchTerm) {
            query = query.ilike('unit_name', `%${searchTerm}%`);
        }

        if (unitType) {
            query = query.eq('unit_type', unitType);
        }

        if (status !== undefined && status !== null) {
            query = query.eq('is_active', status === 'true');
        }

        query = query.order('unit_id', { ascending: true });

        const { data, error } = await query;

        if (error) throw error;
        return { success: true, data };
    }

    // الحصول على جميع الوحدات
    async getAllUnits() {
        return await this.request('/');
    }

    // البحث في الوحدات
    async searchUnits(filters) {
        const params = new URLSearchParams();
        if (filters.searchTerm) params.append('search', filters.searchTerm);
        if (filters.unitType) params.append('type', filters.unitType);
        if (filters.isActive !== undefined && filters.isActive !== null) params.append('status', filters.isActive);

        return await this.request(`/search?${params.toString()}`);
    }

    // الحصول على وحدة بواسطة المعرف
    async getUnitById(unitId) {
        return await this.request(`/${unitId}`);
    }

    // إضافة وحدة جديدة
    async createUnit(unitData) {
        return await this.request('/', {
            method: 'POST',
            body: JSON.stringify(unitData)
        });
    }

    // تحديث وحدة
    async updateUnit(unitId, unitData) {
        return await this.request(`/${unitId}`, {
            method: 'PUT',
            body: JSON.stringify(unitData)
        });
    }

    // حذف وحدة
    async deleteUnit(unitId) {
        return await this.request(`/${unitId}`, {
            method: 'DELETE'
        });
    }

    // تغيير حالة الوحدة
    async toggleUnitStatus(unitId) {
        return await this.request(`/${unitId}/toggle`, {
            method: 'PATCH'
        });
    }
}

// ================= UnitUI =================
class UnitUI {
    constructor() {
        this.unitAPI = null;
        this.currentUnitId = null;
        this.init();
    }

    async init() {
        await this.initializeAPI();
        this.setupEventListeners();
        await this.loadUnitsTable();
    }

    // ======================== 🔌 تهيئة API ========================
    async initializeAPI() {
        try {
            this.unitAPI = new UnitAPI();
            // انتظار تهيئة Supabase إذا كانت جارية
            await new Promise(resolve => setTimeout(resolve, 100));
            console.log('✅ تم تهيئة نظام الوحدات بنجاح');
        } catch (error) {
            console.error('❌ فشل في تهيئة نظام الوحدات:', error);
            this.showAlert('فشل في تهيئة النظام، جاري المحاولة مع الاتصال المحلي', 'warning');
        }
    }

    setupEventListeners() {
        document.getElementById('searchInput').addEventListener('input', () => this.loadUnitsTable());
        document.getElementById('typeFilter').addEventListener('change', () => this.loadUnitsTable());
        document.getElementById('statusFilter').addEventListener('change', () => this.loadUnitsTable());
    }

    async loadUnitsTable() {
        this.showLoading(true);

        try {
            const searchTerm = document.getElementById('searchInput').value;
            const typeFilter = document.getElementById('typeFilter').value;
            const statusFilter = document.getElementById('statusFilter').value;

            const filters = {
                searchTerm: searchTerm,
                unitType: typeFilter,
                isActive: statusFilter === '' ? undefined : statusFilter === 'true'
            };

            console.log('🔍 تطبيق الفلاتر:', filters);

            if (!this.unitAPI) {
                throw new Error('نظام API غير مهيء بعد');
            }

            const result = await this.unitAPI.searchUnits(filters);

            if (result.success) {
                this.renderUnitsTable(result.data);
                this.showAlert(`✅ تم تحميل ${result.data.length} وحدة`, 'success', 2000);
            } else {
                this.showAlert(result.message, 'error');
            }
        } catch (error) {
            console.error('❌ خطأ في تحميل الوحدات:', error);
            this.showAlert(`❌ خطأ في تحميل الوحدات: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    renderUnitsTable(units) {
        const tbody = document.getElementById('unitsTableBody');
        const countElement = document.getElementById('unitsCount');

        if (!units || !units.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted py-4">
                        <i class="fas fa-inbox fa-2x mb-3"></i>
                        <br>لا توجد وحدات لعرضها
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = units.map(unit => `
                <tr>
                    <td>${unit.unit_id}</td>
                    <td>${unit.unit_name}</td>
                    <td><span class="badge bg-secondary">${unit.unit_type}</span></td>
                    <td>${unit.conversion_factor}</td>
                    <td>${unit.base_unit || '-'}</td>
                    <td>
                        <span class="status-${unit.is_active ? 'active' : 'inactive'}">
                            <i class="fas fa-${unit.is_active ? 'check-circle' : 'times-circle'} me-1"></i>
                            ${unit.is_active ? 'نشط' : 'غير نشط'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="unitsUI.editUnit(${unit.unit_id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-${unit.is_active ? 'warning' : 'success'}" 
                                onclick="unitsUI.toggleUnitStatus(${unit.unit_id})">
                            <i class="fas fa-${unit.is_active ? 'pause' : 'play'}"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="unitsUI.deleteUnit(${unit.unit_id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        countElement.textContent = `${units ? units.length : 0} وحدة`;
    }

    async showUnitForm(unitId = null) {
        const modal = new bootstrap.Modal(document.getElementById('unitModal'));
        const form = document.getElementById('unitForm');
        const title = document.getElementById('modalTitle');

        form.reset();
        this.currentUnitId = unitId;

        if (unitId) {
            title.textContent = 'تعديل الوحدة';
            try {
                const result = await this.unitAPI.getUnitById(unitId);
                if (result.success) {
                    const unit = result.data;
                    document.getElementById('unitId').value = unit.unit_id;
                    document.getElementById('unitName').value = unit.unit_name;
                    document.getElementById('unitType').value = unit.unit_type;
                    document.getElementById('conversionFactor').value = unit.conversion_factor;
                    document.getElementById('baseUnit').value = unit.base_unit || '';
                    document.getElementById('isActive').checked = unit.is_active;
                }
            } catch (error) {
                this.showAlert(error.message, 'error');
            }
        } else {
            title.textContent = 'إضافة وحدة جديدة';
            document.getElementById('isActive').checked = true;
        }

        modal.show();
    }

    async saveUnit() {
        try {
            const unitData = {
                unit_name: document.getElementById('unitName').value.trim(),
                unit_type: document.getElementById('unitType').value,
                conversion_factor: parseFloat(document.getElementById('conversionFactor').value) || 1,
                base_unit: document.getElementById('baseUnit').value.trim() || null,
                is_active: document.getElementById('isActive').checked
            };

            if (!unitData.unit_name || !unitData.unit_type) {
                this.showAlert('اسم الوحدة ونوع الوحدة مطلوبان', 'error');
                return;
            }

            let result;
            if (this.currentUnitId) {
                result = await this.unitAPI.updateUnit(this.currentUnitId, unitData);
            } else {
                result = await this.unitAPI.createUnit(unitData);
            }

            if (result.success) {
                this.showAlert(result.message, 'success');
                this.loadUnitsTable();
                this.hideUnitForm();
            } else {
                this.showAlert(result.message, 'error');
            }
        } catch (error) {
            this.showAlert(error.message, 'error');
        }
    }

    editUnit(unitId) {
        this.showUnitForm(unitId);
    }

    async deleteUnit(unitId) {
        if (confirm('هل أنت متأكد من حذف هذه الوحدة؟')) {
            try {
                const result = await this.unitAPI.deleteUnit(unitId);
                if (result.success) {
                    this.showAlert(result.message, 'success');
                    this.loadUnitsTable();
                }
            } catch (error) {
                this.showAlert(error.message, 'error');
            }
        }
    }

    async toggleUnitStatus(unitId) {
        try {
            const result = await this.unitAPI.toggleUnitStatus(unitId);
            if (result.success) {
                this.showAlert(result.message, 'success');
                this.loadUnitsTable();
            }
        } catch (error) {
            this.showAlert(error.message, 'error');
        }
    }

    hideUnitForm() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('unitModal'));
        modal.hide();
    }

    showLoading(show) {
        const spinner = document.getElementById('loadingSpinner');
        const table = document.querySelector('.table-responsive');
        if (spinner) spinner.style.display = show ? 'block' : 'none';
        if (table) table.style.display = show ? 'none' : 'block';
    }

    showAlert(message, type, duration = 5000) {
        // إزالة التنبيهات القديمة
        const oldAlerts = document.querySelectorAll('.custom-alert');
        oldAlerts.forEach(alert => alert.remove());

        const alertDiv = document.createElement('div');
        alertDiv.className = `custom-alert alert alert-${type === 'error' ? 'danger' : 'success'} alert-dismissible fade show`;
        alertDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
        `;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(alertDiv);
        setTimeout(() => {
            if (alertDiv.parentNode) alertDiv.parentNode.removeChild(alertDiv);
        }, duration);
    }
}

// تهيئة التطبيق مع معالجة الأخطاء
let unitsUI;
document.addEventListener('DOMContentLoaded', async function() {
    try {
        unitsUI = new UnitUI();
    } catch (error) {
        console.error('❌ فشل في تهيئة تطبيق الوحدات:', error);
        
        // عرض رسالة خطأ للمستخدم
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-danger m-3';
        errorDiv.innerHTML = `
            <h4>❌ فشل في تحميل التطبيق</h4>
            <p>${error.message}</p>
            <p>يرجى التحقق من اتصال الإنترنت وإعادة تحميل الصفحة.</p>
            <button class="btn btn-warning" onclick="location.reload()">إعادة تحميل</button>
        `;
        
        document.querySelector('.container').prepend(errorDiv);
    }
});