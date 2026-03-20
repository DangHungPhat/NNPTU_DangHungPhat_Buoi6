var express = require('express');
var router = express.Router();
let inventorySchema = require('../schemas/inventories');
let productSchema = require('../schemas/products');

// GET /api/v1/inventories - Lấy tất cả inventories (có join với product)
router.get('/', async function (req, res, next) {
    try {
        let data = await inventorySchema.find().populate({
            path: 'product',
            select: 'title slug price description images category'
        });
        res.status(200).send(data);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// GET /api/v1/inventories/:id - Lấy inventory theo ID (có join với product)
router.get('/:id', async function (req, res, next) {
    try {
        let result = await inventorySchema.findById(req.params.id).populate({
            path: 'product',
            select: 'title slug price description images category'
        });
        if (result) {
            res.status(200).send(result);
        } else {
            res.status(404).send({ message: 'Inventory not found' });
        }
    } catch (error) {
        res.status(404).send({ message: 'Invalid ID or Inventory not found' });
    }
});

// POST /api/v1/inventories/add-stock - Tăng stock
// Body: { product, quantity }
router.post('/add-stock', async function (req, res, next) {
    try {
        let { product, quantity } = req.body;

        if (!product || !quantity || quantity <= 0) {
            return res.status(400).send({ message: 'product và quantity (> 0) là bắt buộc' });
        }

        let inventory = await inventorySchema.findOne({ product });
        if (!inventory) {
            return res.status(404).send({ message: 'Không tìm thấy inventory cho product này' });
        }

        inventory.stock += quantity;
        await inventory.save();

        res.status(200).send({ message: 'Thêm stock thành công', inventory });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// POST /api/v1/inventories/remove-stock - Giảm stock
// Body: { product, quantity }
router.post('/remove-stock', async function (req, res, next) {
    try {
        let { product, quantity } = req.body;

        if (!product || !quantity || quantity <= 0) {
            return res.status(400).send({ message: 'product và quantity (> 0) là bắt buộc' });
        }

        let inventory = await inventorySchema.findOne({ product });
        if (!inventory) {
            return res.status(404).send({ message: 'Không tìm thấy inventory cho product này' });
        }

        if (inventory.stock < quantity) {
            return res.status(400).send({
                message: `Không đủ stock. Hiện có: ${inventory.stock}, yêu cầu: ${quantity}`
            });
        }

        inventory.stock -= quantity;
        await inventory.save();

        res.status(200).send({ message: 'Giảm stock thành công', inventory });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// POST /api/v1/inventories/reservation - Đặt hàng (giảm stock, tăng reserved)
// Body: { product, quantity }
router.post('/reservation', async function (req, res, next) {
    try {
        let { product, quantity } = req.body;

        if (!product || !quantity || quantity <= 0) {
            return res.status(400).send({ message: 'product và quantity (> 0) là bắt buộc' });
        }

        let inventory = await inventorySchema.findOne({ product });
        if (!inventory) {
            return res.status(404).send({ message: 'Không tìm thấy inventory cho product này' });
        }

        if (inventory.stock < quantity) {
            return res.status(400).send({
                message: `Không đủ stock để đặt hàng. Hiện có: ${inventory.stock}, yêu cầu: ${quantity}`
            });
        }

        inventory.stock -= quantity;
        inventory.reserved += quantity;
        await inventory.save();

        res.status(200).send({ message: 'Đặt hàng (reservation) thành công', inventory });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// POST /api/v1/inventories/sold - Xác nhận bán (giảm reserved, tăng soldCount)
// Body: { product, quantity }
router.post('/sold', async function (req, res, next) {
    try {
        let { product, quantity } = req.body;

        if (!product || !quantity || quantity <= 0) {
            return res.status(400).send({ message: 'product và quantity (> 0) là bắt buộc' });
        }

        let inventory = await inventorySchema.findOne({ product });
        if (!inventory) {
            return res.status(404).send({ message: 'Không tìm thấy inventory cho product này' });
        }

        if (inventory.reserved < quantity) {
            return res.status(400).send({
                message: `Không đủ reserved để xác nhận bán. Hiện có: ${inventory.reserved}, yêu cầu: ${quantity}`
            });
        }

        inventory.reserved -= quantity;
        inventory.soldCount += quantity;
        await inventory.save();

        res.status(200).send({ message: 'Xác nhận bán thành công', inventory });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

module.exports = router;
