// offers.js - الإصدار المصحح مع إصلاح المشكلتين
class PriceOffers {
    constructor() {
        this.currentOffers = [];
        this.supabaseClient = null;
        this.SUPABASE_URL = 'https://rvjacvrrpguehbapvewe.supabase.co';
        this.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2amFjdnJycGd1ZWhiYXB2ZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMjUxNTksImV4cCI6MjA3ODYwMTE1OX0.wSavKzxKOF7-56G-pzDMtbXNrCNAbGs0wvadw-cilBg';
        
        this.selectedItemId = null;
        this.itemOriginalPrices = {
            sale_price1: 0,
            sale_price2: 0,
            sale_price3: 0
        };
        
        this.allStores = [];
        this.allItems = [];
        
        this.init();
    }

    async init() {
        try {
            console.log('🚀 تهيئة نظام العروض الهجين...');
            
            await this.initializeSupabase();
            await this.loadStores();
            await this.loadItems();
            this.setDefaultDates();
            this.attachEventListeners();
            this.setupEnterNavigation();
            this.setupDiscountTypeSelector();
            await this.loadOffers();
            
            console.log('✅ تم تهيئة نظام العروض بنجاح');
            
        } catch (error) {
            console.error('❌ خطأ في تهيئة النظام:', error);
            this.showToast('❌ فشل في تهيئة النظام: ' + error.message, 'error');
        }
    }

