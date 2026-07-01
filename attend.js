// attend.js - نظام إدارة الحضور والانصراف مع Supabase
class AttendanceApp {
  constructor() {
    this.SUPABASE_URL = 'https://rvjacvrrpguehbapvewe.supabase.co';
    this.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2amFjdnJycGd1ZWhiYXB2ZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMjUxNTksImV4cCI6MjA3ODYwMTE1OX0.wSavKzxKOF7-56G-pzDMtbXNrCNAbGs0wvadw-cilBg';
    
    this.supabase = null;
    this.state = {
      employees: [],
      attendance: [],
      currentEditId: null,
      isLoading: false,
      isConnected: false
    };
    
    this.dom = this._initDOM();
    this._setupEventListeners();
    this.init();
  }

  // ======================== 🏗️ تهيئة DOM ========================
  _initDOM() {
    const dom = {
      form: document.getElementById("att-form"),
      emp_id: document.getElementById("emp_id"),
      att_date: document.getElementById("att_date"),
      check_in: document.getElementById("check_in"),
      check_out: document.getElementById("check_out"),
      notes: document.getElementById("notes"),
      tableBody: document.querySelector("#att-table tbody"),
      saveBtn: document.getElementById("save-btn"),
      newBtn: document.getElementById("new-btn"),
      refreshBtn: document.getElementById("refresh-btn"),
      searchBox: document.getElementById("searchBox"),
      connectionStatus: document.getElementById("connection-status"),
      loadingSpinner: document.getElementById("loading-spinner")
    };

    // ✅ إضافة شريط حالة الاتصال ديناميكياً إذا لم يكن موجوداً
    if (!dom.connectionStatus) {
      const connectionStatus = document.createElement('div');
      connectionStatus.id = 'connection-status';
      connectionStatus.className = 'connection-status';
      connectionStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الاتصال...';
      document.body.appendChild(connectionStatus);
      dom.connectionStatus = connectionStatus;
    }

    // ✅ إضافة مؤشر تحميل إذا لم يكن موجوداً
    if (!dom.loadingSpinner) {
      const loadingSpinner = document.createElement('div');
      loadingSpinner.id = 'loading-spinner';
      loadingSpinner.className = 'loading-spinner';
      loadingSpinner.style.cssText = `
        display: none;
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 9999;
      `;
      loadingSpinner.innerHTML = `
        <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;">
          <span class="visually-hidden">جاري التحميل...</span>
        </div>
      `;
      document.body.appendChild(loadingSpinner);
      dom.loadingSpinner = loadingSpinner;
    }

    return dom;
  }

  // ======================== 🎯 إعداد مستمعي الأحداث ========================
  _setupEventListeners() {
    this.dom.form.addEventListener("submit", e => this._saveAttendance(e));
    this.dom.newBtn.addEventListener("click", () => this._clearForm());
    if (this.dom.refreshBtn) {
      this.dom.refreshBtn.addEventListener("click", () => this._loadAttendance());
    }
    if (this.dom.searchBox) {
      this.dom.searchBox.addEventListener("input", () => this._filterTable());
    }
    
    // تعيين التاريخ الحالي افتراضياً
    if (this.dom.att_date) {
      this.dom.att_date.value = new Date().toISOString().split('T')[0];
    }
  }

  // ======================== 🚀 تهيئة التطبيق ========================
  async init() {
    try {
      this._showLoading(true);
      this._updateConnectionStatus('warning', '<i class="fas fa-spinner fa-spin"></i> جاري الاتصال...');
      
      // تهيئة Supabase
      this.supabase = supabase.createClient(this.SUPABASE_URL, this.SUPABASE_KEY);
      
      // اختبار الاتصال
      const { data: session, error } = await this.supabase.auth.getSession();
      
      if (error) {
        throw new Error(`فشل الاتصال: ${error.message}`);
      }
      
      this.state.isConnected = true;
      this._updateConnectionStatus('success', '<i class="fas fa-cloud-check"></i> متصل Online');
      
      await this._loadEmployees();
      await this._loadAttendance();
      
      this._showAlert('✅ تم تهيئة نظام الحضور والانصراف بنجاح', 'success');
      
    } catch (error) {
      console.error('❌ خطأ في تهيئة التطبيق:', error);
      this._updateConnectionStatus('danger', '<i class="fas fa-cloud-slash"></i> غير متصل');
      this._showAlert(`خطأ في الاتصال: ${error.message}`, 'danger');
    } finally {
      this._showLoading(false);
    }
  }

