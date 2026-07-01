// transferItem.js - Frontend for Inventory Transfer
const BASE_URL = "http://localhost:3000";
const API = {
    TRANSFER: `${BASE_URL}/api/transferItembk`,
    STORES: `${BASE_URL}/api/stores`,
    ITEMS: `${BASE_URL}/api/items`
};

class TransferApp {
    constructor() {
        this.state = {
            transferLines: [],
            currentItem: null,
            fromStore: null,
            toStore: null,
            searchTimer: null,
            currentFocus: 'fromStore' // تتبع الحقل النشط
        };
        this.dom = this._initDOM();
        this._bindEvents();
        this.init();
    }

    _initDOM() {
        const ids = [
            'userInfo', 'fromStore', 'toStore', 'transferDate',
            'transferRemarks', 'itemSearch', 'itemResults', 'inventoryInfo',
            'availableStock', 'batchNo', 'expiryDate', 'transferQty',
            'batchNoInput', 'expiryDateInput', 'transferItemsList', 'totalItems',
            'totalQty', 'fromStoreName', 'toStoreName', 'toast',
            'addItemBtn', 'processTransferBtn'
        ];
        const dom = {};
        ids.forEach(id => {
            dom[id] = document.getElementById(id);
            if (!dom[id]) {
                console.warn('Element with id ' + id + ' not found');
            }
        });
        return dom;
    }

