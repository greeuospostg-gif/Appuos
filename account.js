// account.js - معدل باستخدام النظام الموحد

// تعريف المدير الخاص بالحسابات
class AccountsManager {
    constructor() {
        this.supabase = null;
        this.accountTypes = [];
        this.allAccounts = [];
        this.currentEditId = null;
        this.init();
    }

    // تهيئة المدير
    async init() {
        this.initDOM();
        await this.initSupabase();
        this.bindEvents();
        await this.loadInitialData();
    }

    // تهيئة عناصر DOM
    initDOM() {
        this.dom = {
            accountTypeId: document.getElementById("account_type_id"),
            supplierSection: document.getElementById("supplier_section"),
            customerSection: document.getElementById("customer_section"),
            manualSection: document.getElementById("manual_section"),
            supplierId: document.getElementById("supplier_id"),
            customerId: document.getElementById("customer_id"),
            manualCode: document.getElementById("manual_code"),
            manualName: document.getElementById("manual_name"),
            saveBtn: document.getElementById("saveAccountBtn"),
            accountsTableBody: document.querySelector("#accounts_table tbody"),
            searchBox: document.querySelector(".search-box"),
            alertMessage: document.getElementById("alertMessage")
        };
    }

    // تهيئة Supabase باستخدام النظام المركزي
    async initSupabase() {
        try {
            if (window.supabaseManager) {
                this.supabase = await window.supabaseManager.getClient();
                
                if (this.supabase) {
                    console.log("✅ تم تهيئة Supabase للحسابات بنجاح");
                    // تحديث حالة الاتصال إذا كان المكون موجوداً
                    if (window.connectionStatus) {
                        window.connectionStatus.update(true);
                    }
                    return true;
                }
            }
            
            // إذا لم يكن النظام المركزي موجوداً، ننشئ اتصالاً مباشراً
            console.warn("⚠️ النظام المركزي غير موجود، إنشاء اتصال مباشر");
            this.supabase = window.supabase.createClient(
                'https://rvjacvrrpguehbapvewe.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2amFjdnJycGd1ZWhiYXB2ZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMjUxNTksImV4cCI6MjA3ODYwMTE1OX0.wSavKzxKOF7-56G-pzDMtbXNrCNAbGs0wvadw-cilBg'
            );
            
            return true;
        } catch (error) {
            console.error("❌ فشل تهيئة Supabase للحسابات:", error);
            this.showAlert("خطأ في الاتصال بقاعدة البيانات", 'error');
            return false;
        }
    }

    // ربط الأحداث
    bindEvents() {
        // زر الحفظ
        if (this.dom.saveBtn) {
            this.dom.saveBtn.addEventListener("click", () => this.saveAccount());
        }

        // تغيير نوع الحساب
        if (this.dom.accountTypeId) {
            this.dom.accountTypeId.addEventListener("change", () => this.handleAccountTypeChange());
        }

        // البحث
        if (this.dom.searchBox) {
            this.dom.searchBox.addEventListener('input', (e) => this.handleSearch(e));
        }

        // التنقل بالـ Enter
        this.setupEnterNavigation();

        // جعل الدوال متاحة عالمياً
        window.editAccount = (id) => this.editAccount(id);
        window.deleteAccount = (id) => this.deleteAccount(id);
    }

    // تحميل البيانات الأولية
    async loadInitialData() {
        try {
            await this.loadAccountTypes();
            await this.loadAccounts();
        } catch (error) {
            console.error("❌ خطأ في تحميل البيانات الأولية:", error);
        }
    }

    // عرض رسالة تنبيه
    showAlert(message, type = 'success') {
        if (this.dom.alertMessage) {
            this.dom.alertMessage.textContent = message;
            this.dom.alertMessage.className = `alert alert-${type}`;
            this.dom.alertMessage.style.display = 'block';
            
            setTimeout(() => {
                this.dom.alertMessage.style.display = 'none';
            }, 5000);
        } else {
            alert(message);
        }
    }

    // تحميل الحسابات الرئيسية
    async loadAccountTypes() {
        try {
            if (!this.supabase) {
                await this.initSupabase();
                if (!this.supabase) return;
            }

            let { data, error } = await this.supabase
                .from("account_types")
                .select("*")
                .order("account_type_id");

            if (error) throw error;

            this.accountTypes = data || [];

            if (this.dom.accountTypeId) {
                this.dom.accountTypeId.innerHTML = `
                    <option value="">اختر الحساب الرئيسي</option>
                    ${this.accountTypes.map(t => `
                        <option value="${t.account_type_id}">
                            ${t.account_type_name} (${t.account_type_id})
                        </option>
                    `).join("")}
                `;
            }
        } catch (error) {
            console.error('Error loading account types:', error);
            this.showAlert('خطأ في تحميل أنواع الحسابات', 'error');
        }
    }

