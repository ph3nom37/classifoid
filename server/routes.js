var q = require('./query'),
    crypto = require('crypto'),
    bcrypt = require('bcrypt'),
    check = require('validator').check,
    sanitize = require('validator').sanitize,
    fs = require('fs'),
    knox = require('knox'),
    blitline = require('blitline'),
    display = require('./display'),
    geoip = require('geoipcity');

var blitlineKey = config.blit.key
var awsS3Bucket = config.s3.bucket

var s3 = knox.createClient({
            key: config.s3.key,
            secret: config.s3.secret,
            bucket: config.s3.bucket
});

// globals
m = require('./email');
errorPage = require('./display').errorPage;
amazonURL = config.s3.amazonURL + awsS3Bucket + '/';
geoip.settings.license = config.geoip.license;
adminkey = config.app.adminkey; // one admin at a time

module.exports = function(app, pool) {

    // - public pages -
    app.get('/view', function(req, res) {
        display.homePage(res, 'classifoid\'s Home');
    });

    // add registration
    app.get('/a/r', function(req, res) {
        res.sendfile('public/html/addR.html');
    });

    // admin page
    app.get('/__admin_/*', function(req, res) {
        if (req.session.logged == true && req.session.email != null
                && req.session.admin == adminkey && req.params[0] == adminkey) {
                display.adminPage(res, 'admin page');
        } else {
            res.redirect('/l/');
        }
    });

    // - login required pages -

    // add item
    app.get('/a/i', function(req, res) {
        if (req.session.logged == true && req.session.email != null) {
            res.sendfile('public/html/addI.html');
        } else {
            res.redirect('https://127.0.0.1:3701/l/ai');
        }
    });

    // edit my item
    app.get('/e/mi/*', function(req, res) {
        id = req.params[0];
        if (req.session.logged == true && req.session.email != null) {
            res.sendfile('public/html/editI.html');
        } else {
            res.redirect('https://127.0.0.1:3701/l/emi');
        }
    });

    // edit user profile
    app.get('/e/u', function(req, res) {
        if (req.session.logged == true && req.session.email != null) {
            res.sendfile('public/html/editU.html');
        } else {
            res.redirect('https://127.0.0.1:3701/l/eu');
        }
    });

    // upload pic
    app.get('/u/p', function(req, res) {
        if (req.session.logged == true && req.session.email != null) {
            res.sendfile('public/html/uploadPic.html');
        } else {
            res.redirect('https://127.0.0.1:3701/l/up');
        }
    });

    // main test page
    app.get('/', function(req, res) {
        var body = 'login stuff \
                    <br><a href=https://127.0.0.1:3701/l/>login</a> \
                    <br><a href=http://127.0.0.1:3700/lo>logout</a> \
                    <br> \
                    <br>user stuff \
                    <br><a href=http://127.0.0.1:3700/html/addR.html>add registration</a> \
                    <br><a href=http://127.0.0.1:3700/html/pwdReset.html>password reset</a> \
                    <br><a href=http://127.0.0.1:3700/e/u>edit profile/user (login required)</a> \
                    <br> \
                    <br>item stuff \
                    <br><a href=http://127.0.0.1:3700/pv/i>preview item (no login required)</a> \
                    <br><a href=http://127.0.0.1:3700/v/i>view item</a> \
                    <br><a href=http://127.0.0.1:3700/v/mi>view my item</a> \
                    <br><a href=http://127.0.0.1:3700/e/mi/>edit my item</a> \
                    <br><a href=http://127.0.0.1:3700/u/p>upload pic</a> \
                    <br><a href=http://127.0.0.1:3700/a/i>add item</a>';

        res.set('Content-Type', 'text/html');
        res.send(body);
    });

    // login
    app.get('/l/*', function(req, res) {
        //if (req.header('X-Forwarded-Proto') == 'https') {
        if (req.secure) {
            q.queryCookieAuthenticate(pool, req, res);
        } else {
            res.send('invalid request - only secure protocol allowed');
        }
    });

    // logout
    app.get('/lo', function(req, res) {
        if (req.session.logged == true) {
            req.session.logged = false;
            req.session.email = null;
            req.session.company_location_id = 0;
            if (req.session.admin) {
                req.session.admin = null;
            }

            res.clearCookie('clID');

            res.send('successfully logged out');
        } else {
            res.send('logout page');
        }
    });

    // preview item (public page)
    app.get('/pv/i', function(req, res) {
        var zip = req.session.zip;
        
        if (zip == null) {
            geoip.lookup(req.ip, function(err, data) {
                if (!err) {
                    console.log(data.city + ', ' + data.postalCode);
                    req.session.zip = data.postalCode;
                    req.session.city = data.city;
                    q.queryPreviewItem(pool, data.postalCode, res, display.general);
                } else {
                    console.log(err);
                    res.send('ip lookup error occurred');
                }
            });
        } else {
            q.queryPreviewItem(pool, zip, res, display.general);
        }
    });

    // resend verification email (item)
    app.get('/r/v/e/*', function(req, res) {
        if (req.session.logged == true && req.session.email != null) {
            var obj = new Object();
            obj.user_id = req.session.id;
            obj.id = req.params[0];
            obj.email = req.session.email;
            obj.key = -1 - Math.floor(Math.random()*300000);
    
            q.queryResendItemVerification(pool, obj, req, res, display.general);
        } else {
            res.send('error page SERVED here');
        }
    });

    // view item
    app.get('/v/i', function(req, res) {
        if (req.session.logged == true && req.session.email != null) {
            q.queryViewItem(pool, req.session.email, res, display.general);
        } else {
            res.redirect('https://127.0.0.1:3701/l/vi');
        }
    });

    // view my item (editable)
    app.get('/v/mi', function(req, res) {
        if (req.session.logged == true && req.session.email != null) {
            // display function should contain edit item links
            q.queryViewMyItem(pool, req.session.email, res, display.editItem);
        } else {
            // maybe useful later
            //url = req.protocol + '://' + req.host + ':3700' + req.path;
            res.redirect('https://127.0.0.1:3701/l/vmi');
        }
    });

    // verify item
    app.get('/vr/i/*/*/*', function(req, res) {
        if (!req.secure) {
            res.send('invalid request - only secure protocol allowed');
            return;
        }

        var obj = new Object();

        obj.email = new Buffer(req.params[0], 'base64').toString('ascii');
        obj.id = req.params[1];
        obj.active_until = req.params[2];

        q.queryVerifyItem(pool, obj, res, display.general);
    });

    // verify registration
    app.get('/v/r/*/*', function(req, res) {
        if (!req.secure) {
            res.send('invalid request - only secure protocol allowed');
            return;
        }

        var obj = new Object();

        obj.email = new Buffer(req.params[0], 'base64').toString('ascii');
        obj.key = req.params[1];
        obj.now = Date.now();

        console.log(email + " " + key + " " + now);
        try {
            check(email).isEmail();
        } catch (ex) {
            // send error to browser
            console.log("invalid email");
            res.send("invalid attempt");
            return;
        }

        try {
            check(key).is(/^[0-9a-f]+$/);
        } catch (ex) {
            // send error to browser
            console.log("invalid code");
            res.send("invalid attempt");
            return;
        }

        q.queryVerifyRegistration(pool, obj, res, display.general);
    });

    // reset password (link in the email after the request)
    app.get('/r/p/*/*', function(req, res) {
        if (!req.secure) {
            res.send('invalid request - only secure protocol allowed');
            return;
        }

        var obj = new Object();

        obj.email = new Buffer(req.params[0], 'base64').toString('ascii');
        obj.key = req.params[1];
        obj.now = Date.now();

        try {
            check(obj.email).isEmail();
        } catch (ex) {
            // send error to browser
            console.log("invalid email");
            res.send("invalid attempt");
            return;
        }

        try {
            check(obj.key).is(/^[0-9a-f]+$/);
        } catch (ex) {
            // send error to browser
            console.log("invalid code");
            res.send("invalid attempt");
            return;
        }

        // check validity of request and serve a page where you can enter a new password
        q.queryVerifyPasswordReset(pool, obj, res, display.general);
    });

    // error page
    app.get('*', function(req, res) {
        res.send('error page SERVED here');
    });

    // - POST handlers - 
   
    // add item
    app.post('/a/i', function(req, res) {
        if (req.session.logged != true || req.session.email == null) {
            return;
        }

        q.queryVerifyAddItem(pool, req, res, function(result) {
            if (result == -1) {
                // db related error
                return;
            } else if (result == 0) {
                // permission error
                res.send('verification pending from a previous post');
                return;
            }

            var item = new Object();

            item.company_location_id = req.session.company_location_id;

            // check for req.body.length?

            item.user_id = req.session.id;
            item.item = req.body.item;
            item.description = req.body.description;
            item.price = req.body.price;
            item.zip = 0;
            item.city = 0;
            item.show_phone = 0;

            if (req.body.inactive) {
                item.active_until = 0;
            } else if (0 == Math.floor(Math.random()*config.app.itemVerifyFreq)%config.app.itemVerifyFreq) {
                // verification email link
                item.active_until = -1 - Math.floor(Math.random()*300000);
            } else {
                item.active_until = Date.now() + (86400000 * config.app.itemExpireDays);
            }

            if (req.files && req.files.gImage.size > 0) {
                console.log(req.files);

                var image = req.files.gImage;
                var s3Headers = {
                    'Content-Type': image.type,
                    'x-amz-acl': 'public-read'
                };

                // get rid of '/tmp/' and append email address in hex
                var uniq = image.path.substring(5, Math.floor(Math.random()*20)+11) + new Buffer(req.session.email).toString('hex');

                s3.putFile(image.path, uniq, s3Headers, function(err, s3response){
                    if (err) {
                        res.send('S3 error.  Please try uploading again');
                    } else if (200 == s3response.statusCode) { 
                        console.log('Uploaded to Amazon S3!');

                        var blit = new blitline();

                        var url = amazonURL + uniq;
                        var blitJob = blit.addJob(blitlineKey, url);
                        var renamed = '_' + uniq;

                        blitJob.addFunction('resize_to_fit', { width: config.s3.resize.width, height: config.s3.resize.height }).addSave('resized', awsS3Bucket, renamed);
                        blit.postJobs(function(response) {
                            console.log('blitline response: ' + response);
                            if (!response.error) {
                                s3.deleteFile(uniq, function(err, res) {
                                    if (err) {
                                        console.log('couldn\'t delete the orifinal file');
                                    } else {
                                        console.log('deleted original file on S3: ' + res.statusCode);
                                    }
                                });

                                item.image_paths = renamed;

                                q.queryAddItem(pool, item, req, res, display.general);
                                console.log('successfully resized file on Amazon S3');
                            } else {
                                console.log('blitline error.  please try uploading again');
                            }
                        });

                        // delete local file
                        fs.unlink(image.path, function(err) {
                            if (err) {
                                console.log('couldn\'t delete local file');
                            } else {
                                console.log('successfully deleted local file ' + image.path); 
                            }
                        });
                    } else { 
                        console.log('Failed to upload file to Amazon S3'); 
                    }
                });
            } else {
                item.image_paths = null;
                q.queryAddItem(pool, item, req, res, display.general);
                console.log('no file has been uploaded');
            }
        });
    });

    // add registration
    app.post('/a/r', function(req, res) {
        // these suffixes are not allowed
        for (var i=0; i<config.app.blockEmail.length; i++) {
            if (config.app.blockEmail[i].indexOf(req.body.email) > 0) {
                res.send('email suffix not allowed: ' + config.app.blockEmail[i]);
                return;
            }
        }

        var reg = new Object();

        reg.email = req.body.email;

        // synchronous
        try {
            reg.key = crypto.randomBytes(23).toString('hex');
        } catch (ex) {
            console.log('crypto failed');
            errorPage(res, null, 'system');
            return;
        }

        reg.expire_time = Date.now() + (86400000 * config.app.registerExpireDays);
    
        reg.company_id = 1;
        reg.company_location_id = 1;
        q.queryAddRegistration(pool, reg, res, display.general);
    });
 
    // edit user
    app.post('/e/u', function(req, res) {
        if (req.session.logged == true && req.session.email != null) {
            var user = new Object();

            user.email = req.session.email;
            user.company_location_id = req.session.company_location_id;

            // synchronous
            user.pwd = bcrypt.hashSync(req.body.pwd, 8);

            user.name = req.body.name;
            user.dept = req.body.dept;
            user.position = req.body.position;
            user.phone = req.body.phone;

            // TODO:
            //user.item_cnt = 1;
    
            console.log('edit user ' + user.pwd);
 
            q.queryEditUser(pool, user, res, display.general);
        }
    });

    // edit my item
    app.post('/e/mi', function(req, res) {
        if (req.session.logged == true && req.session.email != null) {
            var item = new Object();
    
            item.item = req.body.item;
            item.description = req.body.description;
            item.price = req.body.price;
            // these shouldn't be edited
            //item.image_count = req.body.image_count;
            //item.image_paths = req.body.image_paths;
            //item.user_id = req.session.id;
            //item.company_location_id = req.body.company_location_id;
            item.zip = 0;
            item.city = 0;
            item.show_phone = 0;
            
            if (req.body.delete) {
                q.queryDeleteItem(pool, req.body.id, req.session.email, res, display.general);
            } else {
                q.queryEditItem(pool, item, req.body.id, req.session.email, res, display.general);
            }
        }
    });

    // process registration
    app.post('/p/r', function(req, res) {
        if (!req.secure) {
            res.send('invalid request - only secure protocol allowed');
            return;
        }

        var obj = new Object();

        obj.email = req.body.email;
        obj.pwd = req.body.pwd;
        obj.name = req.body.name;
        obj.company_location_id = req.body.company_location_id;
        obj.dept = req.body.dept;
        obj.position = req.body.position;
        obj.phone = req.body.phone;

        try {
            check(obj.email).isEmail();
        } catch (ex) {
            // send error to browser
            console.log("invalid email");
            res.send("invalid attempt");
            return;
        }

        q.queryProcessRegistration(pool, obj, res, display.general);
    });

    // reset password (initial request, only email is being submitted)
    app.post('/r/p', function(req, res) {
        var reg = new Object();

        reg.email = req.body.email;

        // synchronous
        try {
            reg.key = crypto.randomBytes(23).toString('hex');
        } catch (ex) {
            console.log('crypto failed');
            errorPage(res, null, 'system');
            return;
        }

        reg.expire_time = Date.now() + (config.app.resetPwdHours * 3600000);

        // confirm validity of email address
        q.queryAddPasswordReset(pool, reg, res, display.general);
    });

    // reset password with new password
    app.post('/r/p/n', function(req, res) {
        if (!req.secure) {
            res.send('invalid request - only secure protocol allowed');
            return;
        }

        var obj = new Object();

        obj.email = req.body.email;
        obj.key = req.body.key;
        obj.pwd = req.body.pwd;
        obj.now = Date.now();

        try {
            check(obj.email).isEmail();
        } catch (ex) {
            // send error to browser
            console.log("invalid email");
            res.send("invalid attempt");
            return;
        }

        try {
            check(obj.key).is(/^[0-9a-f]+$/);
        } catch (ex) {
            // send error to browser
            console.log("invalid code");
            res.send("invalid attempt");
            return;
        }

        q.queryProcessPasswordReset(pool, obj, res, display.general);
    });

    // upload pic
    app.post('/u/p', function(req, res) {
        if (req.session.logged == true && req.session.email != null) {
            q.queryVerifyAddImage(pool, req, res, function(result) {
                if (result == -1) {
                    // db related error
                    return;
                } else if (result == 0) {
                    // permission error
                    res.send('not allowed to upload for this item');
                    return;
                }

                // the user is allowed to upload image for this time
                if (req.files) {
                    console.log(req.files);
    
                    var image = req.files.gImage;
                    var s3Headers = {
                        'Content-Type': image.type,
                        'x-amz-acl': 'public-read'
                    };
    
                    // get rid of '/tmp/' and append email address in hex
                    var uniq = image.path.substring(5, Math.floor(Math.random()*20)+11) + new Buffer(req.session.email).toString('hex');
    
                    s3.putFile(image.path, uniq, s3Headers, function(err, s3response){
                        if (err) {
                            res.send('S3 error.  Please try uploading again');
                        } else if (200 == s3response.statusCode) { 
                            console.log('Uploaded to Amazon S3!');
    
                            var blit = new blitline();

                            var url = amazonURL + uniq;
                            var blitJob = blit.addJob(blitlineKey, url);
                            var renamed = '_' + uniq;
    
                            blitJob.addFunction('resize_to_fit', { width: config.s3.resize.width, height: config.s3.resize.height }).addSave('resized', awsS3Bucket, renamed);
                            blit.postJobs(function(response) {
                                console.log('blitline response: ' + response);
                                if (!response.error) {
                                    s3.deleteFile(uniq, function(err, res) {
                                        if (err) {
                                            console.log('couldn\'t delete the orifinal file');
                                        } else {
                                            console.log('deleted original file on S3: ' + res.statusCode);
                                        }
                                    });
    
                                    q.queryAddImage(pool, renamed, req, res, display.general);
                                } else {
                                    res.send('blitline error.  please try uploading again');
                                }
                            });
    
                            // delete local file
                            fs.unlink(image.path, function(err) {
                                if (err) {
                                    console.log('couldn\'t delete local file');
                                } else {
                                    console.log('successfully deleted local file ' + image.path); 
                                }
                            });
                        } else { 
                            res.send('Failed to upload file to Amazon S3'); 
                        }
                    });
    
                    /* local storage
                    fs.readFile(req.files.gImage.path, function(err, data) {
                        var newPath = __dirname + '/uploads/uploadedFileName';
                        fs.writeFile(newPath, data, function(err) {
                            res.redirect('back');
                        });
                    });
                    */
                } else {
                    res.send('file not found');
                }
            });
        } else {
            res.redirect('https://127.0.0.1:3701/l/up');
        }
    });

    app.post('/l/*', function(req, res) {
        
    });

    // login
    app.post('/l/*', function(req, res) {
        console.log('login post: url = ' + req.get('referrer'));

        q.queryAuthenticate(pool, bcrypt, req, res, display.general);
    });
}