  // ======================== 🔄 تحديث حالة الاتصال ========================
  _updateConnectionStatus(type, message) {
    if (!this.dom.connectionStatus) return;
    
    this.dom.connectionStatus.innerHTML = message;
    this.dom.connectionStatus.style.borderLeftColor = 
      type === 'success' ? '#28a745' : 
      type === 'danger' ? '#dc3545' : '#ffc107';
  }

  // ======================== ⏳ إظهار/إخفاء التحميل ========================
  _showLoading(show) {
    this.state.isLoading = show;
    
    if (this.dom.loadingSpinner) {
      this.dom.loadingSpinner.style.display = show ? 'block' : 'none';
    }
    
    if (this.dom.saveBtn) {
      this.dom.saveBtn.disabled = show;
      this.dom.saveBtn.innerHTML = show ? 
        '<i class="fas fa-spinner fa-spin"></i> جاري المعالجة...' : 
        '<i class="fas fa-save"></i> حفظ';
    }
  }

  // ======================== 📥 تحميل الموظفين ========================
  async _loadEmployees() {
    try {
      this._showLoading(true);
      console.log('🔄 جاري تحميل بيانات الموظفين...');
      
      if (!this.supabase) {
        throw new Error('Supabase غير مهيئ');
      }

      const { data, error } = await this.supabase
        .from('employees')
        .select('emp_id, first_name, last_name, department_id')
        .order('first_name');

      if (error) {
        console.error('❌ خطأ في تحميل الموظفين:', error);
        
        // إذا كان الجدول غير موجود، نعرض بيانات تجريبية
        if (error.code === '42P01') {
          console.log('⚠️ جدول employees غير موجود، استخدام بيانات تجريبية');
          this._loadSampleEmployees();
          return;
        }
        throw error;
      }

      console.log(`✅ تم تحميل ${data.length} موظف`);
      this.state.employees = data || [];
      this._renderEmployeesDropdown();
      
    } catch (error) {
      console.error('❌ خطأ في تحميل بيانات الموظفين:', error);
      this._loadSampleEmployees();
      this._showAlert('يتم استخدام بيانات تجريبية للموظفين', 'info');
    } finally {
      this._showLoading(false);
    }
  }

  // ======================== 📥 تحميل بيانات تجريبية للموظفين ========================
  _loadSampleEmployees() {
    const sampleEmployees = [
      { emp_id: 1, first_name: 'أحمد', last_name: 'محمد', department_id: 1 },
      { emp_id: 2, first_name: 'محمد', last_name: 'علي', department_id: 2 },
      { emp_id: 3, first_name: 'فاطمة', last_name: 'أحمد', department_id: 3 },
      { emp_id: 4, first_name: 'يوسف', last_name: 'خالد', department_id: 1 },
      { emp_id: 5, first_name: 'سارة', last_name: 'عبدالله', department_id: 2 }
    ];
    
    this.state.employees = sampleEmployees;
    this._renderEmployeesDropdown();
  }

  // ======================== 📥 تحميل سجلات الحضور ========================
  async _loadAttendance() {
    try {
      this._showLoading(true);
      console.log('🔄 جاري تحميل سجلات الحضور...');
      
      if (!this.supabase) {
        throw new Error('Supabase غير مهيئ');
      }

      const { data, error } = await this.supabase
        .from('attendance')
        .select(`
          *,
          employees (
            first_name,
            last_name
          )
        `)
        .order('attendance_date', { ascending: false })
        .limit(100);

      if (error) {
        console.error('❌ خطأ في تحميل سجلات الحضور:', error);
        
        // إذا كان الجدول غير موجود، نعرض بيانات تجريبية
        if (error.code === '42P01') {
          console.log('⚠️ جدول attendance غير موجود، استخدام بيانات تجريبية');
          this._loadSampleAttendance();
          return;
        }
        throw error;
      }

      console.log(`✅ تم تحميل ${data.length} سجل حضور`);
      this.state.attendance = data.map(record => ({
        ...record,
        first_name: record.employees?.first_name || '',
        last_name: record.employees?.last_name || ''
      }));
      
      this._renderTable();
      
    } catch (error) {
      console.error('❌ خطأ في تحميل سجلات الحضور:', error);
      this._loadSampleAttendance();
      this._showAlert('يتم استخدام بيانات تجريبية للحضور', 'info');
    } finally {
      this._showLoading(false);
    }
  }