    // تحميل الموردين
    async loadSuppliers() {
        try {
            if (!this.supabase) {
                await this.initSupabase();
                if (!this.supabase) return;
            }

            let { data, error } = await this.supabase.from("suppliers").select("*");
            if (error) throw error;
            
            if (this.dom.supplierId) {
                this.dom.supplierId.innerHTML = data.map(s => 
                    `<option value="${s.supplierid}">${s.supplier_name}</option>`
                ).join("");
            }
        } catch (error) {
            console.error('Error loading suppliers:', error);
        }
    }

    // تحميل العملاء
    async loadCustomers() {
        try {
            if (!this.supabase) {
                await this.initSupabase();
                if (!this.supabase) return;
            }

            let { data, error } = await this.supabase.from("customers").select("*");
            if (error) throw error;
            
            if (this.dom.customerId) {
                this.dom.customerId.innerHTML = data.map(c => 
                    `<option value="${c.customer_id}">${c.customer_name}</option>`
                ).join("");
            }
        } catch (error) {
            console.error('Error loading customers:', error);
        }
    }

    // معالجة تغيير نوع الحساب
    async handleAccountTypeChange() {
        let type = Number(this.dom.accountTypeId.value);

        if (this.dom.supplierSection) this.dom.supplierSection.style.display = "none";
        if (this.dom.customerSection) this.dom.customerSection.style.display = "none";
        if (this.dom.manualSection) this.dom.manualSection.style.display = "none";

        if (type === 1) {
            await this.loadSuppliers();
            if (this.dom.supplierSection) this.dom.supplierSection.style.display = "block";
            if (this.dom.supplierId) this.dom.supplierId.focus();
        } else if (type === 2) {
            await this.loadCustomers();
            if (this.dom.customerSection) this.dom.customerSection.style.display = "block";
            if (this.dom.customerId) this.dom.customerId.focus();
        } else if (type >= 3) {
            if (this.dom.manualSection) this.dom.manualSection.style.display = "block";
            if (this.dom.manualCode) this.dom.manualCode.focus();
        }
    }

