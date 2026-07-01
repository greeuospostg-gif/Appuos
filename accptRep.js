// transfer_report.js - Frontend for Transfer Reports with Hybrid System
class TransferReportsApp {
  constructor() {
    this.SUPABASE_URL = 'https://rvjacvrrpguehbapvewe.supabase.co';
    this.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2amFjdnJycGd1ZWhiYXB2ZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMjUxNTksImV4cCI6MjA3ODYwMTE1OX0.wSavKzxKOF7-56G-pzDMtbXNrCNAbGs0wvadw-cilBg';
    
    this.supabase = null;
    this.state = {
      stores: [],
      transfers: [],
      filters: {
        from_date: '',
        to_date: '',
        to_store: '0',
        search_query: ''
      },
      isLoading: false
    };
    this.dom = this._initDOM();
    this.supabase = this._initSupabase();
    this._setupEventListeners();
    this.init();
  }

  // ======================== 🔌 تهيئة Supabase ========================
  _initSupabase() {
    try {
      if (typeof supabaseUrl !== 'undefined' && typeof supabaseKey !== 'undefined') {
        return supabase.createClient(supabaseUrl, supabaseKey);
      } else {
        return supabase.createClient(this.SUPABASE_URL, this.SUPABASE_KEY);
      }
    } catch (error) {
      console.error('❌ Failed to initialize Supabase:', error);
      return null;
    }
  }

  // ======================== 🏗️ تهيئة DOM ========================
  _initDOM() {
    return {
      // عناصر الفلاتر
      fromDate: document.getElementById('fromDate'),
      toDate: document.getElementById('toDate'),
      filterToStore: document.getElementById('filterToStore'),
      qSearch: document.getElementById('qSearch'),
      
      // الأزرار
      btnSearch: document.getElementById('btnSearch'),
      btnReload: document.getElementById('btnReload'),
      btnClear: document.getElementById('btnClear'),
      btnPrint: document.getElementById('btnPrint'),
      
      // عناصر العرض
      resultCount: document.getElementById('resultCount'),
      resultQty: document.getElementById('resultQty'),
      periodText: document.getElementById('periodText'),
      reportDate: document.getElementById('reportDate'),
      reportTable: document.getElementById('reportTable'),
      tableBody: document.querySelector('#reportTable tbody'),
      connectionStatus: document.getElementById('connectionStatus')
    };
  }