    _bindEvents() {
        // أحداث البحث - تفعيل عند أول حرف
        this.dom.itemSearch.addEventListener('input', () => this._onItemSearch());
        
        // أحداث Enter للتنقل بين الحقول
        this.dom.fromStore.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._focusToStore();
            }
        });

        this.dom.toStore.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._focusItemSearch();
            }
        });

        this.dom.itemSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._handleItemSearchEnter();
            }
        });

        this.dom.transferQty.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._focusBatchNo();
            }
        });

        this.dom.batchNoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._focusExpiryDate();
            }
        });

        this.dom.expiryDateInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._autoAddItem();
            }
        });
        
        // أحداث تغيير المخازن
        this.dom.fromStore.addEventListener('change', () => this._onStoreChange());
        this.dom.toStore.addEventListener('change', () => this._updateStoreNames());
        
        // أحداث التنقل
        document.addEventListener('keydown', (e) => this._handleKeyboard(e));
        
        // أحداث الأزرار
        if (this.dom.addItemBtn) {
            this.dom.addItemBtn.addEventListener('click', () => this.addTransferItem());
        }
        if (this.dom.processTransferBtn) {
            this.dom.processTransferBtn.addEventListener('click', () => this.processTransfer());
        }
    }

    // ========== دوال التنقل المحسنة ==========

    _focusToStore() {
        if (this.dom.toStore) {
            this.dom.toStore.focus();
            this.state.currentFocus = 'toStore';
        }
    }

    _focusItemSearch() {
        if (this.dom.fromStore.value && this.dom.toStore.value) {
            if (this.dom.itemSearch) {
                this.dom.itemSearch.focus();
                this.state.currentFocus = 'itemSearch';
            }
        } else {
            this.showMessage('⚠️ اختر الفرع المصدر والهدف أولاً', 'error');
        }
    }

    _handleItemSearchEnter() {
        const query = this.dom.itemSearch.value.trim();
        if (query.length > 0) {
            this._onItemSearch().then(() => {
                // إذا كانت هناك نتائج، نعرضها
                if (this.dom.itemResults && this.dom.itemResults.children.length > 0) {
                    // نختار أول نتيجة تلقائياً
                    const firstItem = this.dom.itemResults.querySelector('.search-item');
                    if (firstItem) {
                        this._selectItemFromElement(firstItem);
                    }
                }
            });
        }
    }

    _focusBatchNo() {
        const transferQty = parseFloat(this.dom.transferQty.value) || 0;
        if (transferQty > 0 && this.state.currentItem) {
            if (this.dom.batchNoInput) {
                this.dom.batchNoInput.focus();
                this.state.currentFocus = 'batchNo';
                
                // تعبئة تلقائية لرقم الدفعة إذا كان فارغاً
                if (!this.dom.batchNoInput.value && this.state.currentItem.batch_no) {
                    this.dom.batchNoInput.value = this.state.currentItem.batch_no;
                }
            }
        } else {
            this.showMessage('⚠️ أدخل كمية صحيحة أولاً', 'error');
            this.dom.transferQty.focus();
        }
    }

    _focusExpiryDate() {
        if (this.dom.batchNoInput.value.trim() !== '') {
            if (this.dom.expiryDateInput) {
                this.dom.expiryDateInput.focus();
                this.state.currentFocus = 'expiryDate';
                
                // تعبئة تلقائية لتاريخ الانتهاء إذا كان فارغاً
                if (!this.dom.expiryDateInput.value && this.state.currentItem.expiry_date) {
                    this.dom.expiryDateInput.value = this.state.currentItem.expiry_date;
                }
            }
        } else {
            this.showMessage('⚠️ أدخل رقم الدفعة أولاً', 'error');
            this.dom.batchNoInput.focus();
        }
    }

    _autoAddItem() {
        if (this.dom.expiryDateInput.value.trim() !== '') {
            this.addTransferItem();
        } else {
            this.showMessage('⚠️ أدخل تاريخ الانتهاء أولاً', 'error');
            this.dom.expiryDateInput.focus();
        }
    }

    // ========== دوال مساعدة محسنة ==========

    async _selectItemFromElement(itemElement) {
        // استخراج بيانات الصنف من العنصر
        const itemId = itemElement.querySelector('strong')?.textContent;
        if (!itemId) return;

        try {
            const storeId = this.dom.fromStore.value;
            const response = await fetch(API.TRANSFER + '/store-items/' + storeId + '?q=' + encodeURIComponent(itemId));
            if (!response.ok) throw new Error('فشل في جلب بيانات الصنف');
            
            const data = await response.json();
            const items = data.items || data;
            const item = items.find(i => i.item_id == itemId);
            
            if (item) {
                this._selectItem(item);
                
                // التركيز التلقائي على حقل الكمية
                setTimeout(() => {
                    if (this.dom.transferQty) {
                        this.dom.transferQty.focus();
                        this.dom.transferQty.select();
                        this.state.currentFocus = 'transferQty';
                    }
                }, 100);
            }
        } catch (error) {
            console.error('Error selecting item:', error);
            this.showMessage('❌ خطأ في اختيار الصنف', 'error');
        }
    }

    async _onItemSearch() {
        const query = this.dom.itemSearch.value.trim();
        const storeId = this.dom.fromStore.value;

        if (!query) {
            if (this.dom.itemResults) this.dom.itemResults.style.display = 'none';
            return;
        }

        if (!storeId) {
            this.showMessage('⚠️ اختر الفرع المصدر أولاً', 'error');
            return;
        }

        clearTimeout(this.state.searchTimer);
        this.state.searchTimer = setTimeout(async () => {
            try {
                const response = await fetch(API.TRANSFER + '/store-items/' + storeId + '?q=' + encodeURIComponent(query));
                if (!response.ok) {
                    throw new Error('فشل في البحث: ' + response.status);
                }
                const data = await response.json();
                this._displayItemResults(data.items || data);
            } catch (error) {
                console.error('Error searching items:', error);
                this.showMessage('❌ خطأ في البحث عن الأصناف', 'error');
            }
        }, 300);
    }

    _displayItemResults(items) {
        const resultsDiv = this.dom.itemResults;
        if (!resultsDiv) return;
        
        resultsDiv.innerHTML = '';
        
        if (!items || items.length === 0) {
            resultsDiv.innerHTML = '<div class="search-item">❌ لا توجد نتائج</div>';
            resultsDiv.style.display = 'block';
            return;
        }

        items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'search-item';
            itemDiv.innerHTML = '<strong>' + item.item_id + '</strong> - ' + (item.item_nm || '') +
                '<br><small>الرصيد: ' + (item.item_qty || 0) + ' | الدفعة: ' + (item.batch_no || '-') + 
                ' | انتهاء: ' + (item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('ar-EG') : '-') + '</small>';
            itemDiv.addEventListener('click', () => this._selectItemFromElement(itemDiv));
            resultsDiv.appendChild(itemDiv);
        });
        
        resultsDiv.style.display = 'block';
    }

    async _selectItem(item) {
        this.state.currentItem = item;
        if (this.dom.itemResults) this.dom.itemResults.style.display = 'none';
        
        if (this.dom.inventoryInfo) {
            this.dom.availableStock.textContent = item.item_qty || 0;
            this.dom.batchNo.textContent = item.batch_no || '-';
            this.dom.expiryDate.textContent = item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('ar-EG') : '-';
            this.dom.inventoryInfo.style.display = 'block';
        }
        
        // تعبئة الحقول تلقائياً
        if (this.dom.batchNoInput) this.dom.batchNoInput.value = item.batch_no || '';
        if (this.dom.expiryDateInput) this.dom.expiryDateInput.value = item.expiry_date ? item.expiry_date.split('T')[0] : '';
        
        this.showMessage('✅ تم اختيار الصنف: ' + (item.item_nm || item.item_id), 'success');
    }

    addTransferItem() {
        // التحقق من وجود الصنف المحدد
        if (!this.state.currentItem) {
            this.showMessage('⚠️ اختر صنفاً أولاً من نتائج البحث', 'error');
            if (this.dom.itemSearch) this.dom.itemSearch.focus();
            return;
        }

        if (!this.state.fromStore || !this.state.toStore) {
            this.showMessage('⚠️ اختر الفرع المصدر والهدف', 'error');
            return;
        }

        const transferQty = parseFloat(this.dom.transferQty.value) || 0;
        const batchNo = this.dom.batchNoInput.value.trim();
        const expiryDate = this.dom.expiryDateInput.value;

        if (transferQty <= 0) {
            this.showMessage('⚠️ الكمية يجب أن تكون أكبر من الصفر', 'error');
            if (this.dom.transferQty) this.dom.transferQty.focus();
            return;
        }

        // التحقق من الكمية المتاحة
        const availableStock = parseFloat(this.dom.availableStock.textContent) || 0;
        if (transferQty > availableStock) {
            this.showMessage('⚠️ الكمية المراد تحويلها أكبر من الرصيد المتاح', 'error');
            if (this.dom.transferQty) this.dom.transferQty.focus();
            return;
        }

        // التحقق من إدخال رقم الدفعة
        if (!batchNo) {
            this.showMessage('⚠️ يرجى إدخال رقم الدفعة', 'error');
            if (this.dom.batchNoInput) this.dom.batchNoInput.focus();
            return;
        }

        // التحقق من إدخال تاريخ الانتهاء
        if (!expiryDate) {
            this.showMessage('⚠️ يرجى إدخال تاريخ الانتهاء', 'error');
            if (this.dom.expiryDateInput) this.dom.expiryDateInput.focus();
            return;
        }

        const transferLine = {
            item_id: this.state.currentItem.item_id,
            item_nm: this.state.currentItem.item_nm || this.state.currentItem.item_id,
            transfer_qty: transferQty,
            batch_no: batchNo,
            expiry_date: expiryDate,
            unit_type: this.state.currentItem.unit_type || 'قطعة',
            units_per_package: this.state.currentItem.units_per_package || 1,
            buy_price: this.state.currentItem.buy_price || 0,
            sale_price1: this.state.currentItem.sale_price1 || 0,
            sale_price2: this.state.currentItem.sale_price2 || 0,
            sale_price3: this.state.currentItem.sale_price3 || 0,
            rate: this.state.currentItem.rate || 0,
            available_stock: availableStock
        };

        this.state.transferLines.push(transferLine);
        this.renderTransferItems();
        this._clearItemSelection();
        
        this.showMessage('✅ تم إضافة الصنف للتحويل', 'success');
        
        // إعادة التركيز على حقل البحث للصنف التالي
        setTimeout(() => {
            if (this.dom.itemSearch) {
                this.dom.itemSearch.value = '';
                this.dom.itemSearch.focus();
                this.state.currentFocus = 'itemSearch';
            }
        }, 100);
    }

    // ========== دوال الطباعة المحسنة ==========

    printTransferReceipt(transferNo) {
        if (this.state.transferLines.length === 0) {
            this.showMessage('⚠️ لا توجد بيانات للطباعة', 'error');
            return;
        }

        const fromStoreName = this.dom.fromStoreName?.textContent || '-';
        const toStoreName = this.dom.toStoreName?.textContent || '-';
        const totalItems = this.state.transferLines.length;
        const totalQty = this.state.transferLines.reduce((sum, line) => sum + line.transfer_qty, 0);
        const currentDate = new Date().toLocaleString('ar-EG');
        const userInfo = this.dom.userInfo?.textContent || 'مستخدم غير معروف';
        
        // جمع بيانات الأصناف مع معلومات إضافية
        const itemsHtml = this.state.transferLines.map((item, index) => {
            return `
            <tr>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${index + 1}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">
                    <strong>${item.item_id}</strong><br>
                    <small>${item.item_nm}</small>
                </td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.transfer_qty}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.unit_type || 'قطعة'}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.batch_no || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('ar-EG') : '-'}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.sale_price1 || 0}</td>
            </tr>
            `;
        }).join('');

        const receiptContent = `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>إشعار تحويل - ${transferNo}</title>
            <style>
                body { 
                    font-family: 'Arial', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                    margin: 0; 
                    padding: 20px; 
                    direction: rtl; 
                    background: #f5f5f5;
                }
                .receipt-container {
                    max-width: 800px;
                    margin: 0 auto;
                    background: white;
                    padding: 25px;
                    border-radius: 10px;
                    box-shadow: 0 0 20px rgba(0,0,0,0.1);
                }
                .header { 
                    text-align: center; 
                    margin-bottom: 25px; 
                    padding-bottom: 15px; 
                    border-bottom: 3px solid #2c3e50;
                    background: linear-gradient(135deg, #2c3e50, #34495e);
                    color: white;
                    padding: 20px;
                    border-radius: 8px;
                }
                .header h1 {
                    margin: 0 0 10px 0;
                    font-size: 28px;
                    color: white;
                }
                .info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    margin: 20px 0;
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 8px;
                    border-right: 4px solid #3498db;
                }
                .info-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px dashed #ddd;
                }
                .info-item:last-child {
                    border-bottom: none;
                }
                .info-label {
                    font-weight: bold;
                    color: #2c3e50;
                }
                .info-value {
                    color: #34495e;
                }
                .items-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .items-table th {
                    background: linear-gradient(135deg, #3498db, #2980b9);
                    color: white;
                    padding: 12px;
                    text-align: center;
                    font-weight: bold;
                    border: 1px solid #2980b9;
                }
                .items-table td {
                    padding: 10px;
                    border: 1px solid #ddd;
                }
                .total-section {
                    background: linear-gradient(135deg, #27ae60, #229954);
                    color: white;
                    padding: 15px;
                    border-radius: 8px;
                    margin-top: 20px;
                    text-align: center;
                    font-weight: bold;
                    font-size: 18px;
                }
                .footer {
                    text-align: center;
                    margin-top: 25px;
                    padding-top: 15px;
                    border-top: 2px solid #bdc3c7;
                    color: #7f8c8d;
                    font-size: 14px;
                }
                .status-badge {
                    display: inline-block;
                    padding: 5px 12px;
                    background: #f39c12;
                    color: white;
                    border-radius: 20px;
                    font-size: 14px;
                    font-weight: bold;
                    margin: 5px;
                }
                @media print {
                    body { 
                        margin: 0; 
                        padding: 0;
                        background: white;
                    }
                    .receipt-container {
                        box-shadow: none;
                        padding: 0;
                        margin: 0;
                        max-width: 100%;
                    }
                    .header {
                        background: #2c3e50 !important;
                        -webkit-print-color-adjust: exact;
                    }
                    .items-table th {
                        background: #3498db !important;
                        -webkit-print-color-adjust: exact;
                    }
                    .total-section {
                        background: #27ae60 !important;
                        -webkit-print-color-adjust: exact;
                    }
                    .no-print { display: none !important; }
                    @page { margin: 0.5cm; }
                }
                .no-print {
                    text-align: center;
                    margin: 20px 0;
                }
                .print-btn {
                    background: linear-gradient(135deg, #e74c3c, #c0392b);
                    color: white;
                    border: none;
                    padding: 12px 25px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: bold;
                    margin: 10px;
                    transition: all 0.3s;
                }
            </style>
        </head>
        <body>
            <div class="receipt-container">
                <div class="header">
                    <h1>🔄 إشعار تحويل مخزون</h1>
                    <p>نظام إدارة المخازن</p>
                </div>

                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">رقم التحويل:</span>
                        <span class="info-value">${transferNo}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">التاريخ والوقت:</span>
                        <span class="info-value">${currentDate}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">المستخدم:</span>
                        <span class="info-value">${userInfo.replace('مرحباً: ', '')}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">الحالة:</span>
                        <span class="info-value">
                            <span class="status-badge">⏳ معلق</span>
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">من الفرع:</span>
                        <span class="info-value">${fromStoreName}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">إلى الفرع:</span>
                        <span class="info-value">${toStoreName}</span>
                    </div>
                </div>

                <table class="items-table">
                    <thead>
                        <tr>
                            <th width="60">#</th>
                            <th>الصنف</th>
                            <th width="100">الكمية</th>
                            <th width="100">الوحدة</th>
                            <th width="120">رقم الدفعة</th>
                            <th width="120">انتهاء الصلاحية</th>
                            <th width="100">سعر البيع</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <div class="total-section">
                    <div style="display: flex; justify-content: space-around; align-items: center;">
                        <div>إجمالي الأصناف: <span style="font-size: 24px;">${totalItems}</span></div>
                        <div>إجمالي الكمية: <span style="font-size: 24px;">${totalQty.toFixed(2)}</span></div>
                    </div>
                </div>

                <div class="footer">
                    <p>⏰ هذا التحويل معلق بانتظار القبول من الفرع الهدف</p>
                    <p>📞 للاستفسار: إدارة المخازن - نظام التحويل الآلي</p>
                    <p>🕒 مدة الانتظار: 3 أيام كحد أقصى</p>
                </div>

                <div class="no-print">
                    <button class="print-btn" onclick="window.print()">
                        🖨️ طباعة الإشعار
                    </button>
                    <button class="print-btn" onclick="window.close()">
                        ❌ إغلاق النافذة
                    </button>
                </div>
            </div>

            <script>
                window.onload = function() {
                    setTimeout(() => {
                        window.print();
                    }, 1000);
                };
            </script>
        </body>
        </html>
        `;

        const printWindow = window.open('', '_blank', `
            width=1000,height=700,
            top=100,left=100,
            toolbar=no,location=no,directories=no,status=no,
            menubar=no,scrollbars=yes,resizable=yes
        `);
        
        if (!printWindow) {
            this.showMessage('❌ تم منع فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة', 'error');
            return;
        }

        printWindow.document.write(receiptContent);
        printWindow.document.close();
        
        printWindow.focus();
        this.showMessage('✅ تم فتح نافذة الطباعة', 'success');
    }

    // ========== الدوال الأساسية المحفوظة ==========

    _clearItemSelection() {
        this.state.currentItem = null;
        if (this.dom.inventoryInfo) this.dom.inventoryInfo.style.display = 'none';
        if (this.dom.transferQty) this.dom.transferQty.value = '1';
        if (this.dom.batchNoInput) this.dom.batchNoInput.value = '';
        if (this.dom.expiryDateInput) this.dom.expiryDateInput.value = '';
    }

    _handleKeyboard(e) {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case 'n': case 'N':
                    e.preventDefault();
                    this.newTransfer();
                    break;
                case 's': case 'S':
                    e.preventDefault();
                    this.processTransfer();
                    break;
            }
        }
    }

    // ... باقي الدوال بدون تغيير (init, _loadUserInfo, _loadStores, _setCurrentDate, etc.)
    // [يتم الحفاظ على جميع الدوال الأخرى كما هي بدون تغيير]

    async init() {
        try {
            this._loadUserInfo();
            await this._loadStores();
            this._setCurrentDate();
            this.showMessage('✅ تم تهيئة نظام التحويل', 'success');
            
            // التركيز الأولي على الفرع المصدر
            setTimeout(() => {
                if (this.dom.fromStore) {
                    this.dom.fromStore.focus();
                }
            }, 500);
        } catch (error) {
            console.error('Error initializing:', error);
            this.showMessage('❌ خطأ في التهيئة', 'error');
        }
    }

    _loadUserInfo() {
        const username = localStorage.getItem("username") || sessionStorage.getItem("username");
        const userId = localStorage.getItem("user_id") || sessionStorage.getItem("user_id");
        
        if (username && this.dom.userInfo) {
            this.dom.userInfo.textContent = 'مرحباً: ' + username;
            this.dom.userInfo.dataset.userId = userId;
        }
    }

    async _loadStores() {
        try {
            const response = await fetch(API.STORES);
            if (!response.ok) {
                throw new Error('فشل في تحميل المخازن: ' + response.status);
            }
            const data = await response.json();
            
            const stores = data.stores || data;
            const fromSelect = this.dom.fromStore;
            const toSelect = this.dom.toStore;
            
            fromSelect.innerHTML = '<option value="">اختر الفرع المصدر</option>';
            toSelect.innerHTML = '<option value="">اختر الفرع الهدف</option>';
            
            stores.forEach(store => {
                const optionFrom = document.createElement('option');
                optionFrom.value = store.store_id;
                optionFrom.textContent = store.store_name || 'الفرع ' + store.store_id;
                fromSelect.appendChild(optionFrom);
                
                const optionTo = document.createElement('option');
                optionTo.value = store.store_id;
                optionTo.textContent = store.store_name || 'الفرع ' + store.store_id;
                toSelect.appendChild(optionTo);
            });
            
        } catch (error) {
            console.error('Error loading stores:', error);
            this.showMessage('❌ خطأ في تحميل المخازن', 'error');
        }
    }

    _setCurrentDate() {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        if (this.dom.transferDate) {
            this.dom.transferDate.value = today;
        }
    }

    _onStoreChange() {
        this.state.fromStore = this.dom.fromStore.value;
        this.state.currentItem = null;
        this.dom.itemSearch.value = '';
        if (this.dom.itemResults) this.dom.itemResults.style.display = 'none';
        if (this.dom.inventoryInfo) this.dom.inventoryInfo.style.display = 'none';
        this._updateStoreNames();
    }

    _updateStoreNames() {
        const fromStoreId = this.dom.fromStore.value;
        const toStoreId = this.dom.toStore.value;
        
        const fromStoreName = this.dom.fromStore.options[this.dom.fromStore.selectedIndex]?.textContent || '-';
        const toStoreName = this.dom.toStore.options[this.dom.toStore.selectedIndex]?.textContent || '-';
        
        if (this.dom.fromStoreName) this.dom.fromStoreName.textContent = fromStoreName;
        if (this.dom.toStoreName) this.dom.toStoreName.textContent = toStoreName;
        
        this.state.fromStore = fromStoreId;
        this.state.toStore = toStoreId;
    }

    renderTransferItems() {
        const itemsList = this.dom.transferItemsList;
        if (!itemsList) return;
        
        const header = itemsList.querySelector('.item-row.header');
        itemsList.innerHTML = '';
        if (header) itemsList.appendChild(header);

        this.state.transferLines.forEach((line, index) => {
            const row = document.createElement('div');
            row.className = 'item-row';
            row.innerHTML = '<div>' + (index + 1) + '</div>' +
                '<div><strong>' + line.item_id + '</strong><br><small>' + line.item_nm + '</small></div>' +
                '<div>' + line.transfer_qty + '</div>' +
                '<div>' + (line.batch_no || '-') + '</div>' +
                '<div>' + (line.expiry_date ? new Date(line.expiry_date).toLocaleDateString('ar-EG') : '-') + '</div>' +
                '<div><button onclick="transferApp.editTransferItem(' + index + ')" style="background: #f39c12; color: white; border: none; padding: 5px 10px; border-radius: 3px; margin: 2px;">✏️</button>' +
                '<button onclick="transferApp.removeTransferItem(' + index + ')" style="background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 3px; margin: 2px;">🗑️</button></div>';
            itemsList.appendChild(row);
        });

        this._updateSummary();
    }

    _updateSummary() {
        const totalItems = this.state.transferLines.length;
        const totalQty = this.state.transferLines.reduce((sum, line) => sum + line.transfer_qty, 0);

        if (this.dom.totalItems) this.dom.totalItems.textContent = totalItems;
        if (this.dom.totalQty) this.dom.totalQty.textContent = totalQty.toFixed(2);
    }

    editTransferItem(index) {
        const line = this.state.transferLines[index];
        
        this.dom.transferQty.value = line.transfer_qty;
        this.dom.batchNoInput.value = line.batch_no || '';
        this.dom.expiryDateInput.value = line.expiry_date || '';

        this.state.currentItem = {
            item_id: line.item_id,
            item_nm: line.item_nm,
            item_qty: line.available_stock,
            batch_no: line.batch_no,
            expiry_date: line.expiry_date,
            unit_type: line.unit_type
        };

        if (this.dom.inventoryInfo) {
            this.dom.availableStock.textContent = line.available_stock || 0;
            this.dom.batchNo.textContent = line.batch_no || '-';
            this.dom.expiryDate.textContent = line.expiry_date ? new Date(line.expiry_date).toLocaleDateString('ar-EG') : '-';
            this.dom.inventoryInfo.style.display = 'block';
        }

        this.removeTransferItem(index);
        this.showMessage('✏️ يمكنك تعديل بيانات الصنف الآن', 'info');
        
        if (this.dom.transferQty) this.dom.transferQty.focus();
    }

    removeTransferItem(index) {
        if (confirm('هل تريد حذف هذا الصنف من التحويل؟')) {
            this.state.transferLines.splice(index, 1);
            this.renderTransferItems();
            this.showMessage('🗑️ تم حذف الصنف', 'success');
        }
    }

    async processTransfer() {
        if (this.state.transferLines.length === 0) {
            this.showMessage('⚠️ لا توجد أصناف في التحويل', 'error');
            return;
        }

        if (!this.state.fromStore || !this.state.toStore) {
            this.showMessage('⚠️ اختر الفرع المصدر والهدف', 'error');
            return;
        }

        if (this.state.fromStore === this.state.toStore) {
            this.showMessage('⚠️ لا يمكن التحويل لنفس الفرع', 'error');
            return;
        }

        try {
            const storeCheck = await fetch(API.TRANSFER + '/check-target-store/' + this.state.toStore);
            const storeResult = await storeCheck.json();
            
            if (!storeResult.success || !storeResult.store_exists) {
                this.showMessage('❌ الفرع الهدف غير موجود في النظام', 'error');
                return;
            }
        } catch (error) {
            console.error('Error checking target store:', error);
            this.showMessage('❌ خطأ في التحقق من الفرع الهدف', 'error');
            return;
        }

        const warningMessage = `⚠️ تحذير هام:\n\n` +
            `• التحويل سيجمد الكميات لمدة 3 أيام فقط\n` +
            `• إذا لم يقبل الفرع الهدف خلال 3 أيام، سيتم إلغاء التحويل تلقائياً\n` +
            `• لا تقم ببيع الكميات المجمدة أثناء انتظار القبول\n\n` +
            `هل تريد المتابعة مع علمك بهذه الشروط؟`;

        if (!confirm(warningMessage)) {
            this.showMessage('❌ تم إلغاء التحويل', 'info');
            return;
        }

        const payload = {
            transfer_date: new Date().toISOString(),
            from_store: parseInt(this.state.fromStore),
            to_store: parseInt(this.state.toStore),
            transfer_lines: this.state.transferLines,
            user_id: parseInt(this.dom.userInfo?.dataset.userId || 
                    localStorage.getItem("user_id") || 
                    sessionStorage.getItem("user_id") || 1),
            remarks: this.dom.transferRemarks.value || ''
        };

        try {
            console.log('🔄 إرسال طلب معالجة التحويل:', payload);

            const response = await fetch(API.TRANSFER + '/process-transfer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'خطأ في الخادم: ' + response.status);
            }

            if (result.success) {
                this.showMessage('✅ تم معالجة التحويل بنجاح - الكميات مجمدة لمدة 3 أيام', 'success');
                this.newTransfer();
                
                if (result.transfer_no) {
                    setTimeout(() => this.printTransferReceipt(result.transfer_no), 1000);
                }
            } else {
                this.showMessage('❌ ' + (result.message || 'خطأ في معالجة التحويل'), 'error');
            }
        } catch (error) {
            console.error('Error processing transfer:', error);
            this.showMessage('❌ ' + error.message, 'error');
        }
    }

    newTransfer() {
        this.state.transferLines = [];
        this.state.currentItem = null;
        this.state.fromStore = null;
        this.state.toStore = null;
        this.state.currentFocus = 'fromStore';
        
        if (this.dom.fromStore) this.dom.fromStore.value = '';
        if (this.dom.toStore) this.dom.toStore.value = '';
        if (this.dom.itemSearch) this.dom.itemSearch.value = '';
        if (this.dom.transferQty) this.dom.transferQty.value = '1';
        if (this.dom.batchNoInput) this.dom.batchNoInput.value = '';
        if (this.dom.expiryDateInput) this.dom.expiryDateInput.value = '';
        if (this.dom.transferRemarks) this.dom.transferRemarks.value = '';
        if (this.dom.itemResults) this.dom.itemResults.style.display = 'none';
        if (this.dom.inventoryInfo) this.dom.inventoryInfo.style.display = 'none';
        
        this._updateStoreNames();
        this.renderTransferItems();
        this.showMessage('📝 تحويل جديد', 'info');
        
        if (this.dom.fromStore) this.dom.fromStore.focus();
    }

    cancelTransfer() {
        if (confirm('هل تريد إلغاء التحويل الحالي؟ سيتم فقدان جميع البيانات.')) {
            this.newTransfer();
        }
    }

    showMessage(message, type = 'info') {
        const toast = this.dom.toast;
        if (!toast) {
            console.log(type + ': ' + message);
            return;
        }

        toast.textContent = message;
        toast.style.display = 'block';
        toast.style.background = 
            type === 'success' ? '#27ae60' :
            type === 'error' ? '#e74c3c' :
            type === 'warning' ? '#f39c12' : '#3498db';

        setTimeout(() => {
            toast.style.display = 'none';
        }, 4000);
    }
}

let transferApp;
document.addEventListener('DOMContentLoaded', () => {
    transferApp = new TransferApp();
});