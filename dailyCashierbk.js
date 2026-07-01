// routes/dailyCashierbk.js
import express from "express";
import pool from "../db.js";

const router = express.Router();

// GET /api/daily-cashier/sales - جلب بيانات المبيعات
router.get("/sales", async (req, res) => {
    let client;
    try {
        const { startDate, endDate, storeId, userId, itemId, invoiceId } = req.query;
        
        client = await pool.connect();
        
        let query = `
            SELECT 
                s.tran_date,
                s.store_id,
                s.invoice_id,
                s.item_id,
                s.item_qty,
                s.sale_price,
                s.total_price,
                s.discount,
                s.sale_type,
                s.price_type,
                s.user_id,
                s.unit_type,
                s.batch_no,
                s.expiry_date,
                s.remarks,
                st.store_name,
                u.username as cashier_name,
                i.item_nm as item_name,
                c.customer_name
            FROM sales s
            LEFT JOIN stores st ON s.store_id = st.store_id
            LEFT JOIN users u ON s.user_id = u.user_id
            LEFT JOIN items i ON s.item_id = i.item_id
            LEFT JOIN customers c ON s.customer_id = c.customer_id
            WHERE 1=1
        `;
        
        const params = [];
        let paramCount = 0;

        // تطبيق الفلاتر
        if (startDate) {
            paramCount++;
            query += ` AND DATE(s.tran_date) >= $${paramCount}`;
            params.push(startDate);
        }
        
        if (endDate) {
            paramCount++;
            query += ` AND DATE(s.tran_date) <= $${paramCount}`;
            params.push(endDate);
        }
        
        if (storeId) {
            paramCount++;
            query += ` AND s.store_id = $${paramCount}`;
            params.push(storeId);
        }
        
        if (userId) {
            paramCount++;
            query += ` AND s.user_id = $${paramCount}`;
            params.push(userId);
        }
        
        if (itemId) {
            paramCount++;
            query += ` AND s.item_id = $${paramCount}`;
            params.push(itemId);
        }
        
        if (invoiceId) {
            paramCount++;
            query += ` AND s.invoice_id = $${paramCount}`;
            params.push(invoiceId);
        }

        query += ` ORDER BY s.tran_date DESC, s.invoice_id DESC`;

        const result = await client.query(query, params);
        
        res.json({
            success: true,
            data: result.rows,
            count: result.rows.length
        });

    } catch (error) {
        console.error('خطأ في جلب بيانات المبيعات:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في جلب بيانات المبيعات',
            error: error.message
        });
    } finally {
        if (client) client.release();
    }
});

// GET /api/daily-cashier/sales-returns - جلب بيانات مرتجعات المبيعات
router.get("/sales-returns", async (req, res) => {
    let client;
    try {
        const { startDate, endDate, storeId, userId, itemId, invoiceId } = req.query;
        
        client = await pool.connect();
        
        let query = `
            SELECT 
                sr.tran_date,
                sr.store_id,
                sr.invoice_id,
                sr.item_id,
                sr.item_qty,
                sr.sale_price,
                sr.total_price,
                sr.discount,
                sr.sale_type,
                sr.price_type,
                sr.user_id,
                sr.unit_type,
                sr.batch_no,
                sr.expiry_date,
                sr.remarks,
                sr.return_reason,
                sr.original_invoice,
                st.store_name,
                u.username as cashier_name,
                i.item_nm as item_name,
                c.customer_name
            FROM sales_return sr
            LEFT JOIN stores st ON sr.store_id = st.store_id
            LEFT JOIN users u ON sr.user_id = u.user_id
            LEFT JOIN items i ON sr.item_id = i.item_id
            LEFT JOIN customers c ON sr.customer_id = c.customer_id
            WHERE 1=1
        `;
        
        const params = [];
        let paramCount = 0;

        // تطبيق الفلاتر
        if (startDate) {
            paramCount++;
            query += ` AND DATE(sr.tran_date) >= $${paramCount}`;
            params.push(startDate);
        }
        
        if (endDate) {
            paramCount++;
            query += ` AND DATE(sr.tran_date) <= $${paramCount}`;
            params.push(endDate);
        }
        
        if (storeId) {
            paramCount++;
            query += ` AND sr.store_id = $${paramCount}`;
            params.push(storeId);
        }
        
        if (userId) {
            paramCount++;
            query += ` AND sr.user_id = $${paramCount}`;
            params.push(userId);
        }
        
        if (itemId) {
            paramCount++;
            query += ` AND sr.item_id = $${paramCount}`;
            params.push(itemId);
        }
        
        if (invoiceId) {
            paramCount++;
            query += ` AND sr.invoice_id = $${paramCount}`;
            params.push(invoiceId);
        }

        query += ` ORDER BY sr.tran_date DESC, sr.invoice_id DESC`;

        const result = await client.query(query, params);
        
        res.json({
            success: true,
            data: result.rows,
            count: result.rows.length
        });

    } catch (error) {
        console.error('خطأ في جلب بيانات المرتجعات:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في جلب بيانات المرتجعات',
            error: error.message
        });
    } finally {
        if (client) client.release();
    }
});