  // ======================== 🎯 إعداد مستمعي الأحداث ========================
  _setupEventListeners() {
    // أزرار التحكم
    this.dom.btnSearch.addEventListener('click', () => this._generateReport());
    this.dom.btnReload.addEventListener('click', () => this._generateReport());
    this.dom.btnClear.addEventListener('click', () => this._clearFilters());
    this.dom.btnPrint.addEventListener('click', () => this._printReport());

    // تفعيل Enter في حقل البحث
    this.dom.qSearch.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._generateReport();
      }
    });
  }

  // ======================== ✅ الحصول على وضع الاتصال الحالي ========================
  getConnectionMode() {
    return localStorage.getItem('connection_mode') || 
           sessionStorage.getItem('connection_mode') || 
           'auto';
  }

  // ======================== ✅ تحديث شريط حالة الاتصال ========================
  updateConnectionStatus() {
    const statusDiv = this.dom.connectionStatus;
    if (!statusDiv) {
      console.warn('❌ connectionStatus element not found');
      return;
    }
    
    const mode = this.getConnectionMode();
    
    if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
      statusDiv.innerHTML = '🌐 Supabase مباشر <button class="switch-btn" onclick="transferReportsApp.switchConnectionMode()">تبديل</button>';
      statusDiv.className = 'connection-status supabase';
    } else {
      statusDiv.innerHTML = '🔗 اتصال محلي <button class="switch-btn" onclick="transferReportsApp.switchConnectionMode()">تبديل</button>';
      statusDiv.className = 'connection-status local';
    }
  }

  // ======================== ✅ تبديل وضع الاتصال ========================
  switchConnectionMode() {
    const currentMode = this.getConnectionMode();
    const newMode = currentMode === 'supabase' ? 'local' : 'supabase';
    
    localStorage.setItem('connection_mode', newMode);
    sessionStorage.setItem('connection_mode', newMode);
    
    this.updateConnectionStatus();
    this._showAlert(`🔄 تم التبديل إلى: ${newMode === 'supabase' ? 'Supabase مباشر' : 'الاتصال المحلي'}`, 'success');
    
    // إعادة تحميل البيانات
    this._loadStores();
    this._generateReport();
  }

  // ======================== 🚀 تهيئة التطبيق ========================
  async init() {
    this.updateConnectionStatus();
    await this._loadStores();
    this._setDefaultDates();
    await this._generateReport();
    this._showAlert('✅ تم تهيئة نظام تقارير التحويلات', 'success');
  }

  // ======================== 📥 تحميل المخازن ========================
  async _loadStores() {
    try {
      const mode = this.getConnectionMode();
      let stores = [];

      if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
        // استخدام Supabase
        console.log('🔄 جاري جلب المخازن من Supabase');
        
        if (!this.supabase) {
          throw new Error('Supabase client not initialized');
        }
        
        const { data, error } = await this.supabase
          .from('stores')
          .select('*')
          .order('store_id');
        
        if (error) throw error;
        
        stores = data || [];
        console.log(`✅ تم تحميل ${stores.length} مخزن من Supabase`);
      } else {
        // استخدام API التقليدي
        const apiUrl = 'http://localhost:3000/api/stores';
        console.log('🔗 استخدام API التقليدي:', apiUrl);
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`خطأ في الشبكة: ${response.status}`);
        }
        
        const result = await response.json();
        if (result.success || result.stores) {
          stores = result.stores || result.data || [];
        } else {
          throw new Error(result.message || 'خطأ في تحميل المخازن');
        }
        
        console.log(`✅ تم تحميل ${stores.length} مخزن من الخادم المحلي`);
      }

      this.state.stores = stores;
      this._renderStoresDropdown();
      
    } catch (error) {
      console.error("❌ Error loading stores:", error);
      this._showAlert("خطأ في تحميل المخازن", "danger");
      
      // التحول التلقائي إلى Supabase في حالة الفشل
      if (this.getConnectionMode() !== 'supabase') {
        const switchNow = confirm('فشل الاتصال بالخادم المحلي. هل تريد التبديل إلى Supabase؟');
        if (switchNow) {
          localStorage.setItem('connection_mode', 'supabase');
          this._loadStores();
        }
      }
    }
  }

  // ======================== 🎨 عرض المخازن في Dropdown ========================
  _renderStoresDropdown() {
    if (this.dom.filterToStore) {
      this.dom.filterToStore.innerHTML = `
        <option value="0">الكل</option>
        ${this.state.stores.map(store => `
          <option value="${store.store_id}">${this._escapeHtml(store.store_name)}</option>
        `).join('')}
      `;
    }
  }

  // ======================== 📅 تعيين التواريخ الافتراضية ========================
  _setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    const firstDay = new Date();
    firstDay.setDate(1);
    
    if (this.dom.fromDate) {
      this.dom.fromDate.value = firstDay.toISOString().split('T')[0];
    }
    
    if (this.dom.toDate) {
      this.dom.toDate.value = today;
    }
  }

  // ======================== 🚀 إنشاء التقرير ========================
  async _generateReport() {
    this._setLoading(true);
    
    try {
      const filters = this._getCurrentFilters();
      const mode = this.getConnectionMode();

      let transfers;

      if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
        // استخدام Supabase
        transfers = await this._generateReportFromSupabase(filters);
      } else {
        // استخدام API التقليدي
        transfers = await this._generateReportFromLocalAPI(filters);
      }

      if (transfers) {
        this.state.transfers = transfers;
        this._renderReport();
        this._updateSummary();
        this._showAlert('✅ تم إنشاء التقرير بنجاح', 'success');
      } else {
        this._showAlert("❌ لم يتم العثور على بيانات", "warning");
      }
    } catch (error) {
      console.error("❌ Error generating report:", error);
      this._showAlert(`❌ خطأ في إنشاء التقرير: ${error.message}`, "danger");
    } finally {
      this._setLoading(false);
    }
  }

  // ======================== ☁️ إنشاء التقرير من Supabase ========================
  async _generateReportFromSupabase(filters) {
    console.log('🔄 جاري إنشاء تقرير التحويلات من Supabase - جدول transfer_stores');
    
    if (!this.supabase) {
      throw new Error('Supabase client not initialized');
    }

    try {
      let query = this.supabase
        .from('transfer_stores')
        .select(`
          *,
          from_store_info:from_store(store_name),
          to_store_info:to_store(store_name),
          item_info:item_id(item_name)
        `);

      // تطبيق الفلاتر
      if (filters.from_date) {
        query = query.gte('tran_date', filters.from_date);
      }

      if (filters.to_date) {
        query = query.lte('tran_date', filters.to_date);
      }

      if (filters.to_store && filters.to_store !== '0') {
        query = query.eq('to_store', parseInt(filters.to_store));
      }

      if (filters.search_query) {
        query = query.or(`transfer_no.ilike.%${filters.search_query}%,item_id.ilike.%${filters.search_query}%,remarks.ilike.%${filters.search_query}%`);
      }

      const { data, error } = await query.order('tran_date', { ascending: false });

      if (error) {
        // إذا فشل، استخدم API المحلي
        console.warn('❌ فشل جلب البيانات من Supabase، جاري استخدام API المحلي...', error.message);
        return await this._generateReportFromLocalAPI(filters);
      }

      console.log(`✅ تم تحميل ${data.length} تحويل من جدول transfer_stores`);
      return this._formatTransferData(data);

    } catch (error) {
      // إذا فشل الاتصال بـ Supabase، استخدم API المحلي
      console.warn('❌ فشل الاتصال بـ Supabase، جاري استخدام API المحلي:', error.message);
      return await this._generateReportFromLocalAPI(filters);
    }
  }

  // ======================== 🎨 تنسيق بيانات التحويل ========================
  _formatTransferData(data) {
    return data.map(transfer => {
      // البحث عن اسم المخزن المصدر من قائمة المخازن المحملة
      const fromStore = this.state.stores.find(store => store.store_id === transfer.from_store);
      const toStore = this.state.stores.find(store => store.store_id === transfer.to_store);
      
      return {
        transfer_no: transfer.transfer_no,
        tran_date: transfer.tran_date,
        from_store_name: fromStore ? fromStore.store_name : `الفرع ${transfer.from_store}`,
        to_store_name: toStore ? toStore.store_name : `الفرع ${transfer.to_store}`,
        item_id: transfer.item_id,
        item_nm: transfer.item_info?.item_name || transfer.item_id,
        qty: transfer.qty,
        batch_no: transfer.batch_no,
        expiry_date: transfer.expiry_date,
        status: this._mapTransferStatus(transfer.status),
        remarks: transfer.remarks,
        // الحقول الإضافية إذا كانت موجودة
        unit_type: transfer.unit_type,
        units_per_package: transfer.units_per_package,
        conversion_factor: transfer.conversion_factor,
        buy_price: transfer.buy_price,
        sale_price1: transfer.sale_price1,
        sale_price2: transfer.sale_price2,
        sale_price3: transfer.sale_price3,
        rate: transfer.rate
      };
    });
  }

  // ======================== 🗺️ تعيين حالة التحويل ========================
  _mapTransferStatus(status) {
    if (!status) return 'pending';
    
    const statusMap = {
      '0': 'pending',
      '1': 'completed', 
      '2': 'rejected',
      '3': 'auto_returned',
      'معلق': 'pending',
      'مكتمل': 'completed',
      'مرفوض': 'rejected',
      'مرتجع': 'auto_returned'
    };
    
    return statusMap[status] || status;
  }

  // ======================== 💻 إنشاء التقرير من API المحلي ========================
  async _generateReportFromLocalAPI(filters) {
    console.log('🔄 جاري إنشاء تقرير التحويلات من API المحلي');
    
    const apiUrl = 'http://localhost:3000/api/transferItembk/transfer-report';
    const params = new URLSearchParams({
      from: filters.from_date,
      to: filters.to_date,
      to_store: filters.to_store,
      q: filters.search_query
    });

    try {
      const response = await fetch(`${apiUrl}?${params}`);
      const result = await response.json();

      if (result.success || result.transfers) {
        return result.transfers || result.data || [];
      } else {
        throw new Error(result.message || 'خطأ في إنشاء التقرير');
      }
    } catch (error) {
      throw new Error(`فشل الاتصال بالخادم المحلي: ${error.message}`);
    }
  }

  // ======================== 🎯 جمع الفلاتر الحالية ========================
  _getCurrentFilters() {
    return {
      from_date: this.dom.fromDate?.value || '',
      to_date: this.dom.toDate?.value || '',
      to_store: this.dom.filterToStore?.value || '0',
      search_query: this.dom.qSearch?.value || ''
    };
  }

  // ======================== 🎨 عرض التقرير ========================
  _renderReport() {
    const { transfers } = this.state;
    
    if (!transfers || transfers.length === 0) {
      this.dom.tableBody.innerHTML = `
        <tr>
          <td colspan="12" class="text-center text-muted">
            <i class="fas fa-inbox me-2"></i>لا توجد بيانات للعرض
          </td>
        </tr>
      `;
      return;
    }

    this.dom.tableBody.innerHTML = transfers.map((transfer, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${this._escapeHtml(transfer.transfer_no || '-')}</td>
        <td>${this._formatDateTime(transfer.tran_date)}</td>
        <td>${this._escapeHtml(transfer.from_store_name)}</td>
        <td>${this._escapeHtml(transfer.to_store_name)}</td>
        <td>${this._escapeHtml(transfer.item_id || '-')}</td>
        <td style="text-align:right">${this._escapeHtml(transfer.item_nm || '-')}</td>
        <td>${Number(transfer.qty || 0).toFixed(2)}</td>
        <td>${this._escapeHtml(transfer.batch_no || '-')}</td>
        <td>${this._formatDate(transfer.expiry_date)}</td>
        <td>${this._renderStatusBadge(transfer.status)}</td>
        <td style="text-align:right">${this._escapeHtml(transfer.remarks || '')}</td>
      </tr>
    `).join('');

    // تحديث نص الفترة
    const filters = this._getCurrentFilters();
    if (this.dom.periodText) {
      this.dom.periodText.textContent = `من ${filters.from_date} إلى ${filters.to_date} | فرع الهدف: ${this.dom.filterToStore.selectedOptions[0].textContent}`;
    }
    if (this.dom.reportDate) {
      this.dom.reportDate.textContent = new Date().toLocaleString('ar-EG');
    }
  }

  // ======================== 📊 تحديث الملخص ========================
  _updateSummary() {
    const { transfers } = this.state;
    const totalQty = transfers.reduce((sum, transfer) => sum + (parseFloat(transfer.qty) || 0), 0);
    
    if (this.dom.resultCount) {
      this.dom.resultCount.textContent = transfers.length;
    }
    if (this.dom.resultQty) {
      this.dom.resultQty.textContent = totalQty.toFixed(2);
    }
  }

  // ======================== 🎨 عرض حالة التحويل ========================
  _renderStatusBadge(status) {
    if (!status) return '-';
    
    const statusMap = {
      pending: '<span class="status-pending">معلق</span>',
      completed: '<span class="status-completed">مكتمل</span>',
      rejected: '<span class="status-rejected">مرفوض</span>',
      auto_returned: '<span class="status-auto_returned">مرتجع تلقائي</span>'
    };
    
    return statusMap[status] || `<span>${status}</span>`;
  }

  // ======================== 🗑️ مسح الفلاتر ========================
  _clearFilters() {
    this.dom.fromDate.value = '';
    this.dom.toDate.value = '';
    this.dom.filterToStore.value = '0';
    this.dom.qSearch.value = '';
    if (this.dom.resultCount) this.dom.resultCount.textContent = '0';
    if (this.dom.resultQty) this.dom.resultQty.textContent = '0.00';
    this.dom.tableBody.innerHTML = '';
  }

  // ======================== 🖨️ طباعة التقرير ========================
  _printReport() {
    if (!this.state.transfers || this.state.transfers.length === 0) {
      this._showAlert("لا توجد بيانات للطباعة", "warning");
      return;
    }

    window.print();
  }

  // ======================== ⏳ تعيين حالة التحميل ========================
  _setLoading(loading) {
    this.state.isLoading = loading;
    // يمكن إضافة spinner إذا لزم الأمر
  }

  // ======================== 💬 عرض التنبيهات ========================
  _showAlert(message, type) {
    // إزالة التنبيهات القديمة
    const oldAlerts = document.querySelectorAll('.alert');
    oldAlerts.forEach(alert => alert.remove());

    const alertDiv = document.createElement("div");
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.style.cssText = `
      position: fixed;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      min-width: 300px;
      text-align: center;
    `;
    alertDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
      if (alertDiv.parentElement) {
        alertDiv.remove();
      }
    }, 5000);
  }

  // ======================== 📅 تنسيق التاريخ والوقت ========================
  _formatDateTime(dt) {
    return dt ? new Date(dt).toLocaleString('ar-EG') : '-';
  }

  // ======================== 📅 تنسيق التاريخ ========================
  _formatDate(dt) {
    return dt ? new Date(dt).toLocaleDateString('ar-EG') : '-';
  }

  // ======================== 🛡️ حماية من XSS ========================
  _escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

// ======================== 🚀 تشغيل التطبيق ========================
let transferReportsApp;
document.addEventListener("DOMContentLoaded", function() {
  transferReportsApp = new TransferReportsApp();
});