    /**
     * تحميل مكتبة Supabase من CDN
     */
    loadSupabaseLibrary() {
        return new Promise((resolve, reject) => {
            if (typeof supabase !== 'undefined') {
                console.log('✅ مكتبة Supabase محملة بالفعل');
                resolve();
                return;
            }
            
            console.log('📚 جاري تحميل مكتبة Supabase من CDN...');
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.onload = () => {
                console.log('✅ تم تحميل مكتبة Supabase بنجاح');
                resolve();
            };
            script.onerror = () => {
                console.error('❌ فشل تحميل مكتبة Supabase');
                reject(new Error('فشل تحميل مكتبة Supabase من CDN'));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * تهيئة Supabase
     */
    async initializeSupabase() {
        try {
            console.log('🔗 جاري تهيئة اتصال Supabase...');
            
            if (window.supabaseClient) {
                this.supabaseClient = window.supabaseClient;
                console.log('✅ استخدام عميل Supabase الحالي');
                return;
            }
            
            if (typeof supabase === 'undefined') {
                console.log('📚 جاري تحميل مكتبة Supabase...');
                await this.loadSupabaseLibrary();
            }
            
            if (typeof supabase === 'undefined') {
                throw new Error('فشل تحميل مكتبة Supabase');
            }
            
            console.log('🔑 جاري إنشاء عميل Supabase...');
            
            this.supabaseClient = supabase.createClient(this.SUPABASE_URL, this.SUPABASE_KEY);
            
            // اختبار الاتصال
            const { data, error } = await this.supabaseClient
                .from('stores')
                .select('count')
                .limit(1);
            
            if (error) {
                console.error('❌ فشل اختبار الاتصال:', error);
                throw new Error('فشل الاتصال بـ Supabase: ' + error.message);
            }
            
            window.supabaseClient = this.supabaseClient;
            
            console.log('✅ تم تهيئة Supabase بنجاح');
            
        } catch (error) {
            console.error('❌ فشل في تهيئة Supabase:', error);
            throw new Error('تعذر الاتصال بقاعدة البيانات: ' + error.message);
        }
    }

    /**
     * إعداد اختيار نوع التخفيض
     */
    setupDiscountTypeSelector() {
        const discountTypeRadios = document.querySelectorAll('input[name="discountType"]');
        const applyToAllStoresCheckbox = document.getElementById('applyToAllStores');
        const directPriceOptions = document.getElementById('directPriceOptions');
        const discountValueInput = document.getElementById('discountValue');
        const discountUnitSpan = document.getElementById('discountUnit');
        
        // إعداد الحالة الأولية
        this.updateDiscountFields();
        
        // مستمع لتغيير نوع التخفيض
        discountTypeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.updateDiscountFields();
                
                // إظهار/إخفاء خيارات السعر المباشر
                if (directPriceOptions) {
                    if (e.target.value === 'new_price') {
                        directPriceOptions.style.display = 'block';
                        // تفعيل حقول السعر المباشر
                        ['directPrice1', 'directPrice2', 'directPrice3'].forEach(id => {
                            const field = document.getElementById(id);
                            if (field) field.readOnly = false;
                        });
                    } else {
                        directPriceOptions.style.display = 'none';
                        // مسح حقول الأسعار المباشرة
                        ['directPrice1', 'directPrice2', 'directPrice3'].forEach(id => {
                            const field = document.getElementById(id);
                            if (field) field.value = '';
                        });
                    }
                }
                
                // إعادة حساب الأسعار إذا كان هناك صنف محدد
                if (this.selectedItemId) {
                    if (e.target.value === 'new_price') {
                        // للسعر المباشر، مسح المقارنة
                        this.clearPriceComparison();
                    } else {
                        this.calculateAndDisplayPrices();
                    }
                }
            });
        });
        
        // مستمع لـ checkbox جميع الفروع
        if (applyToAllStoresCheckbox) {
            applyToAllStoresCheckbox.addEventListener('change', (e) => {
                this.toggleAllStoresSelection(e.target.checked);
            });
        }
        
        // مستمع لتغيير الصنف
        const itemSelect = document.getElementById('item_id');
        if (itemSelect) {
            itemSelect.addEventListener('change', async (e) => {
                const itemId = e.target.value;
                if (itemId) {
                    await this.getItemOriginalPrices(itemId);
                    const discountType = document.querySelector('input[name="discountType"]:checked')?.value;
                    if (discountType !== 'new_price') {
                        this.calculateAndDisplayPrices();
                    }
                } else {
                    this.clearPriceComparison();
                }
            });
        }
        
        // مستمع لقيمة التخفيض
        if (discountValueInput) {
            discountValueInput.addEventListener('input', () => {
                if (this.selectedItemId) {
                    const discountType = document.querySelector('input[name="discountType"]:checked')?.value;
                    if (discountType !== 'new_price') {
                        this.calculateAndDisplayPrices();
                    }
                }
            });
        }
        
        // مستمع للأسعار المباشرة
        ['directPrice1', 'directPrice2', 'directPrice3'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', (e) => {
                    // تحديث حقول العرض مباشرة
                    const index = id.replace('directPrice', '');
                    const offerPriceInput = document.getElementById(`offer_price${index}`);
                    if (offerPriceInput) {
                        const value = parseFloat(e.target.value) || '';
                        offerPriceInput.value = value;
                    }
                    
                    // تحديث عرض المقارنة
                    this.calculateDirectPrices();
                });
            }
        });
    }

    /**
     * تحديث حقول التخفيض
     */
    updateDiscountFields() {
        const discountType = document.querySelector('input[name="discountType"]:checked')?.value || 'percentage';
        const discountValueInput = document.getElementById('discountValue');
        const discountUnitSpan = document.getElementById('discountUnit');
        const directPriceOptions = document.getElementById('directPriceOptions');
        
        if (!discountValueInput || !discountUnitSpan) return;
        
        switch(discountType) {
            case 'percentage':
                discountValueInput.placeholder = 'أدخل النسبة المئوية...';
                discountValueInput.max = 100;
                discountValueInput.min = 0;
                discountUnitSpan.textContent = '%';
                discountValueInput.disabled = false;
                discountValueInput.style.opacity = '1';
                discountValueInput.readOnly = false;
                if (directPriceOptions) directPriceOptions.style.display = 'none';
                break;
                
            case 'fixed_amount':
                discountValueInput.placeholder = 'أدخل المبلغ المخصوم...';
                discountValueInput.max = 999999;
                discountValueInput.min = 0;
                discountUnitSpan.textContent = 'ر.س';
                discountValueInput.disabled = false;
                discountValueInput.style.opacity = '1';
                discountValueInput.readOnly = false;
                if (directPriceOptions) directPriceOptions.style.display = 'none';
                break;
                
            case 'new_price':
                discountValueInput.placeholder = 'غير مطلوب';
                discountValueInput.value = '';
                discountValueInput.disabled = true;
                discountValueInput.style.opacity = '0.6';
                discountUnitSpan.textContent = '--';
                discountValueInput.readOnly = true;
                if (directPriceOptions) directPriceOptions.style.display = 'block';
                break;
        }
        
        // مسح حقول العرض المحسوبة
        ['offer_price1', 'offer_price2', 'offer_price3'].forEach(id => {
            const field = document.getElementById(id);
            if (field) {
                field.value = '';
                if (discountType === 'new_price') {
                    field.readOnly = false; // يجعلها قابلة للكتابة
                } else {
                    field.readOnly = true; // يجعلها للقراءة فقط
                }
            }
        });
    }

    /**
     * حساب الأسعار للخصم المباشر
     */
    calculateDirectPrices() {
        const directPrice1 = parseFloat(document.getElementById('directPrice1')?.value) || 0;
        const directPrice2 = parseFloat(document.getElementById('directPrice2')?.value) || 0;
        const directPrice3 = parseFloat(document.getElementById('directPrice3')?.value) || 0;
        
        // تحديث عرض المقارنة
        for (let i = 1; i <= 3; i++) {
            const original = this.itemOriginalPrices[`sale_price${i}`] || 0;
            const directPrice = i === 1 ? directPrice1 : i === 2 ? directPrice2 : directPrice3;
            
            const priceData = {
                original: original,
                discounted: directPrice,
                saving: original - directPrice,
                savingPercent: original > 0 ? ((original - directPrice) / original * 100) : 0
            };
            
            this.updatePriceDisplay(i, priceData, 'new_price', 0);
        }
    }

    /**
     * إضافة عرض جديد - الإصدار المصحح
     */
    async addOffer() {
        try {
            this.showToast('⏳ جاري إضافة العرض...', 'info');
            
            if (!this.supabaseClient) {
                throw new Error('تعذر الاتصال بقاعدة البيانات');
            }
            
            // جمع البيانات من النموذج
            const discountType = document.querySelector('input[name="discountType"]:checked')?.value || 'percentage';
            const discountValue = parseFloat(document.getElementById('discountValue')?.value) || 0;
            const applyToAllStores = document.getElementById('applyToAllStores')?.checked || false;
            
            let targetStores = [];
            
            if (applyToAllStores) {
                targetStores = this.allStores;
            } else {
                const selectedStoreId = document.getElementById('store_id')?.value;
                if (!selectedStoreId) {
                    this.showToast('⚠️ يجب اختيار فرع أو تحديد "جميع الفروع"', 'warning');
                    return;
                }
                
                const selectedStore = this.allStores.find(store => store.store_id == selectedStoreId);
                if (selectedStore) targetStores = [selectedStore];
            }
            
            if (targetStores.length === 0) {
                this.showToast('⚠️ يجب تحديد فرع واحد على الأقل', 'warning');
                return;
            }
            
            const itemId = document.getElementById('item_id')?.value;
            const startDate = document.getElementById('startDate')?.value;
            const endDate = document.getElementById('endDate')?.value || null;
            
            if (!itemId || !startDate) {
                this.showToast('⚠️ الفرع والصنف وتاريخ البداية إلزامية', 'warning');
                return;
            }
            
            // الحصول على الأسعار بناءً على نوع الخصم
            let offer_price1, offer_price2, offer_price3;
            
            if (discountType === 'new_price') {
                // الأسعار المباشرة
                offer_price1 = parseFloat(document.getElementById('directPrice1')?.value) || null;
                offer_price2 = parseFloat(document.getElementById('directPrice2')?.value) || null;
                offer_price3 = parseFloat(document.getElementById('directPrice3')?.value) || null;
            } else {
                // الأسعار المحسوبة
                offer_price1 = parseFloat(document.getElementById('offer_price1')?.value) || null;
                offer_price2 = parseFloat(document.getElementById('offer_price2')?.value) || null;
                offer_price3 = parseFloat(document.getElementById('offer_price3')?.value) || null;
            }
            
            // التحقق من إدخال سعر واحد على الأقل
            if (!offer_price1 && !offer_price2 && !offer_price3) {
                this.showToast('⚠️ يجب إدخال سعر عرض واحد على الأقل', 'warning');
                return;
            }
            
            // التحقق من صحة التواريخ
            if (endDate && endDate < startDate) {
                this.showToast('⚠️ تاريخ النهاية يجب أن يكون بعد تاريخ البداية', 'warning');
                return;
            }
            
            // التحقق من صحة قيمة التخفيض
            if (discountType !== 'new_price') {
                if (discountValue <= 0) {
                    this.showToast('⚠️ قيمة التخفيض يجب أن تكون أكبر من صفر', 'warning');
                    return;
                }
                
                if (discountType === 'percentage' && discountValue > 100) {
                    this.showToast('⚠️ النسبة المئوية لا يمكن أن تتجاوز 100%', 'warning');
                    return;
                }
            }
            
            // التحقق من الأسعار السالبة
            if ((offer_price1 && offer_price1 < 0) || 
                (offer_price2 && offer_price2 < 0) || 
                (offer_price3 && offer_price3 < 0)) {
                this.showToast('⚠️ لا يمكن أن يكون السعر سالباً', 'warning');
                return;
            }
            
            // تأكيد من المستخدم
            let confirmMessage = '';
            if (applyToAllStores && targetStores.length > 1) {
                confirmMessage = `هل تريد تطبيق هذا العرض على جميع الفروع (${targetStores.length} فرع)؟`;
            } else if (discountType === 'new_price') {
                confirmMessage = 'هل تريد إضافة أسعار جديدة مباشرة؟';
            } else if (discountType === 'fixed_amount') {
                confirmMessage = `هل تريد تطبيق خصم بقيمة ${discountValue} ريال؟`;
            } else {
                confirmMessage = `هل تريد تطبيق خصم بنسبة ${discountValue}%؟`;
            }
            
            if (!confirm(confirmMessage)) {
                return;
            }
            
            // ✅ الإصلاح: بدون applied_to_all
            const offersToAdd = targetStores.map(store => ({
                store_id: store.store_id,
                item_id: itemId,
                discount_type: discountType,
                discount_value: discountValue,
                original_price1: this.itemOriginalPrices.sale_price1,
                original_price2: this.itemOriginalPrices.sale_price2,
                original_price3: this.itemOriginalPrices.sale_price3,
                offer_price1: offer_price1,
                offer_price2: offer_price2,
                offer_price3: offer_price3,
                start_date: startDate,
                end_date: endDate,
                is_active: true,
                created_by: localStorage.getItem("username") || sessionStorage.getItem("username") || "Admin"
                // ⚠️ تم حذف applied_to_all تماماً
            }));
            
            console.log('📤 جاري إرسال البيانات:', offersToAdd);
            
            // إضافة العروض إلى Supabase
            const { data, error } = await this.supabaseClient
                .from('item_price_offers')
                .insert(offersToAdd)
                .select();
            
            if (error) {
                console.error('❌ خطأ Supabase:', error);
                throw new Error(`خطأ في قاعدة البيانات: ${error.message}`);
            }
            
            let successMessage = '';
            if (applyToAllStores) {
                successMessage = `✅ تم إضافة العرض إلى جميع الفروع (${targetStores.length} عرض)`;
            } else if (discountType === 'new_price') {
                successMessage = '✅ تم إضافة الأسعار الجديدة بنجاح';
            } else if (discountType === 'fixed_amount') {
                successMessage = `✅ تم إضافة خصم بقيمة ${discountValue} ريال بنجاح`;
            } else {
                successMessage = `✅ تم إضافة خصم بنسبة ${discountValue}% بنجاح`;
            }
            
            this.showToast(successMessage, 'success');
            this.clearForm();
            await this.loadOffers();
            
        } catch (error) {
            console.error('❌ خطأ في إضافة العرض:', error);
            this.showToast(`❌ ${error.message}`, 'error');
        }
    }

    /**
     * مسح النموذج
     */
    clearForm() {
        const fields = ['store_id', 'item_id', 'discountValue', 'offer_price1', 'offer_price2', 'offer_price3', 'startDate', 'endDate'];
        
        fields.forEach(id => {
            const field = document.getElementById(id);
            if (field) {
                if (field.tagName === 'SELECT') {
                    field.selectedIndex = 0;
                } else {
                    field.value = '';
                }
            }
        });
        
        // مسح حقول الأسعار المباشرة
        ['directPrice1', 'directPrice2', 'directPrice3'].forEach(id => {
            const field = document.getElementById(id);
            if (field) field.value = '';
        });
        
        // إعادة تعيين checkbox جميع الفروع
        const applyToAllStoresCheckbox = document.getElementById('applyToAllStores');
        if (applyToAllStoresCheckbox) {
            applyToAllStoresCheckbox.checked = false;
            this.toggleAllStoresSelection(false);
        }
        
        // إعادة تعيين نوع التخفيض للنسبة المئوية
        const percentageRadio = document.querySelector('input[value="percentage"]');
        if (percentageRadio) {
            percentageRadio.checked = true;
        }
        
        // إخفاء خيارات الأسعار المباشرة
        const directPriceOptions = document.getElementById('directPriceOptions');
        if (directPriceOptions) {
            directPriceOptions.style.display = 'none';
        }
        
        this.updateDiscountFields();
        this.clearPriceComparison();
        this.setDefaultDates();
        
        // إعادة تعيين الأسعار الأصلية
        this.selectedItemId = null;
        this.itemOriginalPrices = {
            sale_price1: 0,
            sale_price2: 0,
            sale_price3: 0
        };
        
        // التركيز على حقل الفرع
        const storeSelect = document.getElementById('store_id');
        if (storeSelect) {
            storeSelect.focus();
        }
    }

    /**
     * تفعيل/تعطيل خيار جميع الفروع
     */
    toggleAllStoresSelection(isChecked) {
        const storeSelect = document.getElementById('store_id');
        const selectedStoresInfo = document.getElementById('selectedStoresInfo');
        const storesCountSpan = document.getElementById('storesCount');
        
        if (isChecked) {
            storeSelect.disabled = true;
            storeSelect.value = '';
            storeSelect.style.opacity = '0.6';
            storeSelect.style.cursor = 'not-allowed';
            
            const storesCount = this.allStores.length;
            if (storesCountSpan) storesCountSpan.textContent = storesCount;
            if (selectedStoresInfo) selectedStoresInfo.style.display = 'block';
            
            this.showToast(`✅ سيتم تطبيق العرض على جميع الفروع (${storesCount} فرع)`, 'success');
        } else {
            storeSelect.disabled = false;
            storeSelect.style.opacity = '1';
            storeSelect.style.cursor = 'pointer';
            if (selectedStoresInfo) selectedStoresInfo.style.display = 'none';
        }
    }

    /**
     * الباقي من الدوال (تبقى كما هي بدون تغيير)
     */
    async loadStores() {
        try {
            console.log('🔄 جاري تحميل الفروع...');
            
            if (!this.supabaseClient) {
                throw new Error('عميل Supabase غير مهيأ');
            }
            
            const { data, error } = await this.supabaseClient
                .from('stores')
                .select('store_id, store_name')
                .order('store_name');
            
            if (error) throw error;
            
            this.allStores = data || [];
            
            const storeSelect = document.getElementById('store_id');
            if (!storeSelect) {
                console.warn('❌ عنصر store_id غير موجود');
                return;
            }
            
            storeSelect.innerHTML = '<option value="">اختر الفرع...</option>';
            this.allStores.forEach(store => {
                const option = document.createElement('option');
                option.value = store.store_id;
                option.textContent = store.store_name || `الفرع ${store.store_id}`;
                storeSelect.appendChild(option);
            });
            
            console.log(`✅ تم تحميل ${this.allStores.length} فرع`);
            this.updateStoresCount();
            
        } catch (error) {
            console.error('❌ خطأ في تحميل الفروع:', error);
            this.showToast('❌ فشل في تحميل الفروع: ' + error.message, 'error');
        }
    }

    /**
     * تحديث عدد الفروع في الإحصائيات
     */
    updateStoresCount() {
        const totalStoresElement = document.getElementById('totalStores');
        if (totalStoresElement) {
            totalStoresElement.textContent = this.allStores.length;
        }
    }

    /**
     * تحميل الأصناف من Supabase
     */
    async loadItems() {
        try {
            console.log('🔄 جاري تحميل الأصناف...');
            
            if (!this.supabaseClient) {
                throw new Error('عميل Supabase غير مهيأ');
            }
            
            const { data, error } = await this.supabaseClient
                .from('items')
                .select('item_id, item_nm')
                .order('item_nm')
                .limit(1000);
            
            if (error) throw error;
            
            this.allItems = data || [];
            
            const itemSelect = document.getElementById('item_id');
            if (!itemSelect) {
                console.warn('❌ عنصر item_id غير موجود');
                return;
            }
            
            itemSelect.innerHTML = '<option value="">اختر الصنف...</option>';
            this.allItems.forEach(item => {
                const option = document.createElement('option');
                option.value = item.item_id;
                option.textContent = item.item_nm || `الصنف ${item.item_id}`;
                itemSelect.appendChild(option);
            });
            
            console.log(`✅ تم تحميل ${this.allItems.length} صنف`);
            
        } catch (error) {
            console.error('❌ خطأ في تحميل الأصناف:', error);
            this.showToast('❌ فشل في تحميل الأصناف: ' + error.message, 'error');
        }
    }

    /**
     * جلب الأسعار الأصلية للصنف
     */
    async getItemOriginalPrices(itemId) {
        try {
            console.log(`🔍 جاري البحث عن أسعار الصنف: ${itemId}`);
            
            if (!this.supabaseClient) {
                throw new Error('عميل Supabase غير مهيأ');
            }
            
            const { data, error } = await this.supabaseClient
                .from('a_master')
                .select('sale_price1, sale_price2, sale_price3')
                .eq('item_id', itemId)
                .order('tran_date', { ascending: false })
                .limit(1);
            
            if (error) {
                console.warn('⚠️ خطأ في جلب الأسعار الأصلية:', error);
                this.itemOriginalPrices = {
                    sale_price1: 0,
                    sale_price2: 0,
                    sale_price3: 0
                };
                return;
            }
            
            if (data && data.length > 0) {
                this.selectedItemId = itemId;
                this.itemOriginalPrices = {
                    sale_price1: parseFloat(data[0].sale_price1) || 0,
                    sale_price2: parseFloat(data[0].sale_price2) || 0,
                    sale_price3: parseFloat(data[0].sale_price3) || 0
                };
                
                console.log('✅ الأسعار الأصلية:', this.itemOriginalPrices);
            } else {
                console.log('⚠️ لم يتم العثور على أسعار لهذا الصنف');
                this.itemOriginalPrices = {
                    sale_price1: 0,
                    sale_price2: 0,
                    sale_price3: 0
                };
            }
            
        } catch (error) {
            console.error('❌ خطأ في جلب الأسعار الأصلية:', error);
            this.itemOriginalPrices = {
                sale_price1: 0,
                sale_price2: 0,
                sale_price3: 0
            };
        }
    }

    /**
     * تحميل العروض من Supabase
     */
    async loadOffers() {
        try {
            console.log('🔄 جاري تحميل العروض...');
            
            if (!this.supabaseClient) {
                throw new Error('عميل Supabase غير مهيأ');
            }
            
            const { data: offersData, error: offersError } = await this.supabaseClient
                .from('item_price_offers')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);
            
            if (offersError) throw offersError;
            
            this.currentOffers = offersData || [];
            console.log(`✅ تم تحميل ${this.currentOffers.length} عرض`);
            
            await this.enrichOffersData();
            this.renderOffers();
            this.updateStatistics();
            
        } catch (error) {
            console.error('❌ خطأ في تحميل العروض:', error);
            this.showToast('❌ فشل في تحميل العروض: ' + error.message, 'error');
            
            const container = document.getElementById('offersData');
            if (container) {
                container.innerHTML = `
                    <div class="no-data error">
                        ❌ ${error.message}
                        <button onclick="window.priceOffers.loadOffers()" class="retry-btn">
                            🔄 إعادة المحاولة
                        </button>
                    </div>
                `;
            }
        }
    }

    /**
     * تحديث الإحصائيات
     */
    updateStatistics() {
        const totalOffers = this.currentOffers.length;
        const activeOffers = this.currentOffers.filter(o => o.is_active).length;
        const now = new Date();
        const expiredOffers = this.currentOffers.filter(o => {
            return o.end_date && new Date(o.end_date) < now;
        }).length;
        
        const totalOffersElement = document.getElementById('totalOffers');
        const activeOffersElement = document.getElementById('activeOffers');
        const expiredOffersElement = document.getElementById('expiredOffers');
        
        if (totalOffersElement) totalOffersElement.textContent = totalOffers;
        if (activeOffersElement) activeOffersElement.textContent = activeOffers;
        if (expiredOffersElement) expiredOffersElement.textContent = expiredOffers;
    }

    /**
     * إثراء بيانات العروض بأسماء الفروع والأصناف
     */
    async enrichOffersData() {
        try {
            if (!this.supabaseClient || this.currentOffers.length === 0) return;

            const storeIds = [...new Set(this.currentOffers.map(o => o.store_id).filter(id => id))];
            const itemIds = [...new Set(this.currentOffers.map(o => o.item_id).filter(id => id))];
            
            const [storesResult, itemsResult] = await Promise.all([
                storeIds.length > 0 ? 
                    this.supabaseClient.from('stores')
                        .select('store_id, store_name')
                        .in('store_id', storeIds) : { data: [] },
                itemIds.length > 0 ?
                    this.supabaseClient.from('items')
                        .select('item_id, item_nm')
                        .in('item_id', itemIds) : { data: [] }
            ]);
            
            const storesMap = new Map();
            const itemsMap = new Map();
            
            if (storesResult.data) {
                storesResult.data.forEach(store => {
                    storesMap.set(store.store_id, store.store_name);
                });
            }
            
            if (itemsResult.data) {
                itemsResult.data.forEach(item => {
                    itemsMap.set(item.item_id, item.item_nm);
                });
            }
            
            this.currentOffers = this.currentOffers.map(offer => ({
                ...offer,
                store_name: storesMap.get(offer.store_id) || `الفرع ${offer.store_id}`,
                item_name: itemsMap.get(offer.item_id) || `الصنف ${offer.item_id}`,
                discount_type: offer.discount_type || 'percentage',
                discount_value: offer.discount_value || 0
            }));
            
        } catch (error) {
            console.warn('⚠️ فشل في إثراء بيانات العروض:', error);
            this.currentOffers = this.currentOffers.map(offer => ({
                ...offer,
                store_name: offer.store_id ? `الفرع ${offer.store_id}` : 'غير محدد',
                item_name: offer.item_id ? `الصنف ${offer.item_id}` : 'غير محدد'
            }));
        }
    }

    /**
     * حساب الأسعار وعرضها
     */
    calculateAndDisplayPrices() {
        try {
            const discountType = document.querySelector('input[name="discountType"]:checked')?.value || 'percentage';
            
            if (discountType === 'new_price') {
                this.calculateDirectPrices();
                return;
            }
            
            const discountValue = parseFloat(document.getElementById('discountValue').value) || 0;
            
            if (discountValue <= 0) {
                this.clearPriceComparison();
                return;
            }
            
            const discountedPrices = this.calculateDiscountedPrices(discountType, discountValue);
            
            for (let i = 1; i <= 3; i++) {
                const priceData = discountedPrices[`price${i}`];
                this.updatePriceDisplay(i, priceData, discountType, discountValue);
            }
        } catch (error) {
            console.error('❌ خطأ في حساب الأسعار:', error);
        }
    }

    /**
     * حساب الأسعار المخفضة
     */
    calculateDiscountedPrices(discountType, discountValue) {
        const result = {
            price1: { original: 0, discounted: 0, saving: 0, savingPercent: 0 },
            price2: { original: 0, discounted: 0, saving: 0, savingPercent: 0 },
            price3: { original: 0, discounted: 0, saving: 0, savingPercent: 0 }
        };
        
        if (!discountValue || discountValue <= 0) return result;
        
        ['sale_price1', 'sale_price2', 'sale_price3'].forEach((priceKey, index) => {
            const original = this.itemOriginalPrices[priceKey] || 0;
            let discounted = original;
            
            if (original <= 0) {
                result[`price${index + 1}`] = { original: 0, discounted: 0, saving: 0, savingPercent: 0 };
                return;
            }
            
            if (discountType === 'percentage') {
                if (discountValue <= 100) {
                    discounted = original * (1 - (discountValue / 100));
                }
            } else if (discountType === 'fixed_amount') {
                discounted = original - discountValue;
                if (discounted < 0) discounted = 0;
            }
            
            const saving = original - discounted;
            const savingPercent = original > 0 ? (saving / original * 100) : 0;
            
            result[`price${index + 1}`] = {
                original: original,
                discounted: this.roundPrice(discounted),
                saving: this.roundPrice(saving),
                savingPercent: this.roundPrice(savingPercent)
            };
        });
        
        return result;
    }

    /**
     * تحديث عرض السعر
     */
    updatePriceDisplay(index, priceData, discountType, discountValue) {
        const originalEl = document.getElementById(`originalPrice${index}`);
        const discountedEl = document.getElementById(`discountedPrice${index}`);
        const savingEl = document.getElementById(`saving${index}`);
        const offerPriceInput = document.getElementById(`offer_price${index}`);
        
        if (originalEl) {
            originalEl.textContent = this.roundPrice(priceData.original).toFixed(2);
        }
        
        if (discountedEl) {
            discountedEl.textContent = priceData.discounted.toFixed(2);
            
            if (discountType === 'new_price') {
                discountedEl.style.color = '#9b59b6';
            } else {
                discountedEl.style.color = priceData.discounted < priceData.original ? '#27ae60' : '#333';
            }
        }
        
        if (savingEl) {
            if (priceData.saving > 0) {
                let savingText = '';
                
                if (discountType === 'new_price') {
                    savingText = `${priceData.saving.toFixed(2)} ج.م (${priceData.savingPercent.toFixed(1)}%)`;
                } else if (discountType === 'percentage') {
                    savingText = `${priceData.saving.toFixed(2)} ج.م (${discountValue}%)`;
                } else {
                    savingText = `${priceData.saving.toFixed(2)} ج.م (خصم ثابت)`;
                }
                
                savingEl.innerHTML = `<span class="saving-amount">${savingText}</span>`;
                savingEl.style.color = '#e74c3c';
            } else if (priceData.saving < 0) {
                savingEl.innerHTML = `<span class="price-increase">+${Math.abs(priceData.saving).toFixed(2)} ج.م (زيادة)</span>`;
                savingEl.style.color = '#f39c12';
            } else {
                savingEl.textContent = '0.00 (بدون تغيير)';
                savingEl.style.color = '#999';
            }
        }
        
        if (offerPriceInput && discountType !== 'new_price') {
            offerPriceInput.value = priceData.discounted > 0 ? priceData.discounted : '';
        }
    }

    /**
     * تقريب السعر
     */
    roundPrice(price) {
        return Math.round(price * 100) / 100;
    }

    /**
     * مسح مقارنة الأسعار
     */
    clearPriceComparison() {
        for (let i = 1; i <= 3; i++) {
            const originalEl = document.getElementById(`originalPrice${i}`);
            const discountedEl = document.getElementById(`discountedPrice${i}`);
            const savingEl = document.getElementById(`saving${i}`);
            const offerPriceInput = document.getElementById(`offer_price${i}`);
            
            if (originalEl) originalEl.textContent = '0.00';
            if (discountedEl) {
                discountedEl.textContent = '0.00';
                discountedEl.style.color = '#333';
            }
            if (savingEl) {
                savingEl.textContent = '0.00 (0%)';
                savingEl.style.color = '#999';
            }
            if (offerPriceInput) offerPriceInput.value = '';
        }
    }

    /**
     * عرض العروض في الجدول
     */
    renderOffers() {
        const container = document.getElementById('offersData');
        if (!container) {
            console.error('❌ عنصر offersData غير موجود');
            return;
        }
        
        if (!this.currentOffers || this.currentOffers.length === 0) {
            container.innerHTML = '<div class="no-data">📭 لا توجد عروض حالية</div>';
            return;
        }

        let html = `
            <div class="table-responsive">
                <table class="offers-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>الفرع</th>
                            <th>الصنف</th>
                            <th>نوع العرض</th>
                            <th>قيمة التخفيض</th>
                            <th>الأصلي 1</th>
                            <th>العرض 1</th>
                            <th>الأصلي 2</th>
                            <th>العرض 2</th>
                            <th>الأصلي 3</th>
                            <th>العرض 3</th>
                            <th>البداية</th>
                            <th>النهاية</th>
                            <th>الحالة</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>`;

        this.currentOffers.forEach((offer, index) => {
            const isActive = offer.is_active;
            const statusText = isActive ? '🟢 فعال' : '🔴 موقف';
            const statusClass = isActive ? 'active' : 'inactive';
            
            let offerType = '', discountValueText = '';
            
            switch(offer.discount_type) {
                case 'percentage':
                    offerType = 'نسبة %';
                    discountValueText = `${offer.discount_value}%`;
                    break;
                case 'fixed_amount':
                    offerType = 'قيمة ثابتة';
                    discountValueText = `${offer.discount_value} ج.م`;
                    break;
                case 'new_price':
                    offerType = 'سعر مباشر';
                    discountValueText = '--';
                    break;
                default:
                    offerType = 'نسبة %';
                    discountValueText = `${offer.discount_value || 0}%`;
            }
            
            const originalPrice1 = offer.original_price1 || 0;
            const originalPrice2 = offer.original_price2 || 0;
            const originalPrice3 = offer.original_price3 || 0;
            const offerPrice1 = offer.offer_price1 || 0;
            const offerPrice2 = offer.offer_price2 || 0;
            const offerPrice3 = offer.offer_price3 || 0;
            
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${offer.store_name || `الفرع ${offer.store_id}`}</td>
                    <td>${offer.item_name || `الصنف ${offer.item_id}`}</td>
                    <td><span class="offer-type-badge ${offer.discount_type}">${offerType}</span></td>
                    <td><span class="discount-value">${discountValueText}</span></td>
                    <td class="original-price">${originalPrice1.toFixed(2)}</td>
                    <td class="offer-price ${offerPrice1 < originalPrice1 ? 'discounted' : offerPrice1 > originalPrice1 ? 'increased' : ''}">
                        ${offerPrice1.toFixed(2)}
                        ${offerPrice1 < originalPrice1 ? '⬇️' : 
                         offerPrice1 > originalPrice1 ? '⬆️' : ''}
                    </td>
                    <td class="original-price">${originalPrice2.toFixed(2)}</td>
                    <td class="offer-price ${offerPrice2 < originalPrice2 ? 'discounted' : offerPrice2 > originalPrice2 ? 'increased' : ''}">
                        ${offerPrice2.toFixed(2)}
                        ${offerPrice2 < originalPrice2 ? '⬇️' : 
                         offerPrice2 > originalPrice2 ? '⬆️' : ''}
                    </td>
                    <td class="original-price">${originalPrice3.toFixed(2)}</td>
                    <td class="offer-price ${offerPrice3 < originalPrice3 ? 'discounted' : offerPrice3 > originalPrice3 ? 'increased' : ''}">
                        ${offerPrice3.toFixed(2)}
                        ${offerPrice3 < originalPrice3 ? '⬇️' : 
                         offerPrice3 > originalPrice3 ? '⬆️' : ''}
                    </td>
                    <td>${offer.start_date ? new Date(offer.start_date).toLocaleDateString('ar-EG') : '-'}</td>
                    <td>${offer.end_date ? new Date(offer.end_date).toLocaleDateString('ar-EG') : '-'}</td>
                    <td class="status-cell ${statusClass}">${statusText}</td>
                    <td class="actions-cell">
                        <button class="toggle-btn ${isActive ? 'deactivate' : 'activate'}" 
                                onclick="window.priceOffers.toggleOffer(${offer.offer_id}, ${isActive})">
                            ${isActive ? '⏸️ إيقاف' : '▶️ تفعيل'}
                        </button>
                    </td>
                </tr>`;
        });

        html += `
                    </tbody>
                </table>
            </div>`;
        
        container.innerHTML = html;
    }

    /**
     * تبديل حالة العرض
     */
    async toggleOffer(id, currentStatus) {
        try {
            if (!this.supabaseClient) {
                throw new Error('تعذر الاتصال بقاعدة البيانات');
            }
            
            if (!confirm(`هل تريد ${currentStatus ? 'إيقاف' : 'تفعيل'} هذا العرض؟`)) {
                return;
            }
            
            const { error } = await this.supabaseClient
                .from('item_price_offers')
                .update({ is_active: !currentStatus })
                .eq('offer_id', id);

            if (error) throw error;

            await this.loadOffers();
            this.showToast('✅ تم تحديث حالة العرض', 'success');

        } catch(error) {
            console.error('❌ خطأ في تحديث حالة العرض:', error);
            this.showToast(`❌ ${error.message}`, 'error');
        }
    }

    /**
     * تعيين التواريخ الافتراضية
     */
    setDefaultDates() {
        const today = new Date();
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        
        if (startDateInput) {
            startDateInput.value = today.toISOString().split('T')[0];
            startDateInput.min = today.toISOString().split('T')[0];
        }
        
        if (endDateInput) {
            endDateInput.min = today.toISOString().split('T')[0];
        }
    }

    /**
     * عرض الرسائل للمستخدم
     */
    showToast(message, type = 'info') {
        console.log(`📢 ${type}: ${message}`);
        
        let toast = document.getElementById('toast');
        
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                padding: 12px 24px;
                border-radius: 8px;
                color: white;
                font-weight: 600;
                z-index: 9999;
                display: none;
                min-width: 300px;
                text-align: center;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            `;
            document.body.appendChild(toast);
        }
        
        let backgroundColor;
        switch(type) {
            case 'success':
                backgroundColor = '#27ae60';
                break;
            case 'error':
                backgroundColor = '#e74c3c';
                break;
            case 'warning':
                backgroundColor = '#f39c12';
                break;
            default:
                backgroundColor = '#3498db';
        }
        
        toast.textContent = message;
        toast.style.background = backgroundColor;
        toast.style.display = 'block';
        
        setTimeout(() => {
            toast.style.display = 'none';
        }, 5000);
    }

    /**
     * إضافة مستمعي الأحداث
     */
    attachEventListeners() {
        const addBtn = document.getElementById('addOfferBtn');
        const clearBtn = document.getElementById('clearBtn');
        const refreshBtn = document.getElementById('refreshBtn');
        
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addOffer());
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearForm());
        }
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                this.showToast('🔄 جاري تحديث البيانات...', 'info');
                try {
                    await this.loadStores();
                    await this.loadItems();
                    await this.loadOffers();
                    this.showToast('✅ تم تحديث البيانات بنجاح', 'success');
                } catch (error) {
                    this.showToast('❌ فشل في تحديث البيانات', 'error');
                }
            });
        }
    }

    /**
     * إعداد التنقل باستخدام مفتاح Enter
     */
    setupEnterNavigation() {
        const fields = ['store_id', 'item_id', 'discountValue', 'offer_price1', 'offer_price2', 'offer_price3', 'startDate', 'endDate'];
        
        fields.forEach((id, index) => {
            const field = document.getElementById(id);
            if (field) {
                field.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        
                        if (index < fields.length - 1) {
                            const nextField = document.getElementById(fields[index + 1]);
                            if (nextField) nextField.focus();
                        } else {
                            const addBtn = document.getElementById('addOfferBtn');
                            if (addBtn) addBtn.click();
                        }
                    }
                });
            }
        });
    }
}

// تهيئة التطبيق
let priceOffers;
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 الصفحة محملة، جاري تهيئة التطبيق...');
    
    try {
        priceOffers = new PriceOffers();
        window.priceOffers = priceOffers;
        
    } catch (error) {
        console.error('❌ خطأ في تهيئة التطبيق:', error);
        alert('خطأ في تهيئة التطبيق: ' + error.message);
    }
});