// GET /api/daily-cashier/summary - جلب الإحصائيات اليومية
router.get("/summary", async (req, res) => {
    let client;
    try {
        const { startDate, endDate, storeId, userId } = req.query;
        
        client = await pool.connect();
        
        // استعلام لإجمالي المبيعات
        let salesQuery = `
            SELECT 
                COUNT(DISTINCT invoice_id) as total_invoices,
                COUNT(*) as total_items,
                COALESCE(SUM(total_price), 0) as total_sales_amount,
                COALESCE(SUM(discount), 0) as total_discount,
                COALESCE(SUM(item_qty), 0) as total_quantity
            FROM sales 
            WHERE 1=1
        `;
        
        // استعلام لإجمالي المرتجعات
        let returnsQuery = `
            SELECT 
                COUNT(DISTINCT invoice_id) as total_return_invoices,
                COUNT(*) as total_return_items,
                COALESCE(SUM(total_price), 0) as total_returns_amount,
                COALESCE(SUM(item_qty), 0) as total_return_quantity
            FROM sales_return 
            WHERE 1=1
        `;
        
        const params = [];
        let paramCount = 0;

        // تطبيق الفلاتر المشتركة
        const applyFilters = (query) => {
            let filteredQuery = query;
            if (startDate) {
                paramCount++;
                filteredQuery += ` AND DATE(tran_date) >= $${paramCount}`;
            }
            
            if (endDate) {
                paramCount++;
                filteredQuery += ` AND DATE(tran_date) <= $${paramCount}`;
            }
            
            if (storeId) {
                paramCount++;
                filteredQuery += ` AND store_id = $${paramCount}`;
            }
            
            if (userId) {
                paramCount++;
                filteredQuery += ` AND user_id = $${paramCount}`;
            }
            
            return filteredQuery;
        };

        salesQuery = applyFilters(salesQuery);
        returnsQuery = applyFilters(returnsQuery);

        // إضافة الباراميترات
        if (startDate) params.push(startDate);
        if (endDate) params.push(endDate);
        if (storeId) params.push(storeId);
        if (userId) params.push(userId);

        // تنفيذ الاستعلامات
        const salesResult = await client.query(salesQuery, params);
        const returnsResult = await client.query(returnsQuery, params);

        const salesData = salesResult.rows[0] || {};
        const returnsData = returnsResult.rows[0] || {};

        const summary = {
            total_sales: {
                invoices: parseInt(salesData.total_invoices) || 0,
                items: parseInt(salesData.total_items) || 0,
                amount: parseFloat(salesData.total_sales_amount) || 0,
                discount: parseFloat(salesData.total_discount) || 0,
                quantity: parseFloat(salesData.total_quantity) || 0
            },
            total_returns: {
                invoices: parseInt(returnsData.total_return_invoices) || 0,
                items: parseInt(returnsData.total_return_items) || 0,
                amount: parseFloat(returnsData.total_returns_amount) || 0,
                quantity: parseFloat(returnsData.total_return_quantity) || 0
            },
            net_sales: {
                amount: (parseFloat(salesData.total_sales_amount) || 0) - (parseFloat(returnsData.total_returns_amount) || 0),
                invoices: (parseInt(salesData.total_invoices) || 0) - (parseInt(returnsData.total_return_invoices) || 0)
            }
        };

        res.json({
            success: true,
            data: summary
        });

    } catch (error) {
        console.error('خطأ في جلب الإحصائيات:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في جلب الإحصائيات',
            error: error.message
        });
    } finally {
        if (client) client.release();
    }
});

// GET /api/daily-cashier/filters - جلب بيانات الفلاتر (المخازن، المستخدمين)
router.get("/filters", async (req, res) => {
    let client;
    try {
        client = await pool.connect();

        // جلب المخازن
        const storesQuery = `SELECT store_id, store_name FROM stores ORDER BY store_name`;
        const storesResult = await client.query(storesQuery);

        // جلب المستخدمين (الكاشيرات)
        const usersQuery = `SELECT user_id, username FROM users ORDER BY username`;
        const usersResult = await client.query(usersQuery);

        res.json({
            success: true,
            data: {
                stores: storesResult.rows,
                cashiers: usersResult.rows
            }
        });

    } catch (error) {
        console.error('خطأ في جلب بيانات الفلاتر:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في جلب بيانات الفلاتر',
            error: error.message
        });
    } finally {
        if (client) client.release();
    }
});

export default router;