  // ======================== 📥 تحميل بيانات تجريبية للحضور ========================
  _loadSampleAttendance() {
    const sampleAttendance = [
      {
        attendance_id: 1,
        emp_id: 1,
        attendance_date: '2024-01-15',
        check_in: '08:45',
        check_out: '17:30',
        status: 'present',
        notes: 'حضور طبيعي',
        first_name: 'أحمد',
        last_name: 'محمد'
      },
      {
        attendance_id: 2,
        emp_id: 2,
        attendance_date: '2024-01-15',
        check_in: '09:15',
        check_out: '17:45',
        status: 'late',
        notes: 'تأخر 15 دقيقة',
        first_name: 'محمد',
        last_name: 'علي'
      },
      {
        attendance_id: 3,
        emp_id: 3,
        attendance_date: '2024-01-15',
        check_in: '08:30',
        check_out: '16:45',
        status: 'early',
        notes: 'انصراف مبكر',
        first_name: 'فاطمة',
        last_name: 'أحمد'
      }
    ];
    
    this.state.attendance = sampleAttendance;
    this._renderTable();
  }

  // ======================== 🎨 عرض الموظفين في القائمة المنسدلة ========================
  _renderEmployeesDropdown() {
    if (!this.dom.emp_id) return;
    
    const employees = this.state.employees || [];
    
    if (employees.length === 0) {
      this.dom.emp_id.innerHTML = '<option value="">لا يوجد موظفين</option>';
      return;
    }
    
    this.dom.emp_id.innerHTML = `
      <option value="">اختر الموظف</option>
      ${employees.map(employee => `
        <option value="${employee.emp_id}">
          ${employee.first_name} ${employee.last_name}
        </option>
      `).join('')}
    `;
  }

  // ======================== 🎨 عرض البيانات في الجدول ========================
  _renderTable() {
    const { attendance } = this.state;
    
    if (!this.dom.tableBody) return;
    
    if (!attendance || attendance.length === 0) {
      this.dom.tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="empty-state">
            <div><i class="fas fa-inbox"></i></div>
            <p>لا توجد سجلات حضور</p>
            <small>قم بإضافة سجل حضور جديد</small>
          </td>
        </tr>
      `;
      return;
    }

    this.dom.tableBody.innerHTML = attendance.map((record, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${record.first_name} ${record.last_name}</td>
        <td>${this._formatDate(record.attendance_date)}</td>
        <td>${record.check_in || '-'}</td>
        <td>${record.check_out || '-'}</td>
        <td>${this._renderStatusBadge(record.status)}</td>
        <td>${record.notes || ''}</td>
        <td class="actions">
          <button class="edit-btn" onclick="attendanceApp.editAttendance(${record.attendance_id})">
            <i class="fas fa-edit"></i> تعديل
          </button>
          <button class="delete-btn" onclick="attendanceApp.deleteAttendance(${record.attendance_id})">
            <i class="fas fa-trash"></i> حذف
          </button>
        </td>
      </tr>
    `).join('');
  }

  // ======================== 🎨 عرض حالة الحضور ========================
  _renderStatusBadge(status) {
    if (!status) return '-';
    
    const statusMap = {
      present: '<span class="badge bg-success">حاضر</span>',
      absent: '<span class="badge bg-danger">غائب</span>',
      late: '<span class="badge bg-warning">متأخر</span>',
      early: '<span class="badge bg-info">مبكر</span>',
      vacation: '<span class="badge bg-secondary">إجازة</span>'
    };
    
    return statusMap[status] || `<span class="badge bg-secondary">${status}</span>`;
  }

