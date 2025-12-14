// src/validators/user.js
const { body } = require('express-validator')

const validateUserUpdate = [
  body("username")
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage("用户名长度应为3-50个字符")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("用户名只能包含字母、数字和下划线"),
  
  body("nickname")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("昵称不能超过50个字符"),
  
  body("email")
    .optional({ nullable: true, checkFalsy: true })
    .if(body("email").notEmpty())
    .isEmail()
    .withMessage("邮箱格式不正确"),
  
  body("phone")
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (!value) return true
      const phoneRegex = /^\+\d{1,3}\s\d{6,15}$/
      return phoneRegex.test(value)
    })
    .withMessage("手机号格式不正确"),
  
  // ... 其他验证规则
]

module.exports = {
  validateUserUpdate
}