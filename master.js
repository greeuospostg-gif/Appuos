// ⚡ التهيئة العالمية
 const SUPABASE_CONFIG = {
    url: 'https://rvjacvrrpguehbapvewe.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2amFjdnJycGd1ZWhiYXB2ZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMjUxNTksImV4cCI6MjA3ODYwMTE1OX0.wSavKzxKOF7-56G-pzDMtbXNrCNAbGs0wvadw-cilBg'
  };

// 🎯 فئة إدارة الاتصال بـ Supabase
class SupabaseManager {
  constructor() {
    this.client = null;
    this.initialize();
  }

  initialize() {
    try {
      this.client = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      });
      console.log('✅ Supabase Manager initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Supabase:', error);
    }
  }

  async fetchFromTable(table, query = {}) {
    if (!this.client) this.initialize();
    
    let queryBuilder = this.client.from(table).select('*');
    
    // تطبيق شروط WHERE
    if (query.where && Object.keys(query.where).length > 0) {
      Object.entries(query.where).forEach(([key, value]) => {
        // معالجة القيم null
        if (value === null || value === undefined) {
          queryBuilder = queryBuilder.is(key, null);
        } else {
          queryBuilder = queryBuilder.eq(key, value);
        }
      });
    }
    
    // تطبيق الترتيب
    if (query.orderBy) {
      queryBuilder = queryBuilder.order(query.orderBy.column, { 
        ascending: query.orderBy.ascending !== false 
      });
    }
    
    // تطبيق الحد
    if (query.limit) {
      queryBuilder = queryBuilder.limit(query.limit);
    }
    
    const { data, error } = await queryBuilder;
    
    if (error) {
      // ❌ لا ترمي Error، بل أعد مصفوفة فارغة
      console.error(`❌ Error fetching from ${table}:`, error);
      
      // إذا كان خطأ 406، فهذا يعني الجدول غير موجود
      if (error.code === '406') {
        console.warn(`⚠️ Table ${table} might not exist or has RLS issues`);
      }
      
      return []; // إرجاع مصفوفة فارغة بدلاً من رمي Error
    }
    
    return data || [];
  }

  async fetchSingle(table, conditions) {
    if (!this.client) this.initialize();
    
    try {
      // أولاً: استخدم limit(1) بدلاً من single()
      const { data, error } = await this.client
        .from(table)
        .select('*')
        .match(conditions)
        .limit(1);  // ❌ تغيير من .single() إلى .limit(1)
      
      if (error) {
        console.error(`❌ Error fetching from ${table}:`, error);
        return null;
      }
      
      // إرجاع أول عنصر أو null
      return data && data.length > 0 ? data[0] : null;
      
    } catch (error) {
      console.error(`❌ Error in fetchSingle from ${table}:`, error);
      return null;
    }
  }

  async upsert(table, data, conflictColumns = []) {
    if (!this.client) this.initialize();
    
    try {
      const options = {};
      if (conflictColumns.length > 0) {
        options.onConflict = conflictColumns.join(',');
      }
      
      const { data: result, error } = await this.client
        .from(table)
        .upsert(data, options);
      
      if (error) {
        console.error(`❌ Error upserting to ${table}:`, error);
        throw error;
      }
      
      return result;
    } catch (error) {
      console.error(`❌ Error in upsert to ${table}:`, error);
      throw error;
    }
  }

  async delete(table, conditions) {
    if (!this.client) this.initialize();
    
    try {
      const { error } = await this.client
        .from(table)
        .delete()
        .match(conditions);
      
      if (error) {
        console.error(`❌ Error deleting from ${table}:`, error);
        throw error;
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Error in delete from ${table}:`, error);
      throw error;
    }
  }

  async search(table, columns, searchTerm) {
    if (!this.client) this.initialize();
    
    try {
      // بناء شروط OR للبحث
      const orConditions = columns.map(col => `${col}.ilike.%${searchTerm}%`);
      
      const { data, error } = await this.client
        .from(table)
        .select('*')
        .or(orConditions.join(','));
      
      if (error) {
        console.error(`❌ Error searching in ${table}:`, error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error(`❌ Error in search in ${table}:`, error);
      throw error;
    }
  }

  // دالة مساعدة للاستعلام المعقد
  async customQuery(table, select = '*', filters = {}) {
    if (!this.client) this.initialize();
    
    try {
      let query = this.client.from(table).select(select);
      
      // تطبيق الفلاتر
      Object.entries(filters).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else {
          query = query.eq(key, value);
        }
      });
      
      const { data, error } = await query;
      
      if (error) {
        console.error(`❌ Error in custom query for ${table}:`, error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error(`❌ Error in customQuery for ${table}:`, error);
      throw error;
    }
  }

  // 🆕 استدعاء PostgreSQL Function
  async callFunction(functionName, params = {}) {
    if (!this.client) this.initialize();
    
    try {
      const { data, error } = await this.client.rpc(functionName, params);
      
      if (error) {
        console.error(`❌ Error calling function ${functionName}:`, error);
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error(`❌ Error in callFunction ${functionName}:`, error);
      throw error;
    }
  }
}

// 🎯 فئة إدارة الحسابات
class CalculationsManager {
  constructor(masterManager) {
    this.master = masterManager;
  }

  calc() {
    const q = +this.master.itemQty.value || 0;
    const p = +this.master.buyPrice.value || 0;
    const r = +this.master.rate.value || 0;
    const t = +(q * p).toFixed(2);
    
    this.master.totalPrice.value = isNaN(t) ? '' : t;
    
    if (r > 0 && p > 0) {
      const s = +(p + (p * r) / 100).toFixed(2);
      this.master.salePrice1.value = s;
      
      if (this.master.currentUnitType === 'package' && this.master.currentUnitsPerPackage > 0) {
        this.master.salePrice1Package.value = (s * this.master.currentUnitsPerPackage).toFixed(2);
      }
    }
  }

  calculateQuantities() {
    const pieceQty = parseFloat(this.master.itemQtyPiece.value) || 0;
    const packageQty = parseFloat(this.master.itemQtyPackage.value) || 0;
    const finalQty = this.master.currentUnitType === 'package' 
      ? pieceQty + packageQty * this.master.currentUnitsPerPackage 
      : pieceQty;
    
    this.master.itemQty.value = finalQty.toFixed(2);
    this.calc();
  }

  calculatePrices() {
    const piecePrice = parseFloat(this.master.buyPricePiece.value) || 0;
    const packagePrice = parseFloat(this.master.buyPricePackage.value) || 0;
    let finalPrice = piecePrice;

    if (this.master.currentUnitType === 'package' && this.master.currentUnitsPerPackage > 0) {
      if (packagePrice > 0) {
        finalPrice = packagePrice / this.master.currentUnitsPerPackage;
        if (this.master.buyPricePiece) this.master.buyPricePiece.value = finalPrice.toFixed(2);
      } else if (piecePrice > 0) {
        finalPrice = piecePrice;
        if (this.master.buyPricePackage) this.master.buyPricePackage.value = (piecePrice * this.master.currentUnitsPerPackage).toFixed(2);
      }
    }

    if (this.master.buyPrice) this.master.buyPrice.value = finalPrice.toFixed(2);

    const r = parseFloat(this.master.rate.value) || 0;
    if (r > 0 && finalPrice > 0) {
      const salePrice = +(finalPrice + finalPrice * r / 100).toFixed(2);
      if (this.master.salePrice1) this.master.salePrice1.value = salePrice.toFixed(2);
      if (this.master.salePrice1Piece) this.master.salePrice1Piece.value = salePrice.toFixed(2);
      if (this.master.currentUnitType === 'package' && this.master.currentUnitsPerPackage > 0 && this.master.salePrice1Package) {
        this.master.salePrice1Package.value = (salePrice * this.master.currentUnitsPerPackage).toFixed(2);
      }
    }
    
    this.calc();
    this.calculatePricesForSaleUnit();
  }

  calculatePricesForSaleUnit() {
    const units = parseFloat(this.master.unitsPerPackageEl.value) || 1;
    const piecePrice = parseFloat(this.master.salePrice1Piece.value) || 0;
    const packagePrice = parseFloat(this.master.salePrice1Package.value) || 0;
    let finalPiece = piecePrice;
    let finalPackage = packagePrice;

    if (packagePrice > 0 && units > 0) {
      finalPiece = packagePrice / units;
      if (this.master.salePrice1Piece) this.master.salePrice1Piece.value = finalPiece.toFixed(2);
    }

    if (piecePrice > 0 && units > 0) {
      finalPackage = piecePrice * units;
      if (this.master.salePrice1Package) this.master.salePrice1Package.value = finalPackage.toFixed(2);
    }

    if (this.master.salePrice2) this.master.salePrice2.value = finalPackage.toFixed(2);

    if (this.master.saleUnitEl && this.master.salePrice1) {
      if (this.master.saleUnitEl.value === 'piece') {
        this.master.salePrice1.value = finalPiece.toFixed(2);
      } else {
        this.master.salePrice1.value = "";
      }
    }
  }

  convertUnits() {
    const fromQty = parseFloat(this.master.convertFromQty.value) || 0;
    const fromUnit = this.master.convertFromUnit.value;
    const toUnit = this.master.convertToUnit.value;
    
    if (!fromQty) {
      this.master.showToast('⚠️ أدخل الكمية للتحويل');
      return;
    }
    
    let result = fromQty;
    
    if (fromUnit === 'piece' && toUnit === 'package') {
      result = fromQty / this.master.currentUnitsPerPackage;
    } else if (fromUnit === 'package' && toUnit === 'piece') {
      result = fromQty * this.master.currentUnitsPerPackage;
    }
    
    if (this.master.convertToQty) this.master.convertToQty.value = result.toFixed(2);
    if (this.master.conversionResult) {
      this.master.conversionResult.textContent = 
        `${fromQty} ${fromUnit === 'piece' ? 'قطعة' : 'علبة'} = ${result.toFixed(2)} ${toUnit === 'piece' ? 'قطعة' : 'علبة'}`;
    }
  }
}

// 🎯 الفئة الرئيسية
class MasterManager {
  constructor() {
    this.supabase = new SupabaseManager();
    this.calculations = new CalculationsManager(this);
    
    this.cache();
    this.currentUnitsPerPackage = 1;
    this.currentUnitType = 'piece';
    this.currentItemName = '';
    this.editKey = null;
    this.allData = [];
    
    this.bindMethods();
    this.init();
  }

  // 🔧 الطرق الأساسية
  cache() {
    this.form = document.getElementById('masterForm');
    this.tbody = document.querySelector('#masterTable tbody');
    this.toast = document.getElementById('toast');
    this.importBtn = document.getElementById('importBtn');
    this.importInput = document.getElementById('importInput');
    this.exportBtn = document.getElementById('exportBtn');
    this.searchBox = document.getElementById('searchBox');
    this.itemsCount = document.getElementById('itemsCount');
    this.storeSelect = document.getElementById('store_id');
    this.supplierSelect = document.getElementById('supplierid');
    this.itemIdInput = document.getElementById('item_id');
    this.itemNameInput = document.getElementById('item_nm');
    
    this.unitsPerPackageEl = document.getElementById('units_per_package');
    this.unitTypeEl = document.getElementById('unit_type');
    this.saleUnitEl = document.getElementById('sale_unit');
    this.convFactorEl = document.getElementById('conversion_factor');
    this.itemQtyPiece = document.getElementById('item_qty_piece');
    this.itemQtyPackage = document.getElementById('item_qty_package');
    this.itemQty = document.getElementById('item_qty');
    this.buyPricePiece = document.getElementById('buy_price_piece');
    this.buyPricePackage = document.getElementById('buy_price_package');
    this.buyPrice = document.getElementById('buy_price');
    this.totalPrice = document.getElementById('total_price');
    this.rate = document.getElementById('rate');
    this.salePrice1Piece = document.getElementById('sale_price1_piece');
    this.salePrice1Package = document.getElementById('sale_price1_package');
    this.salePrice1 = document.getElementById('sale_price1');
    this.salePrice2 = document.getElementById('sale_price2');
    this.salePrice3 = document.getElementById('sale_price3');
    this.convertFromQty = document.getElementById('convert_from_qty');
    this.convertFromUnit = document.getElementById('convert_from_unit');
    this.convertToQty = document.getElementById('convert_to_qty');
    this.convertToUnit = document.getElementById('convert_to_unit');
    this.conversionResult = document.getElementById('conversion_result');
    this.tranDate = document.getElementById('tran_date');
    this.supplierId = document.getElementById('supplierid');
    this.mndop = document.getElementById('mndop');
    this.buyPriceField = document.getElementById('buy_price');
    this.saveBtn = document.getElementById('saveBtn');
    this.itemStatus = document.getElementById('itemStatus');
    this.searchBtn = document.getElementById('searchBtn');
    this.showAllBtn = document.getElementById('showAllBtn');
    this.lowStockBtn = document.getElementById('lowStockBtn');
    this.pageSizeSelector = document.getElementById('pageSizeSelector');
  }

  bindMethods() {
    this.showToast = this.showToast.bind(this);
    this.setDateNow = this.setDateNow.bind(this);
    this.formatDateForInput = this.formatDateForInput.bind(this);
    this.formatDateForServer = this.formatDateForServer.bind(this);
    this.updateUnitDisplays = this.updateUnitDisplays.bind(this);
    this.loadOptions = this.loadOptions.bind(this);
    this.loadData = this.loadData.bind(this);
    this.searchItems = this.searchItems.bind(this);
    this.loadLowStockAlerts = this.loadLowStockAlerts.bind(this);
    this.render = this.render.bind(this);
    this.fillFormWithItemData = this.fillFormWithItemData.bind(this);
    this.clearForm = this.clearForm.bind(this);
    this.saveHandler = this.saveHandler.bind(this);
    this.editRow = this.editRow.bind(this);
    this.delRow = this.delRow.bind(this);
    this.handleImport = this.handleImport.bind(this);
    this.handleExport = this.handleExport.bind(this);
    this.setupEnterNavigation = this.setupEnterNavigation.bind(this);
    this.updateQuantityFields = this.updateQuantityFields.bind(this);
    this.updatePriceFields = this.updatePriceFields.bind(this);
    this.attachItemBlur = this.attachItemBlur.bind(this);
    this.loadItemData = this.loadItemData.bind(this);
    this.showItemStatus = this.showItemStatus.bind(this);
    this.updateConnectionStatus = this.updateConnectionStatus.bind(this);
    
    // 🆕 ربط الدوال الجديدة
    this.validateItemBeforeSave = this.validateItemBeforeSave.bind(this);
    this.showItemValidationDialog = this.showItemValidationDialog.bind(this);
    this.addItemViaFunction = this.addItemViaFunction.bind(this);
    this.addItemToMasterTable = this.addItemToMasterTable.bind(this);
    this.openAddItemForm = this.openAddItemForm.bind(this);
  }

  // 📊 طرق العرض والتحكم
  showToast(msg, time = 2000) {
    if (!this.toast) return;
    this.toast.textContent = msg;
    this.toast.style.display = 'block';
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => (this.toast.style.display = 'none'), time);
  }

  updateConnectionStatus() {
    const statusDiv = document.getElementById('connectionStatus');
    if (!statusDiv) return;
    statusDiv.innerHTML = `🌐 Online مباشر - ${this.allData.length} سجل`;
    statusDiv.className = 'connection-status supabase';
  }

  setDateNow() {
    const n = new Date();
    this.tranDate.value = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }

  formatDateForInput(dateString) {
    return dateString ? dateString.replace(/\//g, '-') : '';
  }

  formatDateForServer(dateString) {
    return dateString ? dateString.replace(/-/g, '/') : '';
  }

  // 🆕 دالة لعرض حوار التحقق من الصنف
  showItemValidationDialog(itemData) {
    return new Promise((resolve) => {
      const dialog = document.createElement('div');
      dialog.className = 'validation-dialog';
      dialog.innerHTML = `
        <div class="dialog-overlay" onclick="this.parentElement.remove(); resolve('cancel')"></div>
        <div class="dialog-content">
          <h3>⚠️ الصنف غير موجود</h3>
          <p>الصنف <strong>${itemData.item_id}</strong> غير موجود في جدول الأصناف.</p>
          <div class="dialog-options">
            <button class="btn-auto" data-choice="add_auto">
              ✅ إضافة تلقائية
            </button>
            <button class="btn-manual" data-choice="add_manual">
              📝 إضافة يدوية
            </button>
            <button class="btn-cancel" data-choice="cancel">
              ❌ إلغاء
            </button>
          </div>
        </div>
      `;
      
      document.body.appendChild(dialog);
      
      dialog.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const choice = e.target.dataset.choice;
          document.body.removeChild(dialog);
          resolve(choice);
        });
      });
    });
  }

  // 🆕 دالة للتحقق من الصنف قبل الحفظ
  async validateItemBeforeSave(itemData) {
    try {
      // 1. التحقق في Frontend أولاً
      const itemExists = await this.supabase.fetchSingle('items', { 
        item_id: itemData.item_id 
      });
      
      if (!itemExists) {
        // 2. سؤال المستخدم
        const userChoice = await this.showItemValidationDialog(itemData);
        
        switch(userChoice) {
          case 'add_auto':
            // 3. إضافة تلقائية
            try {
              await this.addItemViaFunction(itemData);
              return { valid: true, action: 'added_auto', message: 'تم إضافة الصنف تلقائياً' };
            } catch (error) {
              // إذا فشلت الـ Function، نستخدم الطريقة البديلة
              await this.addItemToMasterTable(itemData);
              return { valid: true, action: 'added_fallback', message: 'تم إضافة الصنف (بديل)' };
            }
            
          case 'add_manual':
            // فتح نموذج إضافة صنف
            this.openAddItemForm(itemData);
            return { valid: false, action: 'needs_manual', message: 'يرجى إضافة الصنف يدوياً' };
            
          case 'cancel':
            return { valid: false, action: 'cancelled', message: 'تم إلغاء العملية' };
            
          default:
            return { valid: false, action: 'cancelled', message: 'تم إلغاء العملية' };
        }
      }
      
      return { valid: true, action: 'exists', message: 'الصنف موجود بالفعل' };
      
    } catch (error) {
      console.error('خطأ في التحقق من الصنف:', error);
      return { valid: false, action: 'error', message: 'حدث خطأ في التحقق من الصنف' };
    }
  }

  // 🆕 دالة لإضافة الصنف عبر PostgreSQL Function
  async addItemViaFunction(itemData) {
    try {
      // إذا كانت الـ Function موجودة في Supabase
      const result = await this.supabase.callFunction('check_and_add_item', {
        p_item_id: itemData.item_id,
        p_item_nm: itemData.item_nm || `صنف ${itemData.item_id}`,
        p_unit_type: itemData.unit_type || 'piece',
        p_units_per_package: itemData.units_per_package || 1,
        p_sale_unit: itemData.sale_unit || 'piece'
      });
      
      return result;
    } catch (error) {
      console.error('❌ خطأ في إضافة الصنف عبر Function:', error);
      throw error;
    }
  }

  // 🆕 دالة لإضافة صنف جديد إلى جدول الأصناف (بديل)
  async addItemToMasterTable(itemData) {
    try {
      const newItem = {
        item_id: itemData.item_id,
        item_nm: itemData.item_nm || `صنف ${itemData.item_id}`,
        unit_type: itemData.unit_type || 'piece',
        units_per_package: itemData.units_per_package || 1,
        sale_unit: itemData.sale_unit || 'piece',
        category_id: '',
        barcode: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const result = await this.supabase.upsert('items', newItem, ['item_id']);
      
      if (result) {
        console.log('✅ تم إضافة الصنف إلى جدول items:', newItem);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ خطأ في إضافة الصنف إلى جدول items:', error);
      throw error;
    }
  }

  // 🆕 دالة لفتح نموذج إضافة صنف يدوي
  openAddItemForm(itemData) {
    // يمكن تنفيذ نموذج منبثق لإضافة الصنف
    const formHtml = `
      <div class="add-item-dialog">
        <div class="dialog-overlay"></div>
        <div class="dialog-content">
          <h3>📝 إضافة صنف جديد</h3>
          <p>يرجى إكمال بيانات الصنف ${itemData.item_id}</p>
          <form id="addItemForm">
            <div class="form-group">
              <label>اسم الصنف:</label>
              <input type="text" id="new_item_nm" value="${itemData.item_nm || ''}" required>
            </div>
            <div class="form-group">
              <label>نوع الوحدة:</label>
              <select id="new_unit_type">
                <option value="piece" ${itemData.unit_type === 'piece' ? 'selected' : ''}>قطعة</option>
                <option value="package" ${itemData.unit_type === 'package' ? 'selected' : ''}>علبة</option>
              </select>
            </div>
            <div class="form-group">
              <label>عدد القطع في العلبة:</label>
              <input type="number" id="new_units_per_package" value="${itemData.units_per_package || 1}" min="1">
            </div>
            <div class="form-buttons">
              <button type="submit" class="btn-save">💾 حفظ</button>
              <button type="button" class="btn-cancel">❌ إلغاء</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    const dialog = document.createElement('div');
    dialog.innerHTML = formHtml;
    document.body.appendChild(dialog);
    
    // معالجة إرسال النموذج
    const form = dialog.querySelector('#addItemForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const newItemData = {
        item_id: itemData.item_id,
        item_nm: dialog.querySelector('#new_item_nm').value,
        unit_type: dialog.querySelector('#new_unit_type').value,
        units_per_package: dialog.querySelector('#new_units_per_package').value || 1,
        sale_unit: 'piece',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      try {
        await this.addItemToMasterTable(newItemData);
        this.showToast('✅ تم إضافة الصنف بنجاح');
        document.body.removeChild(dialog);
        
        // تحديث اسم الصنف في النموذج الرئيسي
        if (this.itemNameInput) {
          this.itemNameInput.value = newItemData.item_nm;
        }
      } catch (error) {
        this.showToast('❌ فشل إضافة الصنف');
      }
    });
    
    // معالجة إلغاء
    dialog.querySelector('.btn-cancel').addEventListener('click', () => {
      document.body.removeChild(dialog);
    });
    
    dialog.querySelector('.dialog-overlay').addEventListener('click', () => {
      document.body.removeChild(dialog);
    });
  }

  // 🔄 طرق تحديث الواجهة
  updateUnitDisplays() {
    if (!this.unitTypeEl || !this.unitsPerPackageEl) return;
    
    const unitType = this.unitTypeEl.value;
    const unitsPerPackage = parseFloat(this.unitsPerPackageEl.value) || 1;
    if (this.convFactorEl) this.convFactorEl.value = unitsPerPackage;
    this.currentUnitsPerPackage = unitsPerPackage;
    this.currentUnitType = unitType;

    const packageFields = ['item_qty_package', 'buy_price_package', 'sale_price1_package'];
    const pieceFields = ['item_qty_piece', 'buy_price_piece', 'sale_price1_piece'];

    packageFields.forEach(id => {
      const el = document.getElementById(id);
      const label = document.querySelector(`label[for="${id}"]`);
      if (el) {
        el.style.display = unitType === 'package' ? 'block' : 'none';
        el.disabled = unitType !== 'package';
      }
      if (label) label.style.display = unitType === 'package' ? 'block' : 'none';
    });
    
    pieceFields.forEach(id => {
      const el = document.getElementById(id);
      const label = document.querySelector(`label[for="${id}"]`);
      if (el) {
        el.style.display = unitType === 'package' ? 'none' : 'block';
        el.disabled = unitType === 'package';
      }
      if (label) label.style.display = unitType === 'package' ? 'none' : 'block';
    });

    this.updateFieldSkipping();
    this.calculations.calculateQuantities();
    this.calculations.calculatePrices();
    this.calculations.calculatePricesForSaleUnit();
  }

  updateFieldSkipping() {
    if (!this.unitTypeEl) return;
    
    const unitType = this.unitTypeEl.value;
    const autoFields = ['item_qty', 'buy_price', 'total_price', 'sale_price1', 'conversion_factor'];
    const allFields = this.form ? [...this.form.querySelectorAll('input, select')] : [];
    
    allFields.forEach(field => {
      const id = field.id;
      field.style.background = '';
      field.tabIndex = 0;
      if (autoFields.includes(id)) {
        field.style.background = '#f0f8ff';
        field.tabIndex = -1;
      }
      if (unitType === 'package' && ['item_qty_piece', 'buy_price_piece', 'sale_price1_piece'].includes(id)) {
        field.tabIndex = -1;
      }
      if (unitType === 'piece' && ['item_qty_package', 'buy_price_package', 'sale_price1_package'].includes(id)) {
        field.tabIndex = -1;
      }
    });
  }

  updateQuantityFields(totalQty, unitType, unitsPerPackage) {
    const qty = parseFloat(totalQty) || 0;
    const units = parseFloat(unitsPerPackage) || 1;
    
    if (unitType === 'package') {
      const packages = Math.floor(qty / units);
      const pieces = qty % units;
      if (this.itemQtyPiece) this.itemQtyPiece.value = pieces;
      if (this.itemQtyPackage) this.itemQtyPackage.value = packages;
    } else {
      if (this.itemQtyPiece) this.itemQtyPiece.value = qty;
      if (this.itemQtyPackage) this.itemQtyPackage.value = 0;
    }
  }

  updatePriceFields(price, unitType, unitsPerPackage, priceType) {
    const priceVal = parseFloat(price) || 0;
    const units = parseFloat(unitsPerPackage) || 1;
    
    if (unitType === 'package') {
      if (priceType === 'buy') {
        if (this.buyPricePiece) this.buyPricePiece.value = priceVal;
        if (this.buyPricePackage) this.buyPricePackage.value = (priceVal * units).toFixed(2);
      } else if (priceType === 'sale') {
        if (this.salePrice1Piece) this.salePrice1Piece.value = priceVal;
        if (this.salePrice1Package) this.salePrice1Package.value = (priceVal * units).toFixed(2);
      }
    } else {
      if (priceType === 'buy') {
        if (this.buyPricePiece) this.buyPricePiece.value = priceVal;
        if (this.buyPricePackage) this.buyPricePackage.value = 0;
      } else if (priceType === 'sale') {
        if (this.salePrice1Piece) this.salePrice1Piece.value = priceVal;
        if (this.salePrice1Package) this.salePrice1Package.value = 0;
      }
    }
  }

  // 📂 طرق تحميل البيانات
  async loadOptions() {
    try {
      const [stores, suppliers] = await Promise.all([
        this.supabase.fetchFromTable('stores'),
        this.supabase.fetchFromTable('suppliers')
      ]);
      
      this.storeSelect.innerHTML = stores.map(s => 
        `<option value="${s.store_id}">${s.store_name || s.name || s.store_id}</option>`
      ).join('');
      
      this.supplierSelect.innerHTML = '<option value="">--اختر--</option>' + 
        suppliers.map(s => 
          `<option value="${s.supplierid}">${s.supplier_name || s.name || s.supplierid}</option>`
        ).join('');
        
    } catch (err) {
      console.error('loadOptions err', err);
      this.showToast('❌ خطأ في تحميل الخيارات');
    }
  }

  async loadData() {
    const statusDiv = document.getElementById('connectionStatus');
    if (statusDiv) {
      statusDiv.innerHTML = '🔄 جاري تحميل البيانات من Supabase... <span class="loading"></span>';
    }
    
    try {
      console.log('🔄 جاري تحميل البيانات من Supabase');

      // محاولة باستخدام fetchFromTable
      try {
        this.allData = await this.supabase.fetchFromTable('a_master', {
          orderBy: { column: 'tran_date', ascending: false }
        });
      } catch (fetchError) {
        // إذا فشل، حاول باستخدام client مباشرة
        console.warn('⚠️ Retrying with direct client query...');
        
        const { data, error } = await this.supabase.client
          .from('a_master')
          .select('*')
          .order('tran_date', { ascending: false });
        
        if (error) {
          console.error('❌ Direct query failed:', error);
          this.allData = [];
        } else {
          this.allData = data || [];
        }
      }
      
      console.log(`✅ تم تحميل ${this.allData.length} سجل من Supabase`);
      this.render();
      this.updateConnectionStatus();
      
    } catch (err) {
      console.error("❌ خطأ في تحميل البيانات من Supabase:", err);
      this.showToast('❌ فشل تحميل البيانات من Supabase');
      this.allData = [];
      this.render();
      this.updateConnectionStatus();
    }
  }

  async searchItems(query) {
    if (!query) return await this.loadData();
    
    try {
      this.allData = await this.supabase.search('a_master', ['item_id', 'item_nm'], query);
      this.render();
      this.showToast(`🔍 تم العثور على ${this.allData.length} نتيجة`);
    } catch (err) {
      console.error('خطأ في البحث:', err);
      this.showToast('❌ حدث خطأ أثناء البحث');
    }
  }

  async loadLowStockAlerts() {
    try {
      const data = await this.supabase.fetchFromTable('a_master');
      const alerts = (data || []).filter(item => {
        const itemQty = parseFloat(item.item_qty) || 0;
        const minQty = parseFloat(item.min_qty) || 0;
        return itemQty <= minQty;
      });
      
      this.displayAlerts(alerts);
    } catch (err) {
      console.error('خطأ في التنبيهات:', err);
      this.showToast('ℹ️ خاصية التنبيهات غير متاحة حالياً');
    }
  }

  displayAlerts(alerts) {
    const alertsList = document.getElementById('alertsList');
    const alertsPanel = document.getElementById('alertsPanel');
    if (!alertsList || !alertsPanel) return;
    
    if (!alerts || alerts.length === 0) {
      alertsList.innerHTML = '<p>🎉 لا توجد تنبيهات - الفروع جيد</p>';
    } else {
      alertsList.innerHTML = alerts.map(alert => `
        <div class="alert-item">
          <strong>${alert.item_id} - ${alert.item_nm}</strong><br>
          الفروع: ${alert.item_qty} | حد الطلب: ${alert.min_qty}
          <button class="btn-edit" onclick="master.editRow('${alert.store_id}','${alert.item_id}')" style="margin-right:10px;">✏️ تحديث</button>
        </div>
      `).join('');
      this.showToast(`📢 تم العثور على ${alerts.length} صنف منخفض الفروع`);
    }
    alertsPanel.style.display = 'block';
  }

  // 📝 طرق إدارة النماذج
  attachItemBlur() {
    if (!this.itemIdInput) return;
    
    this.itemIdInput.addEventListener('blur', async () => {
      const itemId = this.itemIdInput.value.trim();
      if (!itemId) return;
      
      try {
        const itemData = await this.supabase.safeQuery('items', { item_id: itemId }, { single: true });
        if (itemData) {
          this.itemNameInput.value = itemData.item_nm || '';
          this.currentItemName = itemData.item_nm || '';
          this.showItemStatus('✅ تم تحميل اسم الصنف', 'success');
        } else {
          this.itemNameInput.value = '';
          this.currentItemName = '';
          
          // 🆕 عرض رسالة تنبيه عند blur إذا كان الصنف غير موجود
          setTimeout(() => {
            if (!this.itemNameInput.value && this.itemIdInput.value) {
              this.showItemStatus('⚠️ الصنف غير موجود في جدول الأصناف', 'warning');
            }
          }, 300);
        }
      } catch (err) {
        console.error('خطأ في جلب بيانات الصنف:', err);
      }
    });
  }

  async loadItemData() {
    const itemId = this.itemIdInput.value.trim();
    const storeId = this.storeSelect.value;
    
    if (!itemId) {
      this.showItemStatus('⚠️ يرجى إدخال كود الصنف', 'warning');
      return;
    }

    try {
      // جلب بيانات الصنف من جدول items
      const itemData = await this.supabase.fetchSingle('items', { item_id: itemId });
      
      if (itemData) {
        this.itemNameInput.value = itemData.item_nm || '';
        this.currentItemName = itemData.item_nm || '';
        this.showItemStatus('✅ تم تحميل اسم الصنف', 'success');
      } else {
        this.itemNameInput.value = '';
        this.currentItemName = '';
        
        // 🆕 رسالة تأكيد للصنف غير موجود مع خيارات
        const confirmAdd = confirm(
          `⚠️ الصنف "${itemId}" غير موجود في جدول الأصناف.\n\n` +
          `هل تريد:\n` +
          `1️⃣ الاستمرار وإضافة الصنف جديد؟\n` +
          `2️⃣ تصحيح الكود؟\n\n` +
          `اضغط "موافق" للمتابعة، أو "إلغاء" لتصحيح الكود.`
        );
        
        if (confirmAdd) {
          this.showItemStatus('📝 سيتم إضافة صنف جديد - أكمل بيانات الصنف', 'warning');
          setTimeout(() => {
            if (this.itemNameInput) this.itemNameInput.focus();
          }, 100);
        } else {
          this.showItemStatus('❌ رجاءً تأكد من كود الصنف', 'error');
          this.itemIdInput.focus();
          this.itemIdInput.select();
          return;
        }
      }

      // جلب بيانات المخزون إذا تم اختيار المخزن
      if (storeId) {
        try {
          const masterData = await this.supabase.safeQuery('a_master', { 
              store_id: storeId, 
              item_id: itemId 
          }, { single: true });
                    
          if (masterData) {
            this.fillFormWithItemData(masterData);
            this.showItemStatus('✅ الصنف موجود في الفروع - يمكنك التحديث', 'success');
          } else {
            this.showItemStatus('📝 الصنف جديد على المخزن - يمكنك إضافته', 'warning');
          }
        } catch (error) {
          console.error('❌ خطأ في جلب بيانات المخزون:', error);
          this.showItemStatus('📝 الصنف جديد على المخزن - يمكنك إضافته', 'warning');
        }
      }
      
      // ضمان عرض اسم الصنف
      if (this.currentItemName && !this.itemNameInput.value) {
        this.itemNameInput.value = this.currentItemName;
      }
      
      // التركيز على الحقل التالي
      if (storeId) {
        setTimeout(() => {
          if (this.unitTypeEl) this.unitTypeEl.focus();
        }, 100);
      } else {
        setTimeout(() => {
          if (this.storeSelect) this.storeSelect.focus();
        }, 100);
      }
      
    } catch (err) {
      console.error('❌ خطأ في تحميل بيانات الصنف:', err);
      this.showItemStatus('⚠️ حدث خطأ في تحميل البيانات', 'warning');
    }
  }

  showItemStatus(msg, type) {
    if (!this.itemStatus) return;
    this.itemStatus.textContent = msg;
    this.itemStatus.className = 'item-status';
    this.itemStatus.style.display = 'block';
    this.itemStatus.classList.add(type === 'success' ? 'good-stock' : type === 'error' ? 'low-stock' : 'medium-stock');
  }

  fillFormWithItemData(data = {}) {
    try {
      console.log('🔄 تعبئة النموذج بالبيانات:', data);
      
      const formFields = [
        'tran_date', 'store_id', 'supplierid', 'mndop', 'item_id', 'item_nm',
        'item_qty', 'buy_price', 'total_price', 'rate', 'sale_price1', 'sale_price2', 'sale_price3',
        'tran_type', 'batch_no', 'expiry_date', 'min_qty', 'remarks',
        'unit_type', 'units_per_package', 'sale_unit', 'conversion_factor'
      ];

      formFields.forEach(key => {
        const el = document.getElementById(key);
        if (el && data[key] !== undefined && data[key] !== null) {
          if (key === 'tran_date' || key === 'expiry_date') {
            el.value = this.formatDateForInput(data[key]);
          } else {
            el.value = data[key];
          }
        }
      });

      if (data.item_qty !== undefined && data.unit_type) {
        this.updateQuantityFields(data.item_qty, data.unit_type, data.units_per_package);
      }

      if (data.buy_price !== undefined && data.unit_type) {
        this.updatePriceFields(data.buy_price, data.unit_type, data.units_per_package, 'buy');
      }

      if (data.sale_price1 !== undefined && data.unit_type) {
        this.updatePriceFields(data.sale_price1, data.unit_type, data.units_per_package, 'sale');
      }

    } catch (err) {
      console.error('fillFormWithItemData err', err);
    }
  }

  clearForm() {
    const storeId = this.storeSelect.value;
    const currentName = this.currentItemName;
    if (this.form) this.form.reset();
    if (storeId && this.storeSelect) this.storeSelect.value = storeId;
    if (currentName && this.itemNameInput) this.itemNameInput.value = currentName;
    this.setDateNow();
    this.updateUnitDisplays();
  }

  // 💾 طرق CRUD مع التحقق من الصنف
  async saveHandler(e) {
    e.preventDefault();

    const formData = {
      tran_date: this.formatDateForServer(this.tranDate.value),
      store_id: this.storeSelect.value,
      supplierid: this.supplierId.value || null,
      mndop: this.mndop.value || '',
      item_id: this.itemIdInput.value,
      item_nm: this.itemNameInput.value,
      item_qty: parseFloat(this.itemQty.value) || 0,
      buy_price: parseFloat(this.buyPriceField.value) || 0,
      total_price: parseFloat(this.totalPrice.value) || 0,
      rate: parseFloat(this.rate.value) || 0,
      sale_price1: parseFloat(this.salePrice1.value) || 0,
      sale_price2: parseFloat(this.salePrice2.value) || 0,
      sale_price3: parseFloat(this.salePrice3.value) || 0,
      tran_type: document.getElementById('tran_type').value || 'شراء',
      batch_no: document.getElementById('batch_no').value || '',
      expiry_date: this.formatDateForServer(document.getElementById('expiry_date').value),
      min_qty: parseFloat(document.getElementById('min_qty').value) || 0,
      remarks: document.getElementById('remarks').value || '',
      unit_type: this.unitTypeEl.value,
      units_per_package: parseFloat(this.unitsPerPackageEl.value) || 1,
      sale_unit: this.saleUnitEl.value,
      conversion_factor: parseFloat(this.convFactorEl.value) || 1
    };

    if (!formData.store_id) return this.showToast('⚠️ المخزن مطلوب'), this.storeSelect.focus();
    if (!formData.item_id) return this.showToast('⚠️ كود الصنف مطلوب'), this.itemIdInput.focus();
    if (!formData.item_nm) return this.showToast('⚠️ اسم الصنف مطلوب'), this.itemIdInput.focus();

    try {
      // 🆕 التحقق من وجود الصنف في جدول items
      const validationResult = await this.validateItemBeforeSave(formData);
      
      if (!validationResult.valid) {
        this.showToast(`❌ ${validationResult.message}`);
        
        if (validationResult.action === 'needs_manual') {
          // فتح نموذج الإضافة اليدوية
          this.openAddItemForm(formData);
        }
        
        return;
      }
      
      // إذا تمت الإضافة تلقائياً، نعرض رسالة
      if (validationResult.action === 'added_auto' || validationResult.action === 'added_fallback') {
        this.showToast(`✅ ${validationResult.message}`);
      }

      let existingQty = 0;
      const storeId = formData.store_id, itemId = formData.item_id;
      
      try {
        const existingData = await this.supabase.fetchSingle('a_master', { 
          store_id: storeId, 
          item_id: itemId 
        });
        
        if (existingData) {
          existingQty = parseFloat(existingData.item_qty) || 0;
          this.showToast(`📊 الكمية الحالية: ${existingQty} - سيتم إضافة: ${formData.item_qty}`);
        }
      } catch (err) {
        console.log('سجل جديد أو خطأ في جلب الكمية السابقة');
      }

      formData.item_qty = existingQty + formData.item_qty;
      formData.total_price = +(formData.item_qty * formData.buy_price).toFixed(2);

      await this.supabase.upsert('a_master', formData, ['store_id', 'item_id']);
      
      this.showToast('✅ تم حفظ السجل بنجاح في Supabase' + ` - الكمية الإجمالية: ${formData.item_qty}`);
      this.clearForm();
      this.editKey = null;
      await this.loadData();
      
      if (this.itemStatus) this.itemStatus.style.display = 'none';
      setTimeout(() => this.itemIdInput.focus(), 100);
      
    } catch (err) {
      console.error('❌ خطأ في الحفظ:', err);
      this.showToast('❌ ' + (err.message || 'حدث خطأ أثناء الحفظ'));
    }
  }

  async editRow(store, item) {
    try {
      const data = await this.supabase.fetchSingle('a_master', { 
        store_id: store, 
        item_id: item 
      });
      
      if (!data) {
        this.showToast('❌ لم يتم العثور على السجل');
        return;
      }
      
      this.fillFormWithItemData(data);

      // جلب اسم الصنف إذا كان فارغاً
      if (data.item_id && (!this.itemNameInput.value || this.itemNameInput.value === '')) {
        try {
          const itemData = await this.supabase.fetchSingle('items', { item_id: data.item_id });
          if (itemData) {
            this.itemNameInput.value = itemData.item_nm || '';
            this.currentItemName = this.itemNameInput.value;
          }
        } catch (err) {
          console.error('خطأ في جلب اسم الصنف:', err);
        }
      }

      // تحديث إعدادات الوحدات
      if (data.unit_type) {
        this.currentUnitType = data.unit_type;
        this.currentUnitsPerPackage = parseFloat(data.units_per_package) || 1;
        
        if (this.unitTypeEl) this.unitTypeEl.value = data.unit_type || 'piece';
        if (this.unitsPerPackageEl) this.unitsPerPackageEl.value = data.units_per_package || 1;
        if (this.saleUnitEl) this.saleUnitEl.value = data.sale_unit || 'piece';
        if (this.convFactorEl) this.convFactorEl.value = data.conversion_factor || 1;
        
        this.updateUnitDisplays();
        this.calculations.calculateQuantities();
        this.calculations.calculatePrices();
        this.calculations.calculatePricesForSaleUnit();
      }

      this.editKey = `${store}_${item}`;
      this.showItemStatus('✏️ جاهز للتحديث - يمكنك تعديل البيانات', 'success');
      
      setTimeout(() => {
        if (this.storeSelect) this.storeSelect.focus();
      }, 100);
      
    } catch (err) {
      console.error('خطأ في التعديل:', err);
      this.showToast('❌ خطأ في تحميل البيانات: ' + (err.message || ''));
    }
  }

  async delRow(store, item) {
    if (!confirm('🗑️ حذف السجل؟')) return;
    
    try {
      await this.supabase.delete('a_master', { 
        store_id: store, 
        item_id: item 
      });
      
      this.allData = this.allData.filter(i => 
        String(i.store_id) !== String(store) || String(i.item_id) !== String(item)
      );
      
      this.render();
      this.showToast('🗑️ تم الحذف');
      
    } catch (err) {
      console.error('خطأ في الحذف:', err);
      this.showToast('❌ حدث خطأ أثناء الحذف');
    }
  }

  // 📋 طرق التصدير والاستيراد
  async handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'binary' });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        
        let addedCount = 0;
        let skippedCount = 0;
        
        for (const row of data) {
          try {
            // التحقق من وجود الصنف قبل الاستيراد
            if (row.item_id) {
              const itemExists = await this.supabase.fetchSingle('items', { item_id: row.item_id });
              
              if (!itemExists) {
                // إضافة الصنف تلقائياً إذا لم يكن موجوداً
                const newItem = {
                  item_id: row.item_id,
                  item_nm: row.item_nm || `صنف ${row.item_id}`,
                  unit_type: row.unit_type || 'piece',
                  units_per_package: row.units_per_package || 1,
                  sale_unit: row.sale_unit || 'piece',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                };
                
                await this.supabase.upsert('items', newItem, ['item_id']);
                console.log(`✅ تم إضافة الصنف ${row.item_id} تلقائياً`);
              }
            }
            
            await this.supabase.upsert('a_master', row, ['store_id', 'item_id']);
            addedCount++;
          } catch (error) {
            console.error(`❌ خطأ في استيراد السجل:`, row, error);
            skippedCount++;
          }
        }
        
        this.showToast(`📥 تم استيراد ${addedCount} سجل، تم تخطي ${skippedCount}`);
        await this.loadData();
        setTimeout(() => this.saveBtn.focus(), 100);
      } catch (err) {
        console.error('خطأ في الاستيراد:', err);
        this.showToast('❌ حدث خطأ أثناء الاستيراد');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  }

  handleExport() {
    const ws = XLSX.utils.json_to_sheet(this.allData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'a_masterbk');
    XLSX.writeFile(wb, `a_masterbk_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // 🎨 طرق العرض
  render() {
    if (!this.tbody) return;
    
    this.tbody.innerHTML = '';
    const query = (this.searchBox?.value || '').toLowerCase();
    const data = !query ? this.allData : this.allData.filter(row => 
      Object.values(row).some(val => String(val || '').toLowerCase().includes(query))
    );
    
    data.forEach((row, index) => {
      const tr = document.createElement('tr');
      const itemQty = parseFloat(row.item_qty) || 0;
      const minQty = parseFloat(row.min_qty) || 0;
      
      if (itemQty <= minQty) tr.style.background = '#ffebee';
      else if (itemQty <= minQty * 2) tr.style.background = '#fff3e0';
      
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${row.tran_date || ''}</td>
        <td>${row.store_id || ''}</td>
        <td>${row.supplierid || ''}</td>
        <td>${row.mndop || ''}</td>
        <td><strong>${row.item_id || ''}</strong></td>
        <td>${row.item_nm || ''}</td>
        <td><strong>${row.item_qty || ''}</strong></td>
        <td><span class="unit-badge">${row.unit_type === 'package' ? 'علبة' : 'قطعة'}</span></td>
        <td>${row.buy_price || ''}</td>
        <td>${row.total_price || ''}</td>
        <td>${row.rate || ''}</td>
        <td>${row.sale_price1 || ''}</td>
        <td>${row.sale_price2 || ''}</td>
        <td>${row.sale_price3 || ''}</td>
        <td>${row.tran_type || ''}</td>
        <td>${row.batch_no || ''}</td>
        <td>${row.expiry_date || ''}</td>
        <td>${row.min_qty || ''}</td>
        <td>${row.remarks || ''}</td>
        <td>
          <button class="btn-edit" onclick="master.editRow('${row.store_id}','${row.item_id}')">✏️ تحديث</button>
          <button class="btn-del" onclick="master.delRow('${row.store_id}','${row.item_id}')">🗑️ حذف</button>
        </td>`;
      this.tbody.appendChild(tr);
    });
    
    if (this.itemsCount) this.itemsCount.textContent = data.length;
  }

  // 🎯 طرق التنقل
  setupEnterNavigation() {
    if (!this.form) return;
    
    const fieldOrder = [
      'tran_date', 'store_id', 'supplierid', 'mndop', 'item_id', 
      'unit_type', 'units_per_package', 'sale_unit',
      'item_qty_piece', 'item_qty_package', 'item_qty',
      'buy_price_piece', 'buy_price_package', 'buy_price',
      'total_price', 'rate', 'sale_price1_piece', 'sale_price1_package',
      'sale_price1', 'sale_price2', 'sale_price3', 'tran_type',
      'batch_no', 'expiry_date', 'min_qty', 'convert_from_qty',
      'convert_from_unit', 'convert_to_qty', 'convert_to_unit', 'remarks'
    ];

    const getNavFields = () => {
      const unitType = this.unitTypeEl.value;
      const nav = [];
      
      fieldOrder.forEach(id => {
        const field = document.getElementById(id);
        if (!field) return;
        
        if (field.style.display === 'none' || field.disabled || field.offsetParent === null) return;
        
        if (['item_qty', 'buy_price', 'total_price', 'sale_price1', 'conversion_factor', 'convert_to_qty'].includes(id)) return;
        
        if (unitType === 'package' && id.includes('_piece') && !id.includes('convert')) return;
        if (unitType === 'piece' && id.includes('_package') && !id.includes('convert')) return;
        
        nav.push(id);
      });
      
      return nav;
    };

    const moveNext = (currentId) => {
      const nav = getNavFields();
      const idx = nav.indexOf(currentId);
      if (idx === -1) return false;
      
      if (idx < nav.length - 1) {
        const nextId = nav[idx + 1];
        const nextEl = document.getElementById(nextId);
        if (nextEl) {
          nextEl.focus();
          if (nextEl.tagName === 'SELECT') {
            setTimeout(() => nextEl.click(), 10);
          }
          return true;
        }
      }
      
      if (this.saveBtn) {
        this.saveBtn.focus();
        return true;
      }
      return false;
    };

    fieldOrder.forEach(id => {
      const field = document.getElementById(id);
      if (field) {
        field.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            moveNext(id);
          }
        });
      }
    });

    if (this.saveBtn) {
      this.saveBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.form.dispatchEvent(new Event('submit'));
        }
      });
    }
  }

  // ⚡ تهيئة الأحداث
  initEvents() {
    ['item_qty', 'buy_price', 'rate'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => this.calculations.calc());
    });

    if (this.itemQtyPiece) this.itemQtyPiece.addEventListener('input', () => this.calculations.calculateQuantities());
    if (this.itemQtyPackage) this.itemQtyPackage.addEventListener('input', () => this.calculations.calculateQuantities());
    if (this.buyPricePiece) this.buyPricePiece.addEventListener('input', () => this.calculations.calculatePrices());
    if (this.buyPricePackage) this.buyPricePackage.addEventListener('input', () => this.calculations.calculatePrices());

    if (this.salePrice1Piece) {
      this.salePrice1Piece.addEventListener('input', () => {
        const piecePrice = parseFloat(this.salePrice1Piece.value) || 0;
        if (this.salePrice1) this.salePrice1.value = piecePrice.toFixed(2);
        if (this.currentUnitType === 'package' && this.currentUnitsPerPackage > 0 && this.salePrice1Package) {
          this.salePrice1Package.value = (piecePrice * this.currentUnitsPerPackage).toFixed(2);
        }
        this.calculations.calculatePricesForSaleUnit();
      });
    }

    if (this.unitTypeEl) this.unitTypeEl.addEventListener('change', this.updateUnitDisplays);
    if (this.unitsPerPackageEl) this.unitsPerPackageEl.addEventListener('input', this.updateUnitDisplays);
    if (this.saleUnitEl) this.saleUnitEl.addEventListener('change', () => this.calculations.calculatePricesForSaleUnit());

    const convertBtn = document.querySelector('.unit-converter button');
    if (convertBtn) convertBtn.addEventListener('click', () => this.calculations.convertUnits());

    if (this.form) this.form.addEventListener('submit', this.saveHandler);
    if (this.importBtn) this.importBtn.addEventListener('click', () => this.importInput.click());
    if (this.importInput) this.importInput.addEventListener('change', this.handleImport);
    if (this.exportBtn) this.exportBtn.addEventListener('click', this.handleExport);

    if (this.searchBtn) this.searchBtn.addEventListener('click', () => this.searchItems(this.searchBox.value));
    if (this.showAllBtn) this.showAllBtn.addEventListener('click', () => { 
      if (this.searchBox) this.searchBox.value = ''; 
      this.loadData(); 
    });
    if (this.lowStockBtn) this.lowStockBtn.addEventListener('click', this.loadLowStockAlerts);
    if (this.searchBox) {
      this.searchBox.addEventListener('keypress', e => { 
        if (e.key === 'Enter') this.searchItems(this.searchBox.value); 
      });
    }

    this.attachItemBlur();
    this.setupEnterNavigation();
  }

  // 🚀 التهيئة النهائية
  async init() {
    try {
      console.log('🚀 بدء تهيئة النظام...');
      
      this.updateConnectionStatus();
      await this.loadOptions();
      this.setDateNow();
      await this.loadData();
      this.initEvents();
      this.updateUnitDisplays();
      
      setTimeout(() => { 
        if (this.itemIdInput) {
          this.itemIdInput.focus(); 
          console.log('🎯 جاهز - المؤشر على حقل كود الصنف'); 
        }
      }, 500);
      
      setTimeout(() => { 
        console.log('📢 تحميل تنبيهات الفروع...'); 
        this.loadLowStockAlerts(); 
      }, 1000);
      
      console.log('✅ تم تهيئة النظام بنجاح');
    } catch (err) {
      console.error('init err', err);
    }
  }
  
}
// 🚨 حل طارئ - تأكد من وجود safeQuery
setTimeout(() => {
    if (window.master && window.master.supabase && !window.master.supabase.safeQuery) {
        console.log('🛠️ إنشاء safeQuery بشكل طارئ...');
        
        window.master.supabase.safeQuery = async function(table, conditions = {}, options = {}) {
            try {
                const query = this.client.from(table).select('*');
                
                Object.entries(conditions).forEach(([key, value]) => {
                    if (value !== null && value !== undefined) {
                        query.eq(key, value);
                    }
                });
                
                if (options.orderBy) {
                    query.order(options.orderBy.column, {
                        ascending: options.orderBy.ascending !== false
                    });
                }
                
                const { data, error } = await query;
                
                if (error) {
                    console.warn(`⚠️ Query ${table}:`, error.message);
                    return options.returnEmpty ? [] : null;
                }
                
                if (options.single) return data?.[0] || null;
                return data || [];
                
            } catch (error) {
                console.error(`❌ Query error ${table}:`, error);
                return options.returnEmpty ? [] : null;
            }
        };
        
        console.log('✅ تم إنشاء safeQuery طارئ');
    }
}, 1000);
// أنشئ مثيلاً واحداً ليكون مرجعاً في الواجهة
window.master = new MasterManager();