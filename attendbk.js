import express from "express";
import pool from "../db.js";

const router = express.Router();

// 📋 جلب جميع سجلات الحضور مع اسم الموظف
router.get("/", async (req, res) => {
  const result = await pool.query(`
    SELECT a.*, e.first_name
    FROM attendance a
    LEFT JOIN employees e ON a.emp_id = e.emp_id
    ORDER BY a.att_date DESC, a.att_id DESC
  `);
  res.json(result.rows);
});

// 🔍 جلب سجل حضور واحد
router.get("/:id", async (req, res) => {
  const result = await pool.query("SELECT * FROM attendance WHERE att_id=$1", [req.params.id]);
  res.json(result.rows[0]);
});

// ➕ إضافة سجل جديد
router.post("/", async (req, res) => {
  const { emp_id, att_date, check_in, check_out, notes } = req.body;
  const result = await pool.query(
    `INSERT INTO attendance (emp_id, att_date, check_in, check_out, notes)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [emp_id, att_date, check_in, check_out, notes]
  );
  res.json(result.rows[0]);
});

// ✏️ تعديل سجل
router.put("/:id", async (req, res) => {
  const { emp_id, att_date, check_in, check_out, notes } = req.body;
  const result = await pool.query(
    `UPDATE attendance
     SET emp_id=$1, att_date=$2, check_in=$3, check_out=$4, notes=$5
     WHERE att_id=$6 RETURNING *`,
    [emp_id, att_date, check_in, check_out, notes, req.params.id]
  );
  res.json(result.rows[0]);
});

// ❌ حذف سجل
router.delete("/:id", async (req, res) => {
  await pool.query("DELETE FROM attendance WHERE att_id=$1", [req.params.id]);
  res.json({ message: "Deleted" });
});

export default router;
