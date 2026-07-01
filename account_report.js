// account_report.js - Frontend for Account Reports with Supabase Only
class AccountReportsApp {
  constructor() {
    this.SUPABASE_URL = 'https://rvjacvrrpguehbapvewe.supabase.co';
    this.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2amFjdnJycGd1ZWhiYXB2ZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMjUxNTksImV4cCI6MjA3ODYwMTE1OX0.wSavKzxKOF7-56G-pzDMtbXNrCNAbGs0wvadw-cilBg';
    
    this.supabase = null;
    this.state = {
      currentReport: 'account-statement',
      accounts: [],
      accountTypes: [],
      reportData: null,
      filters: {
        // كشف حساب مفصل
        account_id: '',
        start_date: '',
        end_date: '',
        show_zero_balance: false,
        
        // كشف إجمالي
        account_type_id: '',
        show_inactive: false,
        balance_filter: '',
        
        // حركات اليومية
        entry_number: ''
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
      console.error('❌ فشل في تهيئة Supabase:', error);
      return null;
    }
  }

  // ======================== 🏗️ تهيئة DOM ========================
  _initDOM() {
    const dom = {
      // عناصر التبويب
      reportTabs: document.querySelectorAll('[data-report]'),
      
      // الفلاتر العامة
      reportType: document.getElementById("reportType"),
      
      // فلاتر كشف الحساب
      accountId: document.getElementById("accountId"),
      startDate: document.getElementById("startDate"),
      endDate: document.getElementById("endDate"),
      showZeroBalance: document.getElementById("showZeroBalance"),
      
      // فلاتر كشف الإجمالي
      accountTypeId: document.getElementById("accountTypeId"),
      showInactive: document.getElementById("showInactive"),
      balanceFilter: document.getElementById("balanceFilter"),
      
      // فلاتر اليومية
      journalEntryNumber: document.getElementById("journalEntryNumber"),
      journalAccountId: document.getElementById("journalAccountId"),
      journalStartDate: document.getElementById("journalStartDate"),
      journalEndDate: document.getElementById("journalEndDate"),
      
      // أزرار
      generateBtn: document.getElementById("generateBtn"),
      printBtn: document.getElementById("printBtn"),
      exportBtn: document.getElementById("exportBtn"),
      
      // عناصر العرض
      reportResults: document.getElementById("reportResults"),
      loading: document.getElementById("loading"),
      reportTitle: document.getElementById("reportTitle"),
      connectionStatus: document.getElementById("connectionStatus")
    };

    // ✅ إضافة شريط حالة الاتصال ديناميكياً إذا لم يكن موجوداً
    if (!dom.connectionStatus) {
      const connectionStatus = document.createElement('div');
      connectionStatus.id = 'connectionStatus';
      connectionStatus.className = 'connection-status';
      connectionStatus.innerHTML = '🌐 متصل بـ Online';
      document.body.appendChild(connectionStatus);
      dom.connectionStatus = connectionStatus;
    }

    return dom;
  }

  // ======================== 🎯 إعداد مستمعي الأحداث ========================
  _setupEventListeners() {
    // تبديل التقارير
    this.dom.reportTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const reportType = tab.getAttribute('data-report');
        this._switchReport(reportType);
      });
    });

    // زر إنشاء التقرير
    if (this.dom.generateBtn) {
      this.dom.generateBtn.addEventListener('click', () => this._generateReport());
    }

    // زر الطباعة
    if (this.dom.printBtn) {
      this.dom.printBtn.addEventListener('click', () => this._printReport());
    }

    // زر التصدير
    if (this.dom.exportBtn) {
      this.dom.exportBtn.addEventListener('click', () => this._exportReport());
    }

    // تفعيل Enter في حقول البحث
    const searchFields = [
      this.dom.startDate, this.dom.endDate,
      this.dom.journalStartDate, this.dom.journalEndDate,
      this.dom.journalEntryNumber
    ];

    searchFields.forEach(field => {
      if (field) {
        field.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this._generateReport();
          }
        });
      }
    });
  }

  // ======================== 🚀 تهيئة التطبيق ========================
  async init() {
    await this._loadAccounts();
    await this._loadAccountTypes();
    this._setDefaultDates();
    this._renderAccountDropdowns();
    this._showAlert('✅ تم تهيئة نظام التقارير المالية', 'success');
  }

  // ======================== 🔄 تبديل نوع التقرير ========================
  _switchReport(reportType) {
    this.state.currentReport = reportType;
    
    // تحديث التبويبات النشطة
    this.dom.reportTabs.forEach(tab => {
      if (tab.getAttribute('data-report') === reportType) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // إخفاء جميع أقسام الفلاتر
    document.querySelectorAll('.filter-section').forEach(section => {
      section.style.display = 'none';
    });

    // إظهار الفلاتر المناسبة
    const targetSection = document.getElementById(`${reportType}-filters`);
    if (targetSection) {
      targetSection.style.display = 'block';
    }
    
    // تحديث عنوان التقرير
    this._updateReportTitle(reportType);
    
    // مسح النتائج السابقة
    this.dom.reportResults.innerHTML = '';
  }

  // ======================== 📝 تحديث عنوان التقرير ========================
  _updateReportTitle(reportType) {
    const titles = {
      'account-statement': 'كشف حساب مفصل',
      'accounts-summary': 'كشف إجمالي للحسابات',
      'journal-ledger': 'كشف اليومية'
    };
    if (this.dom.reportTitle) {
      this.dom.reportTitle.textContent = titles[reportType] || 'التقارير المالية';
    }
  }

  // ======================== 📅 تعيين التواريخ الافتراضية ========================
  _setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    const firstDay = new Date();
    firstDay.setDate(1);
    
    const dateFields = [
      this.dom.startDate, this.dom.endDate,
      this.dom.journalStartDate, this.dom.journalEndDate
    ];
    
    dateFields.forEach(field => {
      if (field) {
        if (field.id.includes('start') || field.id.includes('Start')) {
          field.value = firstDay.toISOString().split('T')[0];
        } else {
          field.value = today;
        }
      }
    });
  }

  // ======================== 📥 تحميل الحسابات ========================
  async _loadAccounts() {
    try {
      console.log('🔄 جاري جلب الحسابات من Supabase');
      
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const { data, error } = await this.supabase
        .from('accounts')
        .select('*')
        .order('account_id');
      
      if (error) throw error;
      
      this.state.accounts = data || [];
      console.log(`✅ تم تحميل ${this.state.accounts.length} حساب من Supabase`);
      
    } catch (error) {
      console.error("❌ خطأ في تحميل الحسابات:", error);
      this._showAlert("خطأ في تحميل الحسابات من قاعدة البيانات", "danger");
    }
  }

  // ======================== 📥 تحميل أنواع الحسابات ========================
  async _loadAccountTypes() {
    try {
      console.log('🔄 جاري جلب أنواع الحسابات من Supabase');
      
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const { data, error } = await this.supabase
        .from('account_types')
        .select('*')
        .order('account_type_id');
      
      if (error) throw error;
      
      this.state.accountTypes = data || [];
      console.log(`✅ تم تحميل ${this.state.accountTypes.length} نوع حساب من Supabase`);
      this._renderAccountTypesDropdown();
      
    } catch (error) {
      console.error("❌ خطأ في تحميل أنواع الحسابات:", error);
      this._showAlert("خطأ في تحميل أنواع الحسابات من قاعدة البيانات", "danger");
    }
  }

  // ======================== 🎨 عرض أنواع الحسابات في Dropdown ========================
  _renderAccountTypesDropdown() {
    if (this.dom.accountTypeId) {
      this.dom.accountTypeId.innerHTML = `
        <option value="">جميع أنواع الحسابات</option>
        ${this.state.accountTypes.map(type => `
          <option value="${type.account_type_id}">${this._escapeHtml(type.account_type_name)}</option>
        `).join('')}
      `;
    }
  }

  // ======================== 🎨 عرض الحسابات في Dropdown ========================
  _renderAccountDropdowns() {
    const accountDropdowns = [this.dom.accountId, this.dom.journalAccountId];
    
    accountDropdowns.forEach(dropdown => {
      if (dropdown) {
        dropdown.innerHTML = `
          <option value="">اختر الحساب</option>
          ${this.state.accounts.map(account => `
            <option value="${account.account_id}">
              ${this._escapeHtml(account.account_code)} - ${this._escapeHtml(account.account_name)}
            </option>
          `).join('')}
        `;
      }
    });
  }

  // ======================== 🚀 إنشاء التقرير ========================
  async _generateReport() {
    this._setLoading(true);
    
    try {
      // التحقق من اختيار الحساب لتقرير كشف الحساب المفصل
      if (this.state.currentReport === 'account-statement') {
        if (!this.dom.accountId || !this.dom.accountId.value) {
          this._showAlert('يرجى اختيار حساب من القائمة', 'warning');
          this._setLoading(false);
          return;
        }
      }

      const filters = this._getCurrentFilters();
      const reportData = await this._generateReportFromSupabase(filters);

      if (reportData) {
        this.state.reportData = reportData;
        this._renderReport();
        this._showAlert('✅ تم إنشاء التقرير بنجاح', 'success');
      } else {
        this._showAlert("❌ لم يتم العثور على بيانات", "warning");
      }
    } catch (error) {
      console.error("❌ خطأ في إنشاء التقرير:", error);
      this._showAlert(`❌ خطأ في إنشاء التقرير: ${error.message}`, "danger");
    } finally {
      this._setLoading(false);
    }
  }

  // ======================== ☁️ إنشاء التقرير من Supabase ========================
  async _generateReportFromSupabase(filters) {
    console.log('🔄 جاري إنشاء التقرير من Supabase:', this.state.currentReport);
    
    if (!this.supabase) {
      throw new Error('Supabase client not initialized');
    }

    switch (this.state.currentReport) {
      case 'account-statement':
        return await this._generateAccountStatementFromSupabase(filters);
      case 'accounts-summary':
        return await this._generateAccountsSummaryFromSupabase(filters);
      case 'journal-ledger':
        return await this._generateJournalLedgerFromSupabase(filters);
      default:
        throw new Error('نوع التقرير غير معروف');
    }
  }

  // ======================== ☁️ كشف حساب مفصل من Supabase ========================
  async _generateAccountStatementFromSupabase(filters) {
    if (!filters.account_id) {
      throw new Error('يرجى اختيار حساب');
    }

    // جلب بيانات الحساب
    const { data: accountData, error: accountError } = await this.supabase
      .from('accounts')
      .select('*')
      .eq('account_id', filters.account_id)
      .single();

    if (accountError) throw accountError;

    // جلب الحركات
    let query = this.supabase
      .from('account_transactions')
      .select('*')
      .eq('account_id', filters.account_id);

    if (filters.start_date) {
      query = query.gte('transaction_date', filters.start_date);
    }

    if (filters.end_date) {
      query = query.lte('transaction_date', filters.end_date);
    }

    const { data: transactions, error: transactionsError } = await query.order('transaction_date', { ascending: true });

    if (transactionsError) throw transactionsError;

    // حساب الإجماليات
    const totals = {
      total_debit: transactions.reduce((sum, t) => sum + (parseFloat(t.debit_amount) || 0), 0),
      total_credit: transactions.reduce((sum, t) => sum + (parseFloat(t.credit_amount) || 0), 0)
    };

    const current_balance = totals.total_debit - totals.total_credit;

    return {
      account_info: {
        account_name: accountData.account_name || '',
        account_code: accountData.account_code || '',
        account_type: accountData.account_type || '',
        opening_balance: 0,
        current_balance: current_balance
      },
      transactions: transactions || [],
      totals: totals,
      period: {
        start_date: filters.start_date || '',
        end_date: filters.end_date || ''
      }
    };
  }

  // ======================== ☁️ كشف إجمالي من Supabase (مُعدّل) ========================
  async _generateAccountsSummaryFromSupabase(filters) {
      try {
          // بناء الاستعلام للحسابات
          let query = this.supabase
              .from('accounts')
              .select(`
                  *,
                  account_type:account_types(account_type_name)
              `);

          // تطبيق الفلاتر
          if (filters.account_type_id) {
              query = query.eq('account_type_id', filters.account_type_id);
          }

          if (!filters.show_inactive) {
              query = query.eq('is_active', true);
          }

          const { data: accounts, error: accountsError } = await query;

          if (accountsError) throw accountsError;

          // حساب الإجماليات وأعداد الحركات لكل حساب
          const accountsWithDetails = await Promise.all(
              accounts.map(async (account) => {
                  // جلب عدد الحركات لكل حساب
                  const { count: transactionCount, error: countError } = await this.supabase
                      .from('account_transactions')
                      .select('transaction_id', { count: 'exact', head: true })
                      .eq('account_id', account.account_id);

                  // جلب تاريخ آخر حركة
                  const { data: lastTransaction, error: lastTransError } = await this.supabase
                      .from('account_transactions')
                      .select('transaction_date')
                      .eq('account_id', account.account_id)
                      .order('transaction_date', { ascending: false })
                      .limit(1)
                      .single();

                  // حساب الرصيد الحالي
                  const { data: balanceData, error: balanceError } = await this.supabase
                      .from('account_transactions')
                      .select('debit_amount, credit_amount')
                      .eq('account_id', account.account_id);

                  let currentBalance = 0;
                  if (balanceData) {
                      const totalDebit = balanceData.reduce((sum, t) => sum + (parseFloat(t.debit_amount) || 0), 0);
                      const totalCredit = balanceData.reduce((sum, t) => sum + (parseFloat(t.credit_amount) || 0), 0);
                      currentBalance = totalDebit - totalCredit;
                  }

                  return {
                      account_id: account.account_id,
                      account_code: account.account_code,
                      account_name: account.account_name,
                      account_type_name: account.account_type?.account_type_name || account.account_type || 'غير محدد',
                      account_type_id: account.account_type_id,
                      is_active: account.is_active,
                      current_balance: currentBalance,
                      transaction_count: transactionCount || 0,
                      last_transaction_date: lastTransaction?.transaction_date || null,
                      debit_balance: currentBalance > 0 ? currentBalance : 0,
                      credit_balance: currentBalance < 0 ? Math.abs(currentBalance) : 0,
                      created_at: account.created_at
                  };
              })
          );

          // تطبيق فلتر الرصيد إذا تم اختياره
          let filteredAccounts = accountsWithDetails;
          if (filters.balance_filter) {
              filteredAccounts = accountsWithDetails.filter(account => {
                  switch (filters.balance_filter) {
                      case 'positive':
                          return account.current_balance > 0;
                      case 'negative':
                          return account.current_balance < 0;
                      case 'zero':
                          return account.current_balance === 0;
                      default:
                          return true;
                  }
              });
          }

          // حساب الإجماليات
          const totals = {
              total_accounts: filteredAccounts.length,
              total_debit: filteredAccounts.reduce((sum, a) => sum + (parseFloat(a.debit_balance) || 0), 0),
              total_credit: filteredAccounts.reduce((sum, a) => sum + (parseFloat(a.credit_balance) || 0), 0),
              total_balance: filteredAccounts.reduce((sum, a) => sum + (parseFloat(a.current_balance) || 0), 0)
          };

          return {
              accounts: filteredAccounts,
              totals: totals
          };

      } catch (error) {
          console.error("❌ خطأ في إنشاء كشف الإجمالي:", error);
          throw error;
      }
  }

  // ======================== ☁️ كشف اليومية من Supabase (مُعدّل) ========================
  async _generateJournalLedgerFromSupabase(filters) {
      // استعلام أساسي على جدول الحركات المالي (الموجود)
      let query = this.supabase
        .from('account_transactions') // ⬅️ استخدام الجدول الموجود
        .select('*')
        .gte('transaction_date', filters.journalStartDate || '1900-01-01')
        .lte('transaction_date', filters.journalEndDate || '2100-01-01');

      // فلتر برقم القيد إذا وُجد
      if (filters.entry_number) {
        query = query.eq('entry_number', filters.entry_number);
      }

      // فلتر بالحساب إذا وُجد
      if (filters.journalAccountId) {
        query = query.eq('account_id', filters.journalAccountId);
      }

      const { data: transactions, error } = await query.order('transaction_date', { ascending: true });

      if (error) throw error;

      // تجميع الحركات حسب رقم القيد
      const groupedByEntry = {};
      transactions.forEach(transaction => {
        const entryNum = transaction.entry_number;
        if (!groupedByEntry[entryNum]) {
          groupedByEntry[entryNum] = {
            entry_number: entryNum,
            transaction_date: transaction.transaction_date,
            transactions: []
          };
        }
        groupedByEntry[entryNum].transactions.push(transaction);
      });

      // تحويل الكائن إلى مصفوفة للعرض
      const journal_entries = Object.values(groupedByEntry);

      // حساب الإجماليات
      const totals = {
        total_debit: transactions.reduce((sum, t) => sum + (parseFloat(t.debit_amount) || 0), 0),
        total_credit: transactions.reduce((sum, t) => sum + (parseFloat(t.credit_amount) || 0), 0)
      };

      return {
        journal_entries: journal_entries,
        totals: totals,
        period: {
          start_date: filters.journalStartDate || '',
          end_date: filters.journalEndDate || ''
        }
      };
  }

  // ======================== 🎯 جمع الفلاتر الحالية ========================
  _getCurrentFilters() {
    const filters = {};
    
    switch (this.state.currentReport) {
      case 'account-statement':
        filters.account_id = this.dom.accountId?.value || '';
        filters.start_date = this.dom.startDate?.value || '';
        filters.end_date = this.dom.endDate?.value || '';
        filters.show_zero_balance = this.dom.showZeroBalance?.checked || false;
        break;

      case 'accounts-summary':
        filters.account_type_id = this.dom.accountTypeId?.value || '';
        filters.show_inactive = this.dom.showInactive?.checked || false;
        filters.balance_filter = this.dom.balanceFilter?.value || '';
        break;

      case 'journal-ledger':
        filters.journalStartDate = this.dom.journalStartDate?.value || '';
        filters.journalEndDate = this.dom.journalEndDate?.value || '';
        filters.entry_number = this.dom.journalEntryNumber?.value || '';
        filters.journalAccountId = this.dom.journalAccountId?.value || '';
        break;
    }

    return filters;
  }

  // ======================== 🎨 عرض التقرير ========================
  _renderReport() {
    const { reportData, currentReport } = this.state;
    
    if (!reportData) return;

    switch (currentReport) {
      case 'account-statement':
        this._renderAccountStatement();
        break;
      case 'accounts-summary':
        this._renderAccountsSummary();
        break;
      case 'journal-ledger':
        this._renderJournalLedger();
        break;
    }
  }

  // ======================== 📊 عرض كشف حساب مفصل ========================
  _renderAccountStatement() {
    const { account_info, transactions, totals, period } = this.state.reportData;
    
    let html = `
      <div class="report-header mb-4 p-3 bg-light rounded">
        <div class="row">
          <div class="col-md-6">
            <h5>${this._escapeHtml(account_info.account_name)}</h5>
            <p class="mb-1"><strong>كود الحساب:</strong> ${this._escapeHtml(account_info.account_code)}</p>
            <p class="mb-1"><strong>نوع الحساب:</strong> ${this._escapeHtml(account_info.account_type)}</p>
          </div>
          <div class="col-md-6 text-start">
            <p class="mb-1"><strong>الفترة:</strong> ${period.start_date} إلى ${period.end_date}</p>
            <p class="mb-1"><strong>الرصيد الافتتاحي:</strong> ${account_info.opening_balance.toLocaleString()}</p>
            <p class="mb-1"><strong>الرصيد الختامي:</strong> ${account_info.current_balance.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div class="table-responsive">
        <table class="table table-bordered table-hover">
          <thead class="table-light">
            <tr>
              <th>#</th>
              <th>التاريخ</th>
              <th>رقم القيد</th>
              <th>الوصف</th>
              <th>مدين</th>
              <th>دائن</th>
              <th>الرصيد</th>
            </tr>
          </thead>
          <tbody>
    `;

    // رصيد افتتاحي
    html += `
      <tr class="table-info">
        <td>0</td>
        <td>${period.start_date}</td>
        <td>-</td>
        <td><strong>رصيد افتتاحي</strong></td>
        <td></td>
        <td></td>
        <td><strong>${account_info.opening_balance.toLocaleString()}</strong></td>
      </tr>
    `;

    // الحركات
    let runningBalance = account_info.opening_balance;
    
    transactions.forEach((transaction, index) => {
      const debit = parseFloat(transaction.debit_amount) || 0;
      const credit = parseFloat(transaction.credit_amount) || 0;
      runningBalance += (debit - credit);
      
      html += `
        <tr>
          <td>${index + 1}</td>
          <td>${new Date(transaction.transaction_date).toLocaleDateString('ar-EG')}</td>
          <td>${this._escapeHtml(transaction.entry_number)}</td>
          <td>${this._escapeHtml(transaction.line_description)}</td>
          <td class="text-success fw-bold">${debit > 0 ? debit.toLocaleString() : ''}</td>
          <td class="text-danger fw-bold">${credit > 0 ? credit.toLocaleString() : ''}</td>
          <td class="fw-bold ${runningBalance >= 0 ? 'text-success' : 'text-danger'}">
            ${runningBalance.toLocaleString()}
          </td>
        </tr>
      `;
    });

    // الإجماليات
    html += `
          </tbody>
          <tfoot class="table-secondary">
            <tr>
              <td colspan="4" class="text-end"><strong>الإجمالي:</strong></td>
              <td class="text-success fw-bold">${totals.total_debit.toLocaleString()}</td>
              <td class="text-danger fw-bold">${totals.total_credit.toLocaleString()}</td>
              <td class="fw-bold ${account_info.current_balance >= 0 ? 'text-success' : 'text-danger'}">
                ${account_info.current_balance.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    this.dom.reportResults.innerHTML = html;
  }

  // ======================== 📈 عرض كشف إجمالي للحسابات ========================
  _renderAccountsSummary() {
    const { accounts, totals } = this.state.reportData;
    
    let html = `
      <div class="report-summary mb-4">
        <div class="row">
          <div class="col-md-3">
            <div class="card text-white bg-primary">
              <div class="card-body">
                <h5>${totals.total_accounts}</h5>
                <p>إجمالي الحسابات</p>
              </div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="card text-white bg-success">
              <div class="card-body">
                <h5>${totals.total_debit.toLocaleString()}</h5>
                <p>إجمالي المدين</p>
              </div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="card text-white bg-danger">
              <div class="card-body">
                <h5>${totals.total_credit.toLocaleString()}</h5>
                <p>إجمالي الدائن</p>
              </div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="card text-white bg-info">
              <div class="card-body">
                <h5>${totals.total_balance.toLocaleString()}</h5>
                <p>صافي الرصيد</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="table-responsive">
        <table class="table table-bordered table-hover">
          <thead class="table-light">
            <tr>
              <th>كود الحساب</th>
              <th>اسم الحساب</th>
              <th>نوع الحساب</th>
              <th>الرصيد</th>
              <th>عدد الحركات</th>
              <th>آخر حركة</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
    `;

    accounts.forEach(account => {
      const balance = parseFloat(account.current_balance) || 0;
      html += `
        <tr>
          <td>${this._escapeHtml(account.account_code)}</td>
          <td>${this._escapeHtml(account.account_name)}</td>
          <td>${this._escapeHtml(account.account_type_name)}</td>
          <td class="fw-bold ${balance >= 0 ? 'text-success' : 'text-danger'}">
            ${balance.toLocaleString()}
          </td>
          <td>${account.transaction_count}</td>
          <td>${account.last_transaction_date ? new Date(account.last_transaction_date).toLocaleDateString('ar-EG') : 'لا توجد'}</td>
          <td>
            <span class="badge ${account.is_active ? 'bg-success' : 'bg-secondary'}">
              ${account.is_active ? 'نشط' : 'غير نشط'}
            </span>
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    this.dom.reportResults.innerHTML = html;
  }

  // ======================== 📋 عرض كشف اليومية ========================
  _renderJournalLedger() {
    const { journal_entries, totals, period } = this.state.reportData;
    
    let html = `
      <div class="report-header mb-4 p-3 bg-light rounded">
        <div class="row">
          <div class="col-md-6">
            <h5>كشف اليومية العامة</h5>
          </div>
          <div class="col-md-6 text-start">
            <p class="mb-1"><strong>الفترة:</strong> ${period.start_date} إلى ${period.end_date}</p>
            <p class="mb-1"><strong>إجمالي المدين:</strong> ${totals.total_debit.toLocaleString()}</p>
            <p class="mb-1"><strong>إجمالي الدائن:</strong> ${totals.total_credit.toLocaleString()}</p>
          </div>
        </div>
      </div>
    `;

    journal_entries.forEach(entry => {
      html += `
        <div class="journal-entry mb-4">
          <div class="card">
            <div class="card-header bg-primary text-white">
              <strong>رقم القيد: ${this._escapeHtml(entry.entry_number)}</strong>
              <span class="float-start">التاريخ: ${new Date(entry.transaction_date).toLocaleDateString('ar-EG')}</span>
            </div>
            <div class="card-body p-0">
              <table class="table table-bordered mb-0">
                <thead class="table-light">
                  <tr>
                    <th>الحساب</th>
                    <th>الوصف</th>
                    <th>مدين</th>
                    <th>دائن</th>
                  </tr>
                </thead>
                <tbody>
      `;

      let entryDebit = 0;
      let entryCredit = 0;

      entry.transactions.forEach(transaction => {
        const debit = parseFloat(transaction.debit_amount) || 0;
        const credit = parseFloat(transaction.credit_amount) || 0;
        entryDebit += debit;
        entryCredit += credit;
        
        html += `
          <tr>
            <td>${this._escapeHtml(transaction.account_code)} - ${this._escapeHtml(transaction.account_name)}</td>
            <td>${this._escapeHtml(transaction.line_description)}</td>
            <td class="text-success fw-bold">${debit > 0 ? debit.toLocaleString() : ''}</td>
            <td class="text-danger fw-bold">${credit > 0 ? credit.toLocaleString() : ''}</td>
          </tr>
        `;
      });

      html += `
                </tbody>
                <tfoot class="table-secondary">
                  <tr>
                    <td colspan="2" class="text-end"><strong>إجمالي القيد:</strong></td>
                    <td class="text-success fw-bold">${entryDebit.toLocaleString()}</td>
                    <td class="text-danger fw-bold">${entryCredit.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      `;
    });

    this.dom.reportResults.innerHTML = html;
  }

  // ======================== 🖨️ طباعة التقرير ========================
  _printReport() {
    if (!this.state.reportData) {
      this._showAlert("لا توجد بيانات للطباعة", "warning");
      return;
    }

    const printWindow = window.open('', '_blank');
    const printDate = new Date().toLocaleDateString('ar-EG');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
          <meta charset="UTF-8">
          <title>تقرير مالي</title>
          <style>
            @media print {
              @page { size: A4; margin: 1cm; }
              body { font-family: 'Arial', sans-serif; margin: 0; padding: 20px; }
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
            <div class="report-title">${this.dom.reportTitle.textContent}</div>
            <div class="print-date">تاريخ الطباعة: ${printDate}</div>
          </div>
          ${this.dom.reportResults.innerHTML}
      </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }

  // ======================== 📤 تصدير التقرير ========================
  _exportReport() {
    if (!this.state.reportData) {
      this._showAlert("لا توجد بيانات للتصدير", "warning");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    
    switch (this.state.currentReport) {
      case 'account-statement':
        csvContent += this._exportAccountStatement();
        break;
      case 'accounts-summary':
        csvContent += this._exportAccountsSummary();
        break;
      case 'journal-ledger':
        csvContent += this._exportJournalLedger();
        break;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${this.state.currentReport}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ======================== 📊 تصدير كشف حساب مفصل ========================
  _exportAccountStatement() {
    const { account_info, transactions, totals } = this.state.reportData;
    
    let csv = "كشف حساب مفصل\r\n";
    csv += `الحساب,${account_info.account_name}\r\n`;
    csv += `كود الحساب,${account_info.account_code}\r\n`;
    csv += `الرصيد الافتتاحي,${account_info.opening_balance}\r\n`;
    csv += `الرصيد الختامي,${account_info.current_balance}\r\n\r\n`;
    
    csv += "التاريخ,رقم القيد,الوصف,مدين,دائن,الرصيد\r\n";
    
    let runningBalance = account_info.opening_balance;
    csv += `,,"رصيد افتتاحي",,,${runningBalance}\r\n`;
    
    transactions.forEach(transaction => {
      const debit = parseFloat(transaction.debit_amount) || 0;
      const credit = parseFloat(transaction.credit_amount) || 0;
      runningBalance += (debit - credit);
      csv += `${transaction.transaction_date},${transaction.entry_number},${transaction.line_description},${debit},${credit},${runningBalance}\r\n`;
    });
    
    csv += `,,الإجمالي,${totals.total_debit},${totals.total_credit},${account_info.current_balance}\r\n`;
    
    return csv;
  }

  // ======================== 📊 تصدير كشف إجمالي ========================
  _exportAccountsSummary() {
    const { accounts, totals } = this.state.reportData;
    
    let csv = "كشف إجمالي للحسابات\r\n";
    csv += `إجمالي الحسابات,${totals.total_accounts}\r\n`;
    csv += `إجمالي المدين,${totals.total_debit}\r\n`;
    csv += `إجمالي الدائن,${totals.total_credit}\r\n`;
    csv += `صافي الرصيد,${totals.total_balance}\r\n\r\n`;
    
    csv += "كود الحساب,اسم الحساب,نوع الحساب,الرصيد,عدد الحركات,آخر حركة,الحالة\r\n";
    
    accounts.forEach(account => {
      csv += `${account.account_code},${account.account_name},${account.account_type_name},${account.current_balance},${account.transaction_count},${account.last_transaction_date || 'لا توجد'},${account.is_active ? 'نشط' : 'غير نشط'}\r\n`;
    });
    
    return csv;
  }

  // ======================== 📋 تصدير كشف اليومية ========================
  _exportJournalLedger() {
    const { journal_entries, totals } = this.state.reportData;
    
    let csv = "كشف اليومية العامة\r\n";
    csv += `إجمالي المدين,${totals.total_debit}\r\n`;
    csv += `إجمالي الدائن,${totals.total_credit}\r\n\r\n`;
    
    journal_entries.forEach(entry => {
      csv += `رقم القيد,${entry.entry_number}\r\n`;
      csv += `التاريخ,${entry.transaction_date}\r\n`;
      csv += "الحساب,الوصف,مدين,دائن\r\n";
      
      entry.transactions.forEach(transaction => {
        csv += `${transaction.account_code} - ${transaction.account_name},${transaction.line_description},${transaction.debit_amount},${transaction.credit_amount}\r\n`;
      });
      
      csv += "\r\n";
    });
    
    return csv;
  }

  // ======================== ⏳ تعيين حالة التحميل ========================
  _setLoading(loading) {
    this.state.isLoading = loading;
    if (this.dom.loading) {
      this.dom.loading.style.display = loading ? "block" : "none";
    }
  }

  // ======================== 💬 عرض التنبيهات ========================
  _showAlert(message, type) {
    const oldAlerts = document.querySelectorAll('.alert');
    oldAlerts.forEach(alert => alert.remove());

    const alertDiv = document.createElement("div");
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const container = document.querySelector(".container");
    if (container) {
      container.insertBefore(alertDiv, container.firstChild);
    }
    
    setTimeout(() => {
      if (alertDiv.parentElement) {
        alertDiv.remove();
      }
    }, 5000);
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
let accountReportsApp;
document.addEventListener("DOMContentLoaded", function() {
  accountReportsApp = new AccountReportsApp();
});