  // ======================== 🔍 فلترة الجدول ========================
  _filterTable() {
    if (!this.dom.searchBox || !this.dom.tableBody) return;
    
    const query = this.dom.searchBox.value.toLowerCase();
    const rows = this.dom.tableBody.querySelectorAll("tr");
    let hasVisibleRows = false;
    
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      if (text.includes(query)) {
        row.style.display = "";
        hasVisibleRows = true;
      } else {
        row.style.display = "none";
      }
    });

    // إظهار رسالة إذا لم توجد نتائج
    if (!hasVisibleRows && rows.length > 0) {
      this.dom.tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="empty-state">
            <div><i class="fas fa-search"></i></div>
            <p>لا توجد نتائج للبحث</p>
            <small>جرب استخدام كلمات بحث مختلفة</small>
          </td>
        </tr>
      `;
    }
  }

  // ======================== 💾 حفظ سجل الحضور ========================
  async _saveAttendance(e) {
    e.preventDefault();
    
    // التحقق من صحة البيانات
    if (!this.dom.emp_id.value) {
      this._showAlert("يرجى اختيار الموظف", "warning");
      this.dom.emp_id.focus();
      return;
    }

    if (!this.dom.att_date.value) {
      this._showAlert("يرجى اختيار التاريخ", "warning");
      this.dom.att_date.focus();
      return;
    }

    if (!this.dom.check_in.value) {
      this._showAlert("يرجى إدخال وقت الحضور", "warning");
      this.dom.check_in.focus();
      return;
    }

    try {
      this._showLoading(true);
      
      if (!this.supabase) {
        throw new Error('Supabase غير مهيئ');
      }

      const attendanceData = {
        emp_id: parseInt(this.dom.emp_id.value),
        attendance_date: this.dom.att_date.value,
        check_in: this.dom.check_in.value,
        check_out: this.dom.check_out.value || null,
        notes: this.dom.notes.value || '',
        status: this._calculateStatus(this.dom.check_in.value, this.dom.check_out.value)
      };

      let result;
      
      if (this.state.currentEditId) {
        // تحديث سجل موجود
        console.log('🔄 جاري تحديث سجل الحضور:', this.state.currentEditId);
        
        const { data, error } = await this.supabase
          .from('attendance')
          .update(attendanceData)
          .eq('attendance_id', this.state.currentEditId)
          .select();

        if (error) throw error;
        result = data;
        console.log('✅ تم التحديث بنجاح:', result);
        
        this._showAlert('✅ تم تحديث سجل الحضور بنجاح', 'success');
      } else {
        // إضافة سجل جديد
        console.log('🔄 جاري إضافة سجل حضور جديد');
        
        const { data, error } = await this.supabase
          .from('attendance')
          .insert([attendanceData])
          .select();

        if (error) throw error;
        result = data;
        console.log('✅ تم الإضافة بنجاح:', result);
        
        this._showAlert('✅ تم إضافة سجل الحضور بنجاح', 'success');
      }

      this._clearForm();
      await this._loadAttendance();
      
    } catch (error) {
      console.error('❌ خطأ في حفظ سجل الحضور:', error);
      this._showAlert(`فشل في حفظ البيانات: ${error.message}`, 'danger');
    } finally {
      this._showLoading(false);
    }
  }

  // ======================== 🧮 حساب حالة الحضور ========================
  _calculateStatus(checkIn, checkOut) {
    if (!checkIn) return 'absent';
    
    const checkInTime = new Date(`2000-01-01T${checkIn}`);
    const expectedTime = new Date(`2000-01-01T09:00:00`); // وقت الحضور المتوقع 9 صباحاً
    
    if (checkInTime > new Date(`2000-01-01T10:00:00`)) {
      return 'absent';
    } else if (checkInTime > expectedTime) {
      return 'late';
    } else if (checkInTime < new Date(`2000-01-01T08:30:00`)) {
      return 'early';
    } else {
      return 'present';
    }
  }

  // ======================== ✏️ تعديل سجل الحضور ========================
  async editAttendance(id) {
    try {
      this._showLoading(true);
      
      if (!this.supabase) {
        throw new Error('Supabase غير مهيئ');
      }

      console.log('🔄 جاري تحميل بيانات السجل للتعديل:', id);
      
      const { data, error } = await this.supabase
        .from('attendance')
        .select('*')
        .eq('attendance_id', id)
        .single();

      if (error) throw error;
      
      console.log('✅ بيانات السجل:', data);

      this.state.currentEditId = id;
      
      // تعبئة النموذج
      this.dom.emp_id.value = data.emp_id;
      this.dom.att_date.value = data.attendance_date?.split('T')[0] || data.att_date?.split('T')[0] || '';
      this.dom.check_in.value = data.check_in || '';
      this.dom.check_out.value = data.check_out || '';
      this.dom.notes.value = data.notes || '';
      
      this.dom.saveBtn.innerHTML = '<i class="fas fa-edit"></i> تحديث';
      this.dom.saveBtn.classList.remove('btn-primary');
      this.dom.saveBtn.classList.add('btn-secondary');
      
      this.dom.emp_id.focus();
      
      this._showAlert('✅ جاهز للتعديل - يمكنك الآن تعديل بيانات السجل', 'info');
      
    } catch (error) {
      console.error('❌ خطأ في تحميل بيانات السجل:', error);
      this._showAlert(`فشل في تحميل بيانات السجل: ${error.message}`, 'danger');
    } finally {
      this._showLoading(false);
    }
  }

  // ======================== 🗑️ حذف سجل الحضور ========================
  async deleteAttendance(id) {
    if (!confirm("هل أنت متأكد من حذف سجل الحضور هذا؟")) {
      return;
    }

    try {
      this._showLoading(true);
      
      if (!this.supabase) {
        throw new Error('Supabase غير مهيئ');
      }

      console.log('🗑️ جاري حذف السجل:', id);
      
      const { error } = await this.supabase
        .from('attendance')
        .delete()
        .eq('attendance_id', id);

      if (error) throw error;
      
      console.log('✅ تم الحذف بنجاح');
      this._showAlert('✅ تم حذف سجل الحضور بنجاح', 'success');
      
      await this._loadAttendance();
      
    } catch (error) {
      console.error('❌ خطأ في حذف السجل:', error);
      this._showAlert(`فشل في حذف البيانات: ${error.message}`, 'danger');
    } finally {
      this._showLoading(false);
    }
  }

  // ======================== 🔄 إعادة تعيين النموذج ========================
  _clearForm() {
    this.state.currentEditId = null;
    this.dom.form.reset();
    
    if (this.dom.att_date) {
      this.dom.att_date.value = new Date().toISOString().split('T')[0];
    }
    
    this.dom.saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ';
    this.dom.saveBtn.classList.remove('btn-secondary');
    this.dom.saveBtn.classList.add('btn-primary');
    
    this.dom.emp_id.focus();
  }

  // ======================== 💬 عرض التنبيهات ========================
  _showAlert(message, type = 'info') {
    // إزالة الإشعارات القديمة
    const oldAlerts = document.querySelectorAll('.custom-alert');
    oldAlerts.forEach(alert => alert.remove());

    // إنشاء إشعار جديد
    const alertDiv = document.createElement('div');
    alertDiv.className = `custom-alert alert-${type}`;
    alertDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      padding: 15px 20px;
      border-radius: 10px;
      color: white;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: fadeIn 0.3s ease;
      min-width: 300px;
      max-width: 400px;
    `;
    
    const bgColor = type === 'success' ? '#28a745' : 
                   type === 'danger' ? '#dc3545' : 
                   type === 'warning' ? '#ffc107' : '#17a2b8';
    
    alertDiv.style.backgroundColor = bgColor;
    
    const icon = type === 'success' ? '✅' : 
                type === 'danger' ? '❌' : 
                type === 'warning' ? '⚠️' : 'ℹ️';
    
    alertDiv.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 1.2rem;">${icon}</span>
        <span style="flex: 1;">${message}</span>
        <button onclick="this.parentElement.parentElement.remove()" 
                style="background: none; border: none; color: white; cursor: pointer; font-size: 1.2rem;">
          ×
        </button>
      </div>
    `;
    
    document.body.appendChild(alertDiv);
    
    // إزالة الإشعار تلقائياً بعد 5 ثواني
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.remove();
      }
    }, 5000);
  }

  // ======================== 📅 تنسيق التاريخ ========================
  _formatDate(dateString) {
    if (!dateString) return '-';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
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
let attendanceApp;

document.addEventListener("DOMContentLoaded", function() {
  attendanceApp = new AttendanceApp();
  
  // إضافة أنماط CSS للإشعارات
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .connection-status {
      position: fixed;
      top: 10px;
      left: 10px;
      background: white;
      padding: 8px 12px;
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      z-index: 1000;
      font-size: 12px;
      border-left: 4px solid;
    }
    
    .loading-spinner {
      display: none;
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 9999;
    }
    
    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: #6c757d;
    }
    
    .empty-state i {
      font-size: 3rem;
      margin-bottom: 15px;
      opacity: 0.5;
    }
    
    .actions {
      display: flex;
      gap: 8px;
      justify-content: center;
    }
    
    .actions button {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1.1rem;
      padding: 6px 8px;
      border-radius: 6px;
      transition: all 0.3s ease;
    }
    
    .actions button:hover {
      background-color: rgba(0, 0, 0, 0.1);
      transform: scale(1.1);
    }
    
    .edit-btn {
      color: #5d7fe3;
    }
    
    .delete-btn {
      color: #f72585;
    }
    
    .badge {
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    
    .bg-success { background-color: rgba(40, 167, 69, 0.2); color: #28a745; }
    .bg-danger { background-color: rgba(220, 53, 69, 0.2); color: #dc3545; }
    .bg-warning { background-color: rgba(255, 193, 7, 0.2); color: #ffc107; }
    .bg-info { background-color: rgba(23, 162, 184, 0.2); color: #17a2b8; }
    .bg-secondary { background-color: rgba(108, 117, 125, 0.2); color: #6c757d; }
  `;
  document.head.appendChild(style);
});

// جعل الكائن متاحاً عالمياً للاستدعاء من HTML
window.attendanceApp = attendanceApp;