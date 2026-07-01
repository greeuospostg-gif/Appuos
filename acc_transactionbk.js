// acc_transactionbk.js - Backend for Account Transactions (محدث)
import express from "express";
import pool from "../db.js";

const router = express.Router();

// ======================== 🔍 الحصول على جميع الحركات ========================
router.get("/", async (req, res) => {
  try {
    const { start_date, end_date, account_id, entry_number } = req.query;
    
    let query = `
      SELECT 
        at.*,
        a.account_name,
        a.account_code,
        atype.account_type_name,
        'System' as username
      FROM account_transactions at
      LEFT JOIN accounts a ON at.account_id = a.account_id
      LEFT JOIN account_types atype ON a.account_type_id = atype.account_type_id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (start_date) {
      paramCount++;
      query += ` AND at.transaction_date >= $${paramCount}`;
      params.push(start_date);
    }

    if (end_date) {
      paramCount++;
      query += ` AND at.transaction_date <= $${paramCount}`;
      params.push(end_date);
    }

    if (account_id) {
      paramCount++;
      query += ` AND at.account_id = $${paramCount}`;
      params.push(account_id);
    }

    if (entry_number) {
      paramCount++;
      query += ` AND at.entry_number ILIKE $${paramCount}`;
      params.push(`%${entry_number}%`);
    }

    query += ` ORDER BY at.entry_number, at.transaction_date DESC, at.created_at`;

    console.log('Query:', query, 'Params:', params);

    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب الحركات"
    });
  }
});

// ======================== 🔍 الحصول على آخر رقم قيد ========================
router.get("/last-entry-number", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT entry_number 
      FROM account_transactions 
      WHERE entry_number LIKE 'JRNL-%'
      ORDER BY created_at DESC 
      LIMIT 1
    `);

    let nextNumber = 1;
    if (result.rows.length > 0) {
      const lastEntry = result.rows[0].entry_number;
      const match = lastEntry.match(/JRNL-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    res.json({
      success: true,
      data: `JRNL-${nextNumber.toString().padStart(4, '0')}`
    });
  } catch (error) {
    console.error("Error fetching last entry number:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب رقم القيد"
    });
  }
});

// ======================== 🔍 الحصول على الحسابات حسب النوع ========================
router.get("/accounts/by-type/:type_name", async (req, res) => {
  try {
    const { type_name } = req.params;
    
    const result = await pool.query(`
      SELECT a.account_id, a.account_code, a.account_name, a.balance
      FROM accounts a
      LEFT JOIN account_types at ON a.account_type_id = at.account_type_id
      WHERE at.account_type_name ILIKE $1 AND a.is_active = true
      ORDER BY a.account_code
    `, [`%${type_name}%`]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error("Error fetching accounts by type:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب الحسابات"
    });
  }
});

// ======================== 🔍 الحصول على جميع الحسابات النشطة ========================
router.get("/accounts/active", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.account_id, a.account_code, a.account_name, a.balance, at.account_type_name
      FROM accounts a
      LEFT JOIN account_types at ON a.account_type_id = at.account_type_id
      WHERE a.is_active = true
      ORDER BY a.account_code
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error("Error fetching active accounts:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب الحسابات النشطة"
    });
  }
});

// ======================== 🔍 التحقق من وجود رقم القيد ========================
router.get("/check-entry/:entry_number", async (req, res) => {
  try {
    const { entry_number } = req.params;
    
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM account_transactions WHERE entry_number = $1',
      [entry_number]
    );

    const exists = parseInt(result.rows[0].count) > 0;

    res.json({
      success: true,
      data: { exists }
    });
  } catch (error) {
    console.error("Error checking entry number:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في التحقق من رقم القيد"
    });
  }
});

// ======================== ➕ إضافة حركات محاسبية ========================
router.post("/", async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { transactions } = req.body;
    
    console.log('Received transactions:', transactions);

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "يجب إدخال حركات محاسبية"
      });
    }

    // التحقق من وجود رقم القيد مسبقاً
    const entryNumber = transactions[0].entry_number;
    const checkResult = await client.query(
      'SELECT COUNT(*) as count FROM account_transactions WHERE entry_number = $1',
      [entryNumber]
    );

    if (parseInt(checkResult.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: `رقم القيد ${entryNumber} مسجل مسبقاً`
      });
    }

    // التحقق من توازن القيد
    const totalDebit = transactions.reduce((sum, t) => sum + parseFloat(t.debit_amount || 0), 0);
    const totalCredit = transactions.reduce((sum, t) => sum + parseFloat(t.credit_amount || 0), 0);
    
    console.log('Total Debit:', totalDebit, 'Total Credit:', totalCredit);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({
        success: false,
        message: `القيد غير متوازن. المدين: ${totalDebit}, الدائن: ${totalCredit}`
      });
    }

    const savedTransactions = [];
    
    for (const transaction of transactions) {
      const { 
        transaction_date, 
        account_id, 
        debit_amount, 
        credit_amount, 
        entry_number, 
        line_description,
        user_id 
      } = transaction;

      console.log('Inserting transaction:', transaction);

      const result = await client.query(
        `INSERT INTO account_transactions 
         (transaction_date, account_id, debit_amount, credit_amount, entry_number, line_description, user_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING *`,
        [
          transaction_date, 
          account_id, 
          debit_amount || 0, 
          credit_amount || 0, 
          entry_number, 
          line_description, 
          user_id || 1
        ]
      );

      savedTransactions.push(result.rows[0]);
    }

    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: "تم حفظ القيد المحاسبي بنجاح",
      data: savedTransactions
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error adding transactions:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في حفظ القيد المحاسبي: " + error.message
    });
  } finally {
    client.release();
  }
});

// ======================== 🗑️ حذف قيد محاسبي ========================
router.delete("/entry/:entry_number", async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { entry_number } = req.params;

    // الحصول على الحركات قبل الحذف
    const checkResult = await client.query(
      'SELECT * FROM account_transactions WHERE entry_number = $1',
      [entry_number]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "القيد المحاسبي غير موجود"
      });
    }

    // حذف الحركات
    await client.query(
      'DELETE FROM account_transactions WHERE entry_number = $1',
      [entry_number]
    );

    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: "تم حذف القيد المحاسبي بنجاح"
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error deleting entry:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في حذف القيد المحاسبي"
    });
  } finally {
    client.release();
  }
});

export default router;