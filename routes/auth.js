var express = require('express');
var router = express.Router();
let userController = require('../controllers/users')
let { RegisterValidator, handleResultValidator, ChangePasswordValidator } = require('../utils/validatorHandler')
let bcrypt = require('bcrypt')
let jwt = require('jsonwebtoken')
let fs = require('fs')
let path = require('path')
let { checkLogin } = require('../utils/authHandler')

// RS256: dùng private key để ký token, public key để verify
let privateKey = fs.readFileSync(path.join(__dirname, '../private.pem'), 'utf8')

/* POST register */
router.post('/register', RegisterValidator, handleResultValidator, async function (req, res, next) {
    let newUser = userController.CreateAnUser(
        req.body.username,
        req.body.password,
        req.body.email,
        "69aa8360450df994c1ce6c4c"
    );
    await newUser.save()
    res.send({
        message: "dang ki thanh cong"
    })
});

/* POST login */
router.post('/login', async function (req, res, next) {
    let { username, password } = req.body;
    let getUser = await userController.FindByUsername(username);
    if (!getUser) {
        res.status(403).send("tai khoan khong ton tai")
    } else {
        if (getUser.lockTime && getUser.lockTime > Date.now()) {
            res.status(403).send("tai khoan dang bi ban");
            return;
        }
        if (bcrypt.compareSync(password, getUser.password)) {
            await userController.SuccessLogin(getUser);
            // Ký token bằng RS256 private key
            let token = jwt.sign(
                { id: getUser._id },
                privateKey,
                {
                    algorithm: 'RS256',
                    expiresIn: '30d'
                }
            )
            res.send(token)
        } else {
            await userController.FailLogin(getUser);
            res.status(403).send("thong tin dang nhap khong dung")
        }
    }
});

/* GET /me - lấy thông tin user đang đăng nhập */
router.get('/me', checkLogin, function (req, res, next) {
    res.send(req.user)
})

/* POST /change-password - đổi mật khẩu (yêu cầu đăng nhập) */
router.post('/change-password', checkLogin, ChangePasswordValidator, handleResultValidator, async function (req, res, next) {
    try {
        let { oldpassword, newpassword } = req.body;
        let user = req.user;

        // Kiểm tra oldpassword có đúng không
        let isMatch = bcrypt.compareSync(oldpassword, user.password);
        if (!isMatch) {
            return res.status(400).send("Mat khau cu khong dung");
        }

        // Kiểm tra newpassword không được trùng oldpassword
        if (bcrypt.compareSync(newpassword, user.password)) {
            return res.status(400).send("Mat khau moi khong duoc trung voi mat khau cu");
        }

        // Cập nhật mật khẩu mới (schema sẽ tự hash qua pre-save hook)
        user.password = newpassword;
        await user.save();

        res.send({ message: "Doi mat khau thanh cong" });
    } catch (error) {
        next(error);
    }
})

module.exports = router;
