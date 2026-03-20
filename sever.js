const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const slugify = require('slugify');
const { data: seedProducts } = require('./utils/data');

const app = express();
app.use(express.json());

// ==========================================
// 1. ĐỌC KEY & CẤU HÌNH JWT
// ==========================================
const privateKey = fs.readFileSync('private.pem', 'utf8');
const publicKey = fs.readFileSync('public.pem', 'utf8');

// ==========================================
// 2. DATABASE LOCAL (IN-MEMORY)
// ==========================================

// --- Users ---
let users = [{ id: 1, username: 'admin', password: '' }];
users[0].password = bcrypt.hashSync('123456', 10);

// --- Products: seed từ data.js ---
let products = seedProducts.map(p => ({ ...p, isDeleted: false }));
let nextProductId = Math.max(...products.map(p => p.id)) + 1;

// --- Inventories: tự động tạo cho mỗi product ---
let inventories = products.map((p, idx) => ({
    id: idx + 1,
    productId: p.id,
    stock: 0,
    reserved: 0,
    soldCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
}));
let nextInventoryId = inventories.length + 1;

// Helper: lấy inventory theo productId
function getInventoryByProductId(productId) {
    return inventories.find(inv => inv.productId == productId);
}

// ==========================================
// 3. MIDDLEWARE XÁC THỰC TOKEN
// ==========================================
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Yêu cầu đăng nhập!' });
    try {
        const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
        req.userId = decoded.id;
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Token không hợp lệ hoặc đã hết hạn!' });
    }
};

// ==========================================
// 4. AUTH ROUTES
// ==========================================
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });
    if (!bcrypt.compareSync(password, user.password))
        return res.status(401).json({ message: 'Sai mật khẩu' });
    const token = jwt.sign({ id: user.id }, privateKey, { algorithm: 'RS256', expiresIn: '1h' });
    res.json({ message: 'Đăng nhập thành công', token });
});

app.get('/me', verifyToken, (req, res) => {
    const user = users.find(u => u.id === req.userId);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });
    const { password, ...userInfo } = user;
    res.json({ message: 'Thông tin của bạn', data: userInfo });
});

// ==========================================
// 5. PRODUCT ROUTES  /api/v1/products
// ==========================================

// GET /api/v1/products - Lấy tất cả products
app.get('/api/v1/products', (req, res) => {
    const titleQ = req.query.title ? req.query.title.toLowerCase() : '';
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : Infinity;
    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : 0;
    const result = products.filter(p =>
        !p.isDeleted &&
        p.title.toLowerCase().includes(titleQ) &&
        p.price >= minPrice &&
        p.price <= maxPrice
    );
    res.json(result);
});

// GET /api/v1/products/:id - Lấy product theo ID
app.get('/api/v1/products/:id', (req, res) => {
    const product = products.find(p => p.id == req.params.id && !p.isDeleted);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
});

