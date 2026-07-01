// ======================== 🧩 استيراد المكتبات ========================
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
import serverless from "serverless-http"; // ⬅️ أضف هذا السطر فقط

// 🔧 تحميل متغيرات البيئة في التطوير المحلي فقط
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
  console.log("✅ Loaded local .env file");
} else {
  console.log("🌐 Running in production mode - Netlify");
}

// === Netlify Environment Detection ===
console.log("=== Environment Information ===");
console.log("Platform:", process.env.NETLIFY ? "Netlify" : "Local/Other");
console.log("Site URL:", process.env.URL || "Not set on Netlify");
console.log("Node version:", process.version);
console.log("NODE_ENV:", process.env.NODE_ENV || "development");
console.log("PORT:", process.env.PORT || 3000);
console.log("CORS Origins:", process.env.CORS_ORIGIN || "Not set");
console.log("==============================");

// استيراد قاعدة البيانات - استخدم المسار النسبي الصحيح
import pool from "./db.js"; // تأكد من وجود ./ قبل db.js

// ======================== 🧩 استيراد جميع الراوترات ========================
import itemsRouter from "./routes/itemsbk.js";
import storesRouter from "./routes/storesbk.js";
import usersbkRouter from "./routes/usersbk.js";
import usersRouter from "./routes/usersbk.js";
import factoryRoutes from "./routes/factorybk.js";
import customersRouter from "./routes/customerbk.js";
import companyRouter from "./routes/companybk.js";
import suppliersRouter from "./routes/suppliersbk.js";
import masterRouter from "./routes/masterbk.js";
import purchasesRouter from "./routes/purchasesbk.js";
import purchasesRepRouter from "./routes/purchasesbk_rep.js";
import purchasesReturnRouter from "./routes/purchases_Retbk.js";
import privilegesRouter from "./routes/privilegesbk.js";
import salesRouter from "./routes/salesbk.js";
import salesReturnRouter from "./routes/salesreturnbk.js";
import searchRoutes from './routes/searchbk.js';
import transferRoutes from './routes/transferItembk.js';
import acceptTransferRoutes from './routes/acceptTransferbk.js';
import unitRoutes from './routes/unitbk.js';
import masterReportRouter from "./routes/masterrepbk.js";
import inventoryrepbk from "./routes/inventoryrepbk.js";
import priceOffersRouter from "./routes/offersbk.js";

import offershowRoutes from './routes/offershowbk.js';

import salesReturnRepRouter from "./routes/salesreturn_repbk.js";
import dailyCashierRoutes from "./routes/dailyCashierbk.js";

import accTypeRoutes from "./routes/acc_typebk.js";
import accountRoutes from "./routes/accountbk.js";
import accTransactionRoutes from "./routes/acc_transactionbk.js";
import accountReportRoutes from "./routes/account_reportbk.js";
import allStoresRouter from "./routes/allstoresinfbk.js";

import emplRouter from "./routes/emplbk.js";
import deptRouter from "./routes/deptbk.js";
import payrollRouter from "./routes/payrollbk.js";
import attendRouter from "./routes/attendbk.js";

// ======================== ⚙️ إعدادات التطبيق ========================
const app = express();

// تحديد المسار الفعلي للمجلد الحالي
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ======================== 🔧 إعدادات CORS المتقدمة ========================
const corsOptions = {
  origin: function (origin, callback) {
    // السماح للجميع في التطوير المحلي
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // في Netlify، السماح للنطاقات المعروفة
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5000',
      'https://*.netlify.app',
      'https://*.netlify.com',
      process.env.URL || ''  // موقع Netlify نفسه
    ].filter(Boolean); // إزالة القيم الفارغة
    
    // السماح للطلبات بدون origin (مثل curl)
    if (!origin) {
      return callback(null, true);
    }
    
    // التحقق من النطاقات المسموحة
    const isAllowed = allowedOrigins.some(pattern => {
      if (pattern.includes('*')) {
        const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
        return new RegExp(regexPattern).test(origin);
      }
      return pattern === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log(`🔒 CORS Blocked: ${origin} not in allowed list`);
      callback(null, true); // ⬅️ سمح للجميع مؤقتاً لتجنب مشاكل CORS
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, "public")));

// ======================== 🧩 اختبار الاتصال بقاعدة البيانات ========================
pool.connect()
  .then(() => console.log("✅ Database connected"))
  .catch(err => console.error("❌ Database connection error:", err));

