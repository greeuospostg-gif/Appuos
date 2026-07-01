import express from "express";
import pool from "../db.js";

const router = express.Router();

// ======================== 🔍 الحصول على جميع أنواع الحسابات ========================
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM account_types ORDER BY account_type_id"
    );
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error("Error fetching account types:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب أنواع الحسابات"
    });
  }
});

// ======================== 🔍 الحصول على نوع حساب بواسطة ID ========================
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "SELECT * FROM account_types WHERE account_type_id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "نوع الحساب غير موجود"
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error fetching account type:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب نوع الحساب"
    });
  }
});

// ======================== ➕ إضافة نوع حساب جديد ========================
router.post("/", async (req, res) => {
  try {
    const { account_type_name } = req.body;

    if (!account_type_name) {
      return res.status(400).json({
        success: false,
        message: "اسم نوع الحساب مطلوب"
      });
    }

    const result = await pool.query(
      "INSERT INTO account_types (account_type_name) VALUES ($1) RETURNING *",
      [account_type_name]
    );

    res.json({
      success: true,
      message: "تم إضافة نوع الحساب بنجاح",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error adding account type:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في إضافة نوع الحساب"
    });
  }
});

// ======================== ✏️ تعديل نوع حساب ========================
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { account_type_name } = req.body;

    if (!account_type_name) {
      return res.status(400).json({
        success: false,
        message: "اسم نوع الحساب مطلوب"
      });
    }

    const result = await pool.query(
      "UPDATE account_types SET account_type_name = $1 WHERE account_type_id = $2 RETURNING *",
      [account_type_name, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "نوع الحساب غير موجود"
      });
    }

    res.json({
      success: true,
      message: "تم تعديل نوع الحساب بنجاح",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error updating account type:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في تعديل نوع الحساب"
    });
  }
});

// ======================== 🗑️ حذف نوع حساب ========================
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // التحقق من وجود حسابات مرتبطة
    const checkResult = await pool.query(
      "SELECT COUNT(*) FROM accounts WHERE account_type_id = $1",
      [id]
    );

    const accountCount = parseInt(checkResult.rows[0].count);
    if (accountCount > 0) {
      return res.status(400).json({
        success: false,
        message: "لا يمكن حذف نوع الحساب لأنه مرتبط بحسابات أخرى"
      });
    }

    const result = await pool.query(
      "DELETE FROM account_types WHERE account_type_id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "نوع الحساب غير موجود"
      });
    }

    res.json({
      success: true,
      message: "تم حذف نوع الحساب بنجاح"
    });
  } catch (error) {
    console.error("Error deleting account type:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في حذف نوع الحساب"
    });
  }
});

export default router;