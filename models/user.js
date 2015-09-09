let mongoose = require('mongoose')
let bcrypt = require('bcrypt')
let nodeify = require('bluebird-nodeify')

require('songbird')

let userSchema = mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    blogTitle: String,
    blogDescription: String
})

userSchema.methods.generateHash = async function(password) {
    return await bcrypt.promise.hash(password, 8)
}

userSchema.methods.validatePassword = async function(password) {
    return await bcrypt.promise.compare(password, this.password)
}

//TODO: regeex for
//Minimum length: 4
// At least 1 uppercase and 1 lowercase letter
// At least 1 number
userSchema.path('password').validate((password) => {
    return password.length >= 4
})


//!! using regular function here
//because we don't want to inherit outsider this
userSchema.pre('save', function(callback) {
    nodeify(async() => {
        //if user did not change password, do nothing
        if (!this.isModified('password')) return callback()
            //otherwise generate a hash
        this.password = await this.generateHash(this.password)
    }(), callback)
})
module.exports = mongoose.model('User', userSchema)
