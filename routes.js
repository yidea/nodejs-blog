let fs = require('fs')
let multiparty = require('multiparty')
let then = require('express-then')
let isLoggedIn = require('./middleware/isLoggedIn')
let Post = require('./models/post')
let DataUri = require('datauri')
module.exports = (app) => {
    let passport = app.passport

    app.get('/', (req, res) => {
        res.render('index.ejs')
    })

    app.get('/login', (req, res) => {
        res.render('login.ejs', {
            message: req.flash('error')
        })
    })

    app.post('/login', passport.authenticate('local-login', {
        successRedirect: '/profile',
        failureRedirect: '/login',
        failureFlash: true
    }))

    app.get('/signup', (req, res) => {
        res.render('signup.ejs', {
            message: req.flash('error')
        })
    })

    // process the signup form
    app.post('/signup', passport.authenticate('local-signup', {
        successRedirect: '/profile',
        failureRedirect: '/signup',
        failureFlash: true
    }))

    app.get('/profile', isLoggedIn, then(async(req, res) => {
        let posts = await Post.promise.find({
            userId: req.user.id
        })

        let comments = []
        for (let post of posts) {
            if (post.comments && post.comments.length > 0) {
                // take the last comment in the array as the latest comment
                let comment = post.comments[post.comments.length - 1]

                comments.push({
                    content: comment.content.substr(0, 124),
                    username: comment.username,
                    created: comment.created,
                    postLink: "/post/" + post.id
                })
            }
        }
        res.render('profile.ejs', {
            user: req.user,
            posts: posts,
            comments: comments,
            message: req.flash('error'),

        })
    }))

    app.get('/logout', (req, res) => {
        req.logout()
        res.redirect('/')
    })


    app.get('/blog/:userId', then(async(req, res) => {
        let query = {
            userId: req.params.userId
        }
        let requestUserId = req.user ? req.user.id : null
        let posts = await Post.promise.find(query)
        let dataUri = new DataUri()
        for (var post of posts) {
            if (post.image.data) {
                let image = dataUri.format('.' + post.image.contentType.split('/').pop(), post.image.data)
                post.imageData = `data:${post.image.contentType};base64,${image.base64}`
            }
        }
        res.render('post/posts.ejs', {
            posts: posts,
            requestUserId: requestUserId,
            blogUserId: req.params.userId
        })
    }))

    //get all posts
    app.get('/posts', then(async(req, res) => {
        let posts = await Post.promise.find({})
        let requestUserId = req.user ? req.user.id : null
        let dataUri = new DataUri()
        for (var post of posts) {
            if (post.image.data) {
                let image = dataUri.format('.' + post.image.contentType.split('/').pop(), post.image.data)
                post.imageData = `data:${post.image.contentType};base64,${image.base64}`
            }
        }
        res.render('post/posts.ejs', {
            posts: posts,
            requestUserId: requestUserId,
            blogUserId: null
        })
    }))


    app.get('/post/:postId?', then(async(req, res) => {
        let postId = req.params.postId
        let requestUserId = req.user ? req.user.id : null
        if (!postId) {
            res.render('post/edit.ejs', {
                post: {
                    comments: []
                },
                verb: 'Create'
            })
            return
        }
        let post = await Post.promise.findById(postId)
        if (!post) res.status(404).send('Not found')

        let dataUri = new DataUri()
        let image
        let imageData
        if (post.image.data) {
            image = dataUri.format('.' + post.image.contentType.split('/').pop(), post.image.data)
            imageData = `data:${post.image.contentType};base64,${image.base64}`
        }
        res.render('post/show.ejs', {
            post: post,
            verb: 'Edit',
            image: imageData,
            requestUserId: requestUserId,
            //show edit button or not
            canEdit: requestUserId && (requestUserId == post.userId)
        })

    }))

    app.get('/post/edit/:postId?', then(async(req, res) => {
        let postId = req.params.postId
        let requestUserId = req.user ? req.user.id : null
        if (!postId) {
            res.render('post/edit.ejs', {
                post: {
                    comments: []
                },
                verb: 'Create'
            })
            return
        }
        let post = await Post.promise.findById(postId)
        if (!post) res.status(404).send('Not found')

        let dataUri = new DataUri()
        let image
        let imageData
        if (post.image.data) {
            image = dataUri.format('.' + post.image.contentType.split('/').pop(), post.image.data)
            imageData = `data:${post.image.contentType};base64,${image.base64}`
        }
        return res.render('post/edit.ejs', {
            post: post,
            verb: 'Edit',
            image: imageData,
            requestUserId: requestUserId
        })
    }))

    app.post('/post/:postId?', isLoggedIn, then(async(req, res) => {
        let postId = req.params.postId
        let post
        if (!postId) {
            post = new Post()
        } else {
            post = await Post.promise.findById(postId)
            if (!post) res.status(404).send('Not found')
        }

        let [{
            title: [title],
            content: [content]
        }, {
            image: [file]
        }] = await new multiparty.Form().promise.parse(req)
        post.title = title
        post.content = content
        console.log(file, title, content)
        if (file.originalFilename !== '') {
            post.image.data = await fs.promise.readFile(file.path)
            post.image.contentType = file.headers['content-type']
        }
        post.userId = req.user.id
        await post.save()
        postId = post.id
        res.redirect('/post/' + postId)
        return
    }))

    app.delete('/post/:postId', isLoggedIn, (req, res) => {
        async() => {
            let postId = req.params.postId
            let post = await Post.promise.findById(postId)
            if (post) await post.promise.remove()
            res.end()
        }().catch(e => console.log('err', e))
    })

    app.post('/comment', isLoggedIn, then(async(req, res) => {

        let post = await Post.promise.findById(req.body.postId)
        if (post) {
            post.comments.push({
                content: req.body.comment,
                username: req.user.username
            })
            await post.save()
        }

        res.redirect('/post/' + req.body.postId)
    }))

    app.post('/logincomment', passport.authenticate('local-login'), then(async(req, res) => {

        // get the post document
        let post = await Post.promise.findById(req.body.postId)
        if (post) {
            post.comments.push({
                content: req.body.comment,
                username: req.user.username
            })
            await post.save()
        }

        res.redirect('/post/' + req.body.postId)
    }))


}