// POST /api/v1/products - Tạo product mới + tạo inventory tương ứng
app.post('/api/v1/products', (req, res) => {
    const { title, price, description, category, images } = req.body;
    if (!title) return res.status(400).json({ message: 'title là bắt buộc' });

    const newProduct = {
        id: nextProductId++,
        title,
        slug: slugify(title, { replacement: '-', lower: true, locale: 'vi' }),
        price: price || 0,
        description: description || '',
        category: category || null,
        images: images || [],
        isDeleted: false,
        creationAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    products.push(newProduct);

    // Tự động tạo inventory tương ứng
    const newInventory = {
        id: nextInventoryId++,
        productId: newProduct.id,
        stock: 0,
        reserved: 0,
        soldCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    inventories.push(newInventory);

    res.status(201).json({ product: newProduct, inventory: newInventory });
});

// PUT /api/v1/products/:id - Cập nhật product
app.put('/api/v1/products/:id', (req, res) => {
    const product = products.find(p => p.id == req.params.id && !p.isDeleted);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    Object.assign(product, req.body, { updatedAt: new Date().toISOString() });
    res.json(product);
});

// DELETE /api/v1/products/:id - Soft delete
app.delete('/api/v1/products/:id', (req, res) => {
    const product = products.find(p => p.id == req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    product.isDeleted = true;
    product.updatedAt = new Date().toISOString();
    res.json({ message: 'Đã xoá product', product });
});

// ==========================================
// 6. INVENTORY ROUTES  /api/v1/inventories
// ==========================================

// GET /api/v1/inventories - Lấy tất cả (join product)
app.get('/api/v1/inventories', (req, res) => {
    const result = inventories.map(inv => ({
        ...inv,
        product: products.find(p => p.id === inv.productId) || null
    }));
    res.json(result);
});

// GET /api/v1/inventories/:id - Lấy theo ID (join product)
app.get('/api/v1/inventories/:id', (req, res) => {
    const inv = inventories.find(i => i.id == req.params.id);
    if (!inv) return res.status(404).json({ message: 'Inventory not found' });
    res.json({ ...inv, product: products.find(p => p.id === inv.productId) || null });
});

// POST /api/v1/inventories/add-stock - Tăng stock
app.post('/api/v1/inventories/add-stock', (req, res) => {
    const { product: productId, quantity } = req.body;
    if (!productId || !quantity || quantity <= 0)
        return res.status(400).json({ message: 'product và quantity (> 0) là bắt buộc' });
    const inv = getInventoryByProductId(productId);
    if (!inv) return res.status(404).json({ message: 'Không tìm thấy inventory cho product này' });
    inv.stock += quantity;
    inv.updatedAt = new Date().toISOString();
    res.json({ message: 'Thêm stock thành công', inventory: inv });
});

// POST /api/v1/inventories/remove-stock - Giảm stock
app.post('/api/v1/inventories/remove-stock', (req, res) => {
    const { product: productId, quantity } = req.body;
    if (!productId || !quantity || quantity <= 0)
        return res.status(400).json({ message: 'product và quantity (> 0) là bắt buộc' });
    const inv = getInventoryByProductId(productId);
    if (!inv) return res.status(404).json({ message: 'Không tìm thấy inventory cho product này' });
    if (inv.stock < quantity)
        return res.status(400).json({ message: `Không đủ stock. Hiện có: ${inv.stock}, yêu cầu: ${quantity}` });
    inv.stock -= quantity;
    inv.updatedAt = new Date().toISOString();
    res.json({ message: 'Giảm stock thành công', inventory: inv });
});

// POST /api/v1/inventories/reservation - Đặt hàng
app.post('/api/v1/inventories/reservation', (req, res) => {
    const { product: productId, quantity } = req.body;
    if (!productId || !quantity || quantity <= 0)
        return res.status(400).json({ message: 'product và quantity (> 0) là bắt buộc' });
    const inv = getInventoryByProductId(productId);
    if (!inv) return res.status(404).json({ message: 'Không tìm thấy inventory cho product này' });
    if (inv.stock < quantity)
        return res.status(400).json({ message: `Không đủ stock để đặt hàng. Hiện có: ${inv.stock}, yêu cầu: ${quantity}` });
    inv.stock -= quantity;
    inv.reserved += quantity;
    inv.updatedAt = new Date().toISOString();
    res.json({ message: 'Đặt hàng (reservation) thành công', inventory: inv });
});

// POST /api/v1/inventories/sold - Xác nhận bán
app.post('/api/v1/inventories/sold', (req, res) => {
    const { product: productId, quantity } = req.body;
    if (!productId || !quantity || quantity <= 0)
        return res.status(400).json({ message: 'product và quantity (> 0) là bắt buộc' });
    const inv = getInventoryByProductId(productId);
    if (!inv) return res.status(404).json({ message: 'Không tìm thấy inventory cho product này' });
    if (inv.reserved < quantity)
        return res.status(400).json({ message: `Không đủ reserved. Hiện có: ${inv.reserved}, yêu cầu: ${quantity}` });
    inv.reserved -= quantity;
    inv.soldCount += quantity;
    inv.updatedAt = new Date().toISOString();
    res.json({ message: 'Xác nhận bán thành công', inventory: inv });
});

// ==========================================
// 7. KHỞI CHẠY SERVER
// ==========================================
app.listen(3000, () => {
    console.log('✅ Server chạy tại http://localhost:3000');
    console.log(`📦 Đã load ${products.length} products từ local data`);
    console.log(`🗃️  Đã tạo ${inventories.length} inventories tương ứng`);
});
