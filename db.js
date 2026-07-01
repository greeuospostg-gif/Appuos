// db.js
import pkg from 'pg';
const { Pool } = pkg;

// ⚙️ إعداد الاتصال بقاعدة البيانات (يعمل مع جميع المنصات)
let poolConfig;

// استخدام DATABASE_URL من متغيرات البيئة (يعمل مع Railway، Render، الخ)
if (process.env.DATABASE_URL) {
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  };
  console.log("🌐 Connected via DATABASE_URL (Railway/Supabase)");
} 
// البيئة المحلية مع إعدادات مفصلة
else if (process.env.DB_HOST) {
  poolConfig = {
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: process.env.DB_SSL === 'true'
  };
  console.log("💻 Connected via local database config");
} 
// خطأ إذا لم توجد إعدادات
else {
  console.error("❌ No database configuration found!");
  console.error("Please set DATABASE_URL for production or DB_HOST for local development");
  process.exit(1);
}

const pool = new Pool(poolConfig);

// اختبار الاتصال
pool.connect()
  .then(() => console.log("✅ Database connected successfully"))
  .catch(err => {
    console.error("❌ Database connection error:", err.message);
    console.error("Please check your database credentials and connection");
    process.exit(1);
  });

export default pool;