    // إعداد التنقل بالـ Enter
    setupEnterNavigation() {
        ["account_type_id", "supplier_id", "customer_id", "manual_code", "manual_name"].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener("keydown", (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        const formElements = ["account_type_id", "supplier_id", "customer_id", "manual_code", "manual_name"];
                        let idx = formElements.indexOf(id);
                        for (let i = idx + 1; i < formElements.length; i++) {
                            const el = document.getElementById(formElements[i]);
                            if (el && el.offsetParent !== null) {
                                el.focus();
                                break;
                            }
                        }
                    }
                });
            }
        });
    }

    // التحقق من التكرار
    async isDuplicate(account_type_id, account_code) {
        try {
            if (!this.supabase) {
                await this.initSupabase();
                if (!this.supabase) return false;
            }

            const { data, error } = await this.supabase.from("accounts")
                .select("*")
                .eq("account_type_id", account_type_id)
                .eq("account_code", account_code);
            
            if (error) throw error;
            
            if (this.currentEditId) {
                return data.some(a => a.account_id != this.currentEditId);
            }
            return data.length > 0;
        } catch (error) {
            console.error('Error checking duplicate:', error);
            return false;
        }
    }

    // حفظ الحساب
    async saveAccount() {
        try {
            let type = Number(this.dom.accountTypeId.value);
            if (!type) {
                this.showAlert("اختر الحساب الرئيسي", 'error');
                return;
            }

            let account_code = "";
            let account_name = "";

            if (type === 1) {
                account_code = this.dom.supplierId.value;
                account_name = this.dom.supplierId.options[this.dom.supplierId.selectedIndex]?.text || "";
            } else if (type === 2) {
                account_code = this.dom.customerId.value;
                account_name = this.dom.customerId.options[this.dom.customerId.selectedIndex]?.text || "";
            } else if (type >= 3) {
                account_code = this.dom.manualCode.value.trim();
                account_name = this.dom.manualName.value.trim();
                if (!account_code || !account_name) {
                    this.showAlert("أدخل الكود واسم الحساب", 'error');
                    return;
                }
            }

            if (!account_code || !account_name) {
                this.showAlert("الرجاء إدخال جميع البيانات", 'error');
                return;
            }

            if (await this.isDuplicate(type, account_code)) {
                this.showAlert("هذا الحساب موجود مسبقاً", 'error');
                return;
            }

            const payload = { 
                account_code, 
                account_name, 
                account_type_id: type 
            };

            if (!this.supabase) {
                await this.initSupabase();
                if (!this.supabase) return;
            }

            if (this.currentEditId) {
                const { error } = await this.supabase.from("accounts").update(payload).eq("account_id", this.currentEditId);
                if (error) throw error;
                this.showAlert("تم تعديل الحساب بنجاح");
            } else {
                const { error } = await this.supabase.from("accounts").insert(payload);
                if (error) throw error;
                this.showAlert("تم إضافة الحساب بنجاح");
            }

            this.clearForm();
            await this.loadAccounts();
            
        } catch (error) {
            console.error('Error saving account:', error);
            this.showAlert("خطأ في حفظ الحساب", 'error');
        }
    }

    // تحميل الحسابات
    async loadAccounts() {
        try {
            if (!this.supabase) {
                await this.initSupabase();
                if (!this.supabase) return;
            }

            let { data, error } = await this.supabase.from("accounts").select("*").order("account_id");
            if (error) throw error;
            
            this.allAccounts = data || [];

            if (this.dom.accountsTableBody) {
                this.dom.accountsTableBody.innerHTML = this.allAccounts.map(acc => {
                    const typeObj = this.accountTypes.find(t => t.account_type_id === acc.account_type_id);
                    const typeName = typeObj ? typeObj.account_type_name : "-";
                    const typeId = acc.account_type_id;

                    return `<tr>
                        <td>${typeId}</td>
                        <td>${typeName}</td>
                        <td>${acc.account_code}</td>
                        <td>${acc.account_name}</td>
                        <td>
                            <button onclick="editAccount(${acc.account_id})" class="action-btn edit-btn">
                                <i class="fas fa-edit"></i> تعديل
                            </button>
                            <button onclick="deleteAccount(${acc.account_id})" class="action-btn delete-btn">
                                <i class="fas fa-trash"></i> حذف
                            </button>
                        </td>
                    </tr>`;
                }).join("");
            }

            // تطبيق الترتيب بعد تحميل البيانات
            if (window.applySorting) {
                window.applySorting();
            }
        } catch (error) {
            console.error('Error loading accounts:', error);
            this.showAlert("خطأ في تحميل الحسابات", 'error');
        }
    }

    // مسح النموذج
    clearForm() {
        if (this.dom.accountTypeId) this.dom.accountTypeId.value = "";
        if (this.dom.supplierSection) this.dom.supplierSection.style.display = "none";
        if (this.dom.customerSection) this.dom.customerSection.style.display = "none";
        if (this.dom.manualSection) this.dom.manualSection.style.display = "none";
        if (this.dom.supplierId) this.dom.supplierId.value = "";
        if (this.dom.customerId) this.dom.customerId.value = "";
        if (this.dom.manualCode) this.dom.manualCode.value = "";
        if (this.dom.manualName) this.dom.manualName.value = "";
        this.currentEditId = null;
    }

    // تعديل حساب
    async editAccount(id) {
        try {
            if (!this.supabase) {
                await this.initSupabase();
                if (!this.supabase) return;
            }

            const { data, error } = await this.supabase.from("accounts").select("*").eq("account_id", id).single();
            if (error) throw error;
            
            this.currentEditId = id;
            if (this.dom.accountTypeId) this.dom.accountTypeId.value = data.account_type_id;

            if (data.account_type_id === 1) {
                await this.loadSuppliers();
                if (this.dom.supplierSection) this.dom.supplierSection.style.display = "block";
                if (this.dom.supplierId) this.dom.supplierId.value = data.account_code;
            } else if (data.account_type_id === 2) {
                await this.loadCustomers();
                if (this.dom.customerSection) this.dom.customerSection.style.display = "block";
                if (this.dom.customerId) this.dom.customerId.value = data.account_code;
            } else {
                if (this.dom.manualSection) this.dom.manualSection.style.display = "block";
                if (this.dom.manualCode) this.dom.manualCode.value = data.account_code;
                if (this.dom.manualName) this.dom.manualName.value = data.account_name;
            }

            await this.loadAccounts();
        } catch (error) {
            console.error('Error editing account:', error);
            this.showAlert("خطأ في تحميل بيانات الحساب", 'error');
        }
    }

    // حذف حساب
    async deleteAccount(id) {
        if (!confirm("هل تريد حذف هذا الحساب؟")) return;
        
        try {
            if (!this.supabase) {
                await this.initSupabase();
                if (!this.supabase) return;
            }

            const { error } = await this.supabase.from("accounts").delete().eq("account_id", id);
            if (error) throw error;
            
            this.showAlert("تم حذف الحساب بنجاح");
            await this.loadAccounts();
        } catch (error) {
            console.error('Error deleting account:', error);
            this.showAlert("خطأ في حذف الحساب", 'error');
        }
    }

    // معالجة البحث
    handleSearch(e) {
        const searchTerm = e.target.value.toLowerCase().trim();
        const rows = document.querySelectorAll('#accounts_table tbody tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }
}

// تهيئة التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    window.accountsManager = new AccountsManager();
});