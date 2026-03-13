let jwt = require('jsonwebtoken')
let fs = require('fs')
let path = require('path')
let userController = require('../controllers/users')

// RS256: dùng public key để verify token
let publicKey = fs.readFileSync(path.join(__dirname, '../public.pem'), 'utf8')

module.exports = {
    checkLogin: async function (req, res, next) {
        let token = req.headers.authorization;
        if (!token || !token.startsWith("Bearer")) {
            res.status(403).send("ban chua dang nhap");
            return;
        }
        token = token.split(" ")[1];
        try {
            let result = jwt.verify(token, publicKey, { algorithms: ['RS256'] })
            let user = await userController.FindById(result.id)
            if (!user) {
                res.status(403).send("ban chua dang nhap");
            } else {
                req.user = user;
                next()
            }
        } catch (error) {
            res.status(403).send("ban chua dang nhap");
        }
    }
}