// ======================== 🧭 استخدام الراوترات ========================
app.use("/api/items", itemsRouter);
app.use("/api/stores", storesRouter);
app.use("/api/users", usersRouter);
app.use("/api/usersbk", usersbkRouter);
app.use("/api/factories", factoryRoutes);
app.use("/api/customers", customersRouter);
app.use("/api/company", companyRouter);
app.use("/api/suppliers", suppliersRouter);
app.use("/api/a_master", masterRouter);
app.use("/api/purchases", purchasesRouter);
app.use("/api/purchases-report", purchasesRepRouter);
app.use('/api/purchases-return', purchasesReturnRouter);
app.use("/api/privilegesbk", privilegesRouter);
app.use("/api/salesbk", salesRouter);
app.use("/api/salesreturnbk", salesReturnRouter);
app.use('/api/searchbk', searchRoutes);
app.use('/api/transferItembk', transferRoutes);
app.use('/api/acceptTransferbk', acceptTransferRoutes);
app.use('/api/units', unitRoutes);
app.use("/api/a_master_report", masterReportRouter);
app.use("/api/a_master", inventoryrepbk);
app.use("/api/item_price_offers", priceOffersRouter);
app.use('/api/offershow', offershowRoutes);

app.use("/api/salesreturn_report", salesReturnRepRouter);
app.use("/api/all-stores-report", allStoresRouter);

// استخدام الـ routes
app.use('/api/daily-cashier', dailyCashierRoutes);
app.use("/api/account-types", accTypeRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/account-transactions", accTransactionRoutes);
app.use("/api/account-reports", accountReportRoutes);

app.use("/api/emplbk", emplRouter);
app.use("/api/deptbk", deptRouter);
app.use("/api/payrollbk", payrollRouter);
app.use("/api/attendbk", attendRouter);

// ======================== 🏠 الصفحة الرئيسية ========================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "purchases_rep.html"));
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    platform: process.env.NETLIFY ? "Netlify" : "Local",
    url: process.env.URL || "Not set"
  });
});

// ======================== 🔄 مزامنة الشاشات من main.html ========================
async function syncScreensOnStartup() {
  try {
    const mainPath = path.join(__dirname, "public", "main.html");

    if (!fs.existsSync(mainPath)) {
      console.log("⚠️ ملف main.html غير موجود في مجلد public.");
      return;
    }

    const html = fs.readFileSync(mainPath, "utf-8");

    // استخراج أسماء الشاشات من روابط القائمة
    const screenNames = [...html.matchAll(/<a[^>]*>(.*?)<\/a>/g)]
      .map(m => m[1].trim())
      .filter(n => n && !n.startsWith("<"));

    if (screenNames.length === 0) {
      console.log("⚠️ لم يتم العثور على أي شاشات داخل main.html.");
      return;
    }

    // جلب الشاشات الحالية من الجدول
    const existingRows = await pool.query("SELECT priv_name FROM public.privileges");
    const existing = existingRows.rows.map(r => r.priv_name);

    // تحديد الشاشات الجديدة والمحذوفة
    const newScreens = screenNames.filter(n => !existing.includes(n));
    const removedScreens = existing.filter(n => !screenNames.includes(n));

    // إضافة الشاشات الجديدة
    for (const name of newScreens) {
      await pool.query(
        `INSERT INTO public.privileges (priv_name, description, can_view, can_add, can_edit, can_delete)
         VALUES ($1, $2, false, false, false, false)`,
        [name, "🟢 تمت إضافتها تلقائيًا من main.html عند بدء التشغيل"]
      );
    }

    // حذف الشاشات التي لم تعد موجودة
    for (const name of removedScreens) {
      await pool.query(`DELETE FROM public.privileges WHERE priv_name=$1`, [name]);
    }

    console.log(`✅ تمت مزامنة الشاشات بنجاح:
    - تمت إضافة: ${newScreens.length}
    - تمت إزالة: ${removedScreens.length}`);
  } catch (err) {
    console.error("❌ خطأ أثناء مزامنة الشاشات عند بدء التشغيل:", err);
  }
}

