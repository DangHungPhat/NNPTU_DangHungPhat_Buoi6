const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const app = express();
app.use(express.json());

// 1. ĐỌC 2 FILE MÃ HOÁ RS256 ĐÃ TẠO Ở BƯỚC 1
const privateKey = fs.readFileSync('private.pem', 'utf8');
const publicKey = fs.readFileSync('public.pem', 'utf8');

// (Mô phỏng Database) Cấu trúc user trên Git của bạn có thể khác
let users =[
    { 
        id: 1, 
        username: 'admin', 
        // Password gốc là '123456' đã được băm bằng bcrypt
        password: '$2a$10$X8... (mã băm của 123456, trong code thật bạn phải dùng bcrypt.hashSync)' 
    }
];

// Để code chạy test dễ dàng, mình dùng hàm hash tạm cho user admin:
users[0].password = bcrypt.hashSync('123456', 10);

// ==========================================
// MIDDLEWARE: Kiểm tra đăng nhập (Xác thực token)
// ==========================================
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1]; // Lấy token từ header "Bearer <token>"
    if (!token) return res.status(401).json({ message: "Yêu cầu đăng nhập!" });

    try {
        // DÙNG PUBLIC KEY ĐỂ VERIFY VÀ KHAI BÁO THUẬT TOÁN RS256
        const decoded = jwt.verify(token, publicKey, { algorithms:['RS256'] });
        req.userId = decoded.id; // Lưu id vào request để các hàm sau dùng
        next();
    } catch (error) {
        return res.status(403).json({ message: "Token không hợp lệ hoặc đã hết hạn!" });
    }
};

// ==========================================
// CHỨC NĂNG 1: LOGIN
// ==========================================
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);

    if (!user) return res.status(404).json({ message: "Không tìm thấy user" });

    // Kiểm tra mật khẩu
    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ message: "Sai mật khẩu" });

    // TẠO TOKEN BẰNG PRIVATE KEY VÀ THUẬT TOÁN RS256
    const token = jwt.sign({ id: user.id }, privateKey, { algorithm: 'RS256', expiresIn: '1h' });

    res.json({ message: "Đăng nhập thành công", token: token });
});

// ==========================================
// CHỨC NĂNG 2: /ME (Lấy thông tin user)
// ==========================================
app.get('/me', verifyToken, (req, res) => {
    const user = users.find(u => u.id === req.userId);
    if (!user) return res.status(404).json({ message: "Không tìm thấy user" });

    // Không trả về password cho client
    const { password, ...userInfo } = user;
    res.json({ message: "Thông tin của bạn", data: userInfo });
});

// ==========================================
// CHỨC NĂNG 3: CHANGE PASSWORD (Yêu cầu đăng nhập)
// ==========================================
app.post('/changepassword', verifyToken, (req, res) => {
    const { oldpassword, newpassword } = req.body;
    const user = users.find(u => u.id === req.userId);

    // 1. Kiểm tra xem có truyền đủ 2 trường không
    if (!oldpassword || !newpassword) {
        return res.status(400).json({ message: "Vui lòng nhập đủ oldpassword và newpassword" });
    }

    // 2. Kiểm tra mật khẩu cũ có đúng không
    const isOldPasswordValid = bcrypt.compareSync(oldpassword, user.password);
    if (!isOldPasswordValid) {
        return res.status(400).json({ message: "Mật khẩu cũ không chính xác" });
    }

    // 3. VALIDATE NEW PASSWORD (Ví dụ: phải có ít nhất 6 ký tự)
    if (newpassword.length < 6) {
        return res.status(400).json({ message: "Mật khẩu mới phải có ít nhất 6 ký tự" });
    }
    if (newpassword === oldpassword) {
        return res.status(400).json({ message: "Mật khẩu mới không được trùng mật khẩu cũ" });
    }

    // 4. Mã hóa mật khẩu mới và lưu vào DB
    const hashedNewPassword = bcrypt.hashSync(newpassword, 10);
    user.password = hashedNewPassword; // Cập nhật (nếu dùng DB thật thì dùng câu lệnh UPDATE)

    res.json({ message: "Đổi mật khẩu thành công!" });
});

// Khởi chạy server
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
