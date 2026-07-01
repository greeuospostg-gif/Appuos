// account_reportbk.js - Backend for Account Reports
import express from "express";
import pool from "../db.js";

const router = express.Router();

// ======================== 📊 كشف حساب مفصل ========================
router.get("/account-statement", async (req, res) => {
  try {
    const { 
      account_id, 
      start_date, 
      end_date,
      show_zero_balance 
    } = req.query;

    // التحقق من البيانات المطلوبة
    if (!account_id) {
      return res.status(400).json({
        success: false,
        message: "معرف الحساب مطلوب"
      });
    }

    let query = `
      WITH account_info AS (
        SELECT 
          a.account_id,
          a.account_code,
          a.account_name,
          a.balance as current_balance,
          at.account_type_name
        FROM accounts a
        LEFT JOIN account_types at ON a.account_type_id = at.account_type_id
        WHERE a.account_id = $1
      ),
      opening_balance AS (
        SELECT 
          COALESCE(SUM(debit_amount - credit_amount), 0) as opening_balance
        FROM account_transactions 
        WHERE account_id = $1 
        AND transaction_date < $2
      ),
      period_transactions AS (
        SELECT 
          transaction_id,
          transaction_date,
          entry_number,
          debit_amount,
          credit_amount,
          line_description,
          created_at,
          (debit_amount - credit_amount) as net_amount
        FROM account_transactions 
        WHERE account_id = $1 
        AND transaction_date BETWEEN $2 AND $3
      ),
      running_balance AS (
        SELECT 
          pt.*,
          (SELECT opening_balance FROM opening_balance) + 
          SUM(pt.net_amount) OVER (
            ORDER BY pt.transaction_date, pt.created_at
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ) as running_balance
        FROM period_transactions pt
      )
      SELECT 
        ai.*,
        ob.opening_balance,
        rb.transaction_id,
        rb.transaction_date,
        rb.entry_number,
        rb.debit_amount,
        rb.credit_amount,
        rb.line_description,
        rb.running_balance,
        rb.created_at
      FROM account_info ai
      CROSS JOIN opening_balance ob
      LEFT JOIN running_balance rb ON true
      ORDER BY rb.transaction_date, rb.created_at
    `;

    const params = [
      account_id, 
      start_date || '1900-01-01', 
      end_date || '2100-12-31'
    ];

    console.log('Account Statement Query:', query, 'Params:', params);

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "الحساب غير موجود أو لا توجد حركات"
      });
    }

    // تجميع البيانات
    const accountInfo = {
      account_id: result.rows[0].account_id,
      account_code: result.rows[0].account_code,
      account_name: result.rows[0].account_name,
      account_type: result.rows[0].account_type_name,
      current_balance: parseFloat(result.rows[0].current_balance),
      opening_balance: parseFloat(result.rows[0].opening_balance)
    };

    const transactions = result.rows
      .filter(row => row.transaction_id) // استبعاد الصفوف الفارغة
      .map(row => ({
        transaction_id: row.transaction_id,
        transaction_date: row.transaction_date,
        entry_number: row.entry_number,
        debit_amount: parseFloat(row.debit_amount),
        credit_amount: parseFloat(row.credit_amount),
        line_description: row.line_description,
        running_balance: parseFloat(row.running_balance),
        created_at: row.created_at
      }));

    // حساب الإجماليات
    const totals = {
      total_debit: transactions.reduce((sum, t) => sum + t.debit_amount, 0),
      total_credit: transactions.reduce((sum, t) => sum + t.credit_amount, 0),
      net_movement: transactions.reduce((sum, t) => sum + (t.debit_amount - t.credit_amount), 0)
    };

    res.json({
      success: true,
      data: {
        account_info: accountInfo,
        transactions: transactions,
        totals: totals,
        period: {
          start_date: start_date,
          end_date: end_date
        }
      }
    });

  } catch (error) {
    console.error("Error generating account statement:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في إنشاء كشف الحساب"
    });
  }
});

// ======================== 📈 كشف إجمالي للحسابات ========================
router.get("/accounts-summary", async (req, res) => {
  try {
    const { 
      account_type_id, 
      show_inactive,
      balance_filter 
    } = req.query;

    let query = `
      SELECT 
        a.account_id,
        a.account_code,
        a.account_name,
        a.balance as current_balance,
        at.account_type_name,
        a.is_active,
        COUNT(at2.transaction_id) as transaction_count,
        COALESCE(MAX(at2.transaction_date), a.created_at::date) as last_transaction_date
      FROM accounts a
      LEFT JOIN account_types at ON a.account_type_id = at.account_type_id
      LEFT JOIN account_transactions at2 ON a.account_id = at2.account_id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    if (account_type_id) {
      paramCount++;
      query += ` AND a.account_type_id = $${paramCount}`;
      params.push(account_type_id);
    }

    if (show_inactive !== 'true') {
      query += ` AND a.is_active = true`;
    }

    // فلترة حسب الرصيد
    if (balance_filter) {
      if (balance_filter === 'positive') {
        query += ` AND a.balance > 0`;
      } else if (balance_filter === 'negative') {
        query += ` AND a.balance < 0`;
      } else if (balance_filter === 'zero') {
        query += ` AND a.balance = 0`;
      }
    }

    query += `
      GROUP BY 
        a.account_id, 
        a.account_code, 
        a.account_name, 
        a.balance, 
        at.account_type_name, 
        a.is_active,
        a.created_at
      ORDER BY a.account_code
    `;

    console.log('Accounts Summary Query:', query, 'Params:', params);

    const result = await pool.query(query, params);

    // حساب الإجماليات
    const totals = {
      total_accounts: result.rows.length,
      total_balance: result.rows.reduce((sum, acc) => sum + parseFloat(acc.current_balance), 0),
      total_debit: result.rows.filter(acc => parseFloat(acc.current_balance) > 0)
                         .reduce((sum, acc) => sum + parseFloat(acc.current_balance), 0),
      total_credit: Math.abs(result.rows.filter(acc => parseFloat(acc.current_balance) < 0)
                              .reduce((sum, acc) => sum + parseFloat(acc.current_balance), 0))
    };

    res.json({
      success: true,
      data: {
        accounts: result.rows,
        totals: totals
      }
    });

  } catch (error) {
    console.error("Error generating accounts summary:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في إنشاء كشف الحسابات"
    });
  }
});

export default router;