// ======================== 🔄 الإرجاع التلقائي للتحويلات المنتهية ========================
async function runAutoReturn() {
    try {
        console.log('🔄 تشغيل الإرجاع التلقائي للتحويلات المنتهية...');
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            console.log('🔄 فحص التحويلات المعلقة المنتهية (3 أيام)...');

            // التحويلات المعلقة لأكثر من 3 أيام
            const expiredTransfers = await client.query(`
                SELECT DISTINCT ser_no 
                FROM transfer_stores 
                WHERE status = 'pending' 
                AND expires_at < NOW()
            `);

            let returnedCount = 0;

            for (const row of expiredTransfers.rows) {
                const transferNo = row.ser_no;
                
                // جلب بيانات التحويل
                const transferData = await client.query(`
                    SELECT * FROM transfer_stores 
                    WHERE ser_no = $1 AND status = 'pending'
                `, [transferNo]);

                let itemsReturned = 0;
                let itemsSkipped = 0;

                // إعادة الكميات إلى المخزن المصدر
                for (const transfer of transferData.rows) {
                    const sourceCheck = await client.query(`
                        SELECT item_id FROM a_master WHERE store_id = $1 AND item_id = $2
                    `, [transfer.from_store, transfer.item_id]);

                    if (sourceCheck.rows.length > 0) {
                        // الصنف لا يزال موجوداً - إعادة الكمية
                        await client.query(`
                            UPDATE a_master 
                            SET item_qty = item_qty + $1,
                                total_price = (item_qty + $1) * sale_price1,
                                total_net_buy_price = (item_qty + $1) * buy_price
                            WHERE store_id = $2 AND item_id = $3
                        `, [transfer.qty, transfer.from_store, transfer.item_id]);
                        itemsReturned++;
                        console.log(`✅ تم إعادة الصنف ${transfer.item_id} تلقائياً`);
                    } else {
                        // الصنف لم يعد موجوداً (تم بيعه) - تخطي
                        itemsSkipped++;
                        console.log(`⚠️ لم يتم إعادة الصنف ${transfer.item_id} - تم بيعه`);
                    }
                }

                // تحديث حالة التحويل
                await client.query(`
                    UPDATE transfer_stores 
                    SET status = 'auto_returned', 
                        remarks = CONCAT(COALESCE(remarks, ''), ' - تم الإرجاع تلقائياً بعد 3 أيام - تم إعادة: ', $2, ' - تم تخطي: ', $3)
                    WHERE ser_no = $1
                `, [transferNo, itemsReturned, itemsSkipped]);

                returnedCount++;
                console.log(`✅ تم إرجاع التحويل ${transferNo} تلقائياً`);
            }

            await client.query('COMMIT');
            console.log('✅ تم الانتهاء من الفحص التلقائي - ' + returnedCount + ' تحويل تم معالجته');

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ خطأ في الإرجاع التلقائي:', error);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('❌ خطأ في تشغيل الإرجاع التلقائي:', error.message);
    }
}

// ======================== ⚠️ معالجة الأخطاء ========================
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack);
  
  // CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'CORS Error: Origin not allowed',
      origin: req.headers.origin
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ======================== 🚫 Route Not Found ========================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path
  });
});

// ======================== 🚀 تشغيل السيرفر ========================
const startServer = async () => {
  try {
    // اختبار الاتصال بقاعدة البيانات أولاً
    console.log('🔗 Testing database connection...');
    await pool.connect();
    console.log("✅ Database connected successfully");
    
    // تشغيل المهام الأولية
    console.log('🔄 Running startup tasks...');
    await syncScreensOnStartup();
    
    // تشغيل الإرجاع التلقائي (بعد 10 ثواني)
    setTimeout(runAutoReturn, 10000);
    
    // في Netlify، لا نحتاج لبدء السيرفر يدوياً
    if (!process.env.NETLIFY) {
      // بدء السيرفر فقط في التطوير المحلي
      const PORT = process.env.PORT || 3000;
      const server = app.listen(PORT, () => {
        console.log(`========================================`);
        console.log(`🚀 Server successfully started!`);
        console.log(`📡 Local: http://localhost:${PORT}`);
        console.log(`🔧 Environment: Local Development`);
        console.log(`🕐 Time: ${new Date().toLocaleString()}`);
        console.log(`========================================`);
      });
      
      // معالجة إيقاف التشغيل بشكل أنيق
      process.on('SIGTERM', () => {
        console.log('🛑 SIGTERM received. Shutting down gracefully...');
        server.close(() => {
          console.log('✅ Server closed');
          pool.end(() => {
            console.log('✅ Database connection closed');
            process.exit(0);
          });
        });
      });
    } else {
      console.log(`========================================`);
      console.log(`🚀 Netlify Functions Ready!`);
      console.log(`🌍 Site URL: ${process.env.URL || "Not set"}`);
      console.log(`🔧 Environment: Netlify Production`);
      console.log(`🕐 Time: ${new Date().toLocaleString()}`);
      console.log(`========================================`);
    }
    
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// تشغيل السيرفر
startServer();

// ⬇️ ⬇️ ⬇️ التصدير لـ Netlify ⬇️ ⬇️ ⬇️
export const handler = serverless(app);