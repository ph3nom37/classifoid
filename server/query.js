var crypto = require('crypto');

var q_getCompany      = 'select c.name from company c, registration r where c.id = r.company_id and r.email = ?';
var q_getLocations    = 'select cl.street, cl.city, cl.state from company_location cl, registration r where cl.company_id = r.company_id and r.email = ?';
var q_getItem         = 'select i.* from item i, user u where i.company_location_id = u.company_location_id and u.email = ?';
var q_getMyItem       = 'select i.* from item i, user u where i.user_id = u.id and u.email = ?';
var q_getItemPreview  = 'select i.* from item i, company_location cl where i.company_location_id = cl.id and cl.zip = ?';
var q_resendItemVerification = 'update item i set i.active_until = X where i.id = X and i.user_id = X';

var q_verifyReg       = 'select email from registration r where r.email = X and r.key = X and r.expire_time > X';
var q_authenticate    = 'select pwd, company_location_id, id from user where email = ?';
var q_cookieauth      = 'select u.email, u.company_location_id, c.user_id from user u, cookie c where c.key = \'clID\' and c.value = ? and u.id = c.user_id';

var q_editUser        = 'update user u set ? where u.email = X';
var q_editPwd         = 'update user u set u.pwd = X where u.email = X';
var q_editItem        = 'update item i join user u on i.user_id = u.id set ? where i.id = X and u.email = X';

var q_addItem         = 'insert into item set ?';
var q_addUser         = 'insert into user set ?';
var q_addReg          = 'insert into registration set ?';
var q_addPwdReset     = 'insert into password_reset set ?';
var q_addImage        = 'update item i join user u on i.user_id = u.id set i.image_paths = X, i.image_count = i.image_count+1 where i.id = X and u.email = X';
var q_verifyAddItem   = 'select active from user where id = ?';
var q_verifyAddImage  = 'select i.id from item i where i.user_id = X and i.id = X';
var q_verifyItem      = 'update item i join user u on i.user_id = u.id set active_until = X, u.active = 1 where i.id = X and u.email = X and active_until < 0';

var q_delReg          = 'delete from registration where email = ?';
var q_delItem         = 'delete from item i join user u on i.user_id = u.id where i.id = X and u.email = X';

var q_verifyPwdReset  = 'select email from password_reset p where p.email = X and p.key = X and p.expire_time > X';
var q_processPwdReset = 'select email from password_reset p where p.email = X and p.key = X and p.expire_time > X';

var q_alert1          = 'select email from user where company_location_id = X and (alert&X) = X'; 

var itemAddedEvent  = 1;
var someOtherEvent  = 2;

// move to common/utility code
function endsWith(str, suffix) {
    if (str.indexOf(suffix, str.length - suffix.length) > -1)
        return 1;
    else
        return 0;
}

// not used at the moment
function generateMassAlert(pool, obj, ev) {
    switch(ev) {
        case itemAddedEvent:
            var query = q_alert1;
            var emails = '';

            query = query.replace('X', obj.company_location_id);
            query = query.replaceAll(/X/g, itemAddedEvent);

            pool.getConnection(function(err, connection) {
                if (err) {
                    console.log('connection pool error');
                }

                connection.query(query, function(err, rows, fields) {
                    if (err) {
                        console.log('generateMassAlert: query error');
                    } else {
                        for (var i=0; i<rows.length; i++) {
                            emails += rows[i]['email'] + ";";
                        }

                        // TODO: turn this into child_process?
                        m.email('GAE', obj, emails); 
                    }

                    connection.end();
                });
            });
            break;
        case someOtherEvent:
            break;
        default:
    }
}

function queryAddItem(pool, obj, req, res, display) {
    pool.getConnection(function(err, connection) {
        if (err) {
            errorPage(res, err, 'connection pool');
            return;
        }

        query = q_addItem;
        connection.query(query, obj, function(err, result) {
            if (err) {
                errorPage(res, err, 'query');
                connection.end();
                return;
            }

            // send verification email
            if (obj.active_until < 0) {
                obj.id = result.insertId;
                obj.email = req.session.email;
                obj.key = obj.active_until;

                var q_setInactive = 'update user set active = 0 where id = ?';
                connection.query(q_setInactive, req.session.id, function(err, result) {
                    if (err) {
                        errorPage(res, err, 'query');
                        connection.end();
                        return;
                    }

                    display(res, 'verification email sent. please check your inbox');
                });

                // send email
                m.email('item', obj, null);

            } else {
                display(res, 'thanks for posting. happy selling!');

                // disable alert for now - nobody wants to receive this many emails
                //generateMassAlert(connection, obj, itemAddedEvent);
            }

            connection.end();
        });
    });
}

function queryVerifyItem(pool, obj, res, display) {
    pool.getConnection(function(err, connection) {
        if (err) {
            errorPage(res, err, 'connection pool');
            return;
        }

        var query = q_verifyItem;

        query = query.replace('X', Date.now() + 1728000000);
        query = query.replace('X', obj.id);
        query = query.replace('X', connection.escape(obj.email));
        query = query.replace('X', obj.active_until);

        console.log(query);
        connection.query(query, function(err, result) {
            if (err) {
                errorPage(res, err, 'query');
                connection.end();
                return;
            } 

            // 2 b/c both the user and item rows are updated
            if (result.changedRows == 2) {
                display(res, 'Thank you for verifying.  Your item has been posted');
            } else {
                display(res, 'invalid attempt');
            }

            connection.end();
        });
    });
}

function queryVerifyAddItem(pool, req, res, callback) {
    pool.getConnection(function(err, connection) {
        if (err) {
            errorPage(res, err, 'connection pool');
            return callback(-1);
        }

        var query = q_verifyAddItem;

        connection.query(query, req.session.id, function(err, rows, fields) {
            if (err) {
                errorPage(res, err, 'query');
                connection.end();
                return callback(-1);
            }
            
            connection.end();

            if (rows[0]['active'] == 1){
                return callback(1);
            } else {
                return callback(0);
            }
        });
    });
}

function queryAddImage(pool, renamed, req, res, display) {
    pool.getConnection(function(err, connection) {
        if (err) {
            errorPage(res, err, 'connection pool');
            return;
        }

        var query = q_addImage;

        query = query.replace('X', connection.escape(renamed));
        query = query.replace('X', req.body.item_id);
        query = query.replace('X', connection.escape(req.session.email));

        connection.query(query, function(err, result) {
            if (err) {
                errorPage(res, err, 'query');
                connection.end();
                return;
            }

            display(res, 'image added to s3 and local db');
            connection.end();
        });
    });
}

function queryVerifyAddImage(pool, req, res, callback) {
    pool.getConnection(function(err, connection) {
        if (err) {
            errorPage(res, err, 'connection pool');
            return callback(-1);
        }

        var query = q_verifyAddImage;

        query = query.replace('X', connection.escape(req.session.id));
        query = query.replace('X', req.body.item_id);

        connection.query(query, function(err, rows, fields) {
            if (err) {
                errorPage(res, err, 'query');
                connection.end();
                return callback(-1);
            }
            
            connection.end();

            if (rows.length != 1){
                return callback(0);
            } else {
                console.log('image can be added to db by this user: ' + req.session.email);
                return callback(1);
            }
        });
    });
}

function queryResendItemVerification(pool, obj, req, res, display) {
    pool.getConnection(function(err, connection) {
        if (err) {
            errorPage(res, err, 'connection pool');
            return;
        }

        var query = q_resendItemVerification;

        query = query.replace('X', obj.key);
        query = query.replace('X', obj.id);
        query = query.replace('X', obj.user_id);

        connection.query(query, function(err, result) {
            if (err) {
                errorPage(res, err, 'query');
                connection.end();
                return;
            }

            if (result.changedRows == 1) {
                display(res, 'verification email sent. please check your inbox (from get request)');
                m.email('item', obj, null);
            } else {
                display(res, 'invalid resendItemVerification request');
            }

            connection.end();
        });
    });
}

function queryGetItem(pool, query, target, res, display) {
    pool.getConnection(function(err, connection) {
        if (err) {
            errorPage(res, err, 'connection pool');
            return;
        }

        connection.query(query, [target], function(err, rows, fields) {
            var result = '';
            if (err) {
                errorPage(res, err, 'query');
                connection.end();
                return;
            }
    
            for (var i=0; i<rows.length; i++) {
                for (var j=0; j<fields.length; j++) {
                    result += rows[i][fields[j].name] + " ";
                }
                result += ', <img src="' + amazonURL + rows[i]['image_paths'] + '"> <br>';
            }
            
            display(res, result);
            connection.end();
        });
    });
}

function queryDeleteRegistration(pool, email, res) {
    pool.getConnection(function(err, connection) {
        if (err) {
            errorPage(res, err, 'connection pool');
            return;
        }
        
        var query = q_delReg;

        connection.query(query, [email], function(err, result) {
            if (err) {
                errorPage(res, err, 'query');
                connection.end();
                return;
            }

            connection.end();
            console.log('registration successfully deleted after user created account');
        });
    });
}

function queryGetCompany(pool, email, res, display) {
    pool.getConnection(function(err, connection) {
        if (err) {
            errorPage(res, err, 'connection pool');
            return;
        }

        var query = q_getCompany;

        connection.query(query, [email], function(err, rows, fields) {
            var result = '';
            if (err) {
                errorPage(res, err, 'query');
                connection.end();
                return;
            }
    
            for (var i=0; i<rows.length; i++) {
                for (var j=0; j<fields.length; j++) {
                    result += rows[i][fields[j].name];
                }
            }
    
            display(res, result);
            connection.end();
        });
    });
}

// is this used?
function queryVerifyEmail(pool, query, email) {
    connection.query(query, [email], function(err, rows, fields) {
        if (err) {
            console.log('queryVerifyEmail error');
            return 0;
        }

        if (rows.length == 1)
            return 1;
        else
            return 0;
    });
}

function queryAddUser(pool, obj, query, res, display) {
    pool.getConnection(function(err, connection) {
        if (err) {
            errorPage(res, err, 'connection pool');
            return;
        }

        var query = q_addUser;

        connection.query(query, obj, function(err, result) {
            if (err) {
                errorPage(res, err, 'query');
                connection.end();
                return;
            }

            display(res, 'Thank you for registering');
            connection.end();
        });
    });
}

//
// exposed functions below
//

function queryAddRegistration(pool, obj, res, display) {
    pool.getConnection(function(err, connection) {
        if (err) {
            errorPage(res, err, 'connection pool');
            return;
        }

        var q_countRequest = 'select email from registration where email = ?';
        var q_emailExists = 'select company_id from company_email where email_suffix = ?';
        var suffix = obj.email.split('@').pop();
        var query = q_addReg;

        connection.query(q_emailExists, [suffix], function(err, rows, fields) {
            if (rows.length) {
                console.log('email address and company match. company location will be chosen during sign-up process. company_id = ' + rows[0][fields[0].name]);
                obj.company_id = rows[0]['company_id'];
    
            } else {
                m.email('mreg', obj, null);
                console.log('no company matches this email address. manual intervention required');
            }
    
            connection.query(q_countRequest, [obj.email], function(err, rows, fields) {
                if (rows.length > 2) {
                    display(res, 'You have too many outstanding requests');
                } else {
                    connection.query(query, obj, function(err, result) {
                        if (err) {
                            errorPage(res, err, 'query');
                            connection.end();
                            return;
                        }

                        display(res, 'Thank you.  You will receive an email (registration) from us shortly');
                        m.email('reg', obj, null);
                    });
                }
            });

            connection.end();
        });
    });
}

function queryVerifyRegistration(pool, obj, res, display) {
    pool.getConnection(function(err, connection) {
        if (err) {
            errorPage(res, err, 'connection pool');
            return;
        }

        var query = q_verifyReg;

        query = query.replace('X', connection.escape(obj.email));
        query = query.replace('X', connection.escape(obj.key));
        query = query.replace('X', connection.escape(obj.now));

        connection.query(query, function(err, rows, fields) {
            if (err) {
                errorPage(res, err, 'query');
                connection.end();
                return;
            }
            var regForm = 'Registration form for ' + obj.email + " working at ";
            var regError = 'Registration: invalid attempt. incorrect email or time expired';
    
            // verification successful
            if (rows.length > 0) {
                connection.query(q_getCompany, [obj.email], function(err, rows, fields) {
                    if (err) {
                        errorPage(res, err, 'query');
                        connection.end();
                        return;
                    }
                    if (rows.length > 0) {
                        var company = '';
                        company = rows[0]['name'];
    
                        // this could be Ajax'd
                        connection.query(q_getLocations, [obj.email], function(err, rows, fields) {
                            if (err) {
                                errorPage(res, err, 'query');
                                connection.end();
                                return;
                            }
                            var locations = '';
    
                            for (var i=0; i<rows.length; i++) {
                                for (var j=0; j<fields.length; j++) {
                                    locations += rows[i][fields[j].name] + ' ';
                                }
                                locations += '<br>, let user choose a company location and submit at https://localhost/p/r';
                            }
    
                            // this page should have form to finish registration
                            display(res, regForm + company + '<br><br>' + locations);
                        });
                    }
                });
            } else {
                display(res, regError);
            }

            connection.end();
        });
    });
}

function queryProcessRegistration(pool, obj, res, display) {
    queryAddUser(pool, obj, res, display);
    queryDeleteRegistration(pool, obj.email, res);
}

// edit user
function queryEditUser(pool, obj, res, display) {
    pool.getConnection(function(err, connection) {
        if (err) {
            errorPage(res, err, 'connection pool');
            return;
        }

        var query = q_editUser;
        query = query.replace('X', connection.escape(obj.email));

        connection.query(query, obj, function(err, result) {
            if (err) {
                errorPage(res, err, 'query');
                connection.end();
                return;
            }

            if (result.changedRows == 1) {
                res.send('User successfully updated');
            } else {
                res.send('You are not allowed to edit this user');
            }

            connection.end();
        });
    });
}

// edit item
function queryEditItem(pool, obj, id, email, res, display) {
    pool.getConnection(function(err, connection) {
        if (err) {
            errorPage(res, err, 'connection pool');
            return;
        }

        var query = q_editItem;
    
        query = query.replace('X', id);
        query = query.replace('X', connection.escape(email));
    
        console.log(query);
        connection.query(query, obj, function(err, result) {
            if (err) {
                errorPage(res, err, 'query');
                connection.end();
                return;
            }

            if (result.changedRows == 1) {
                res.send('Item successfully updated');
            } else {
                res.send('You are not allowed to edit this item');
            }

            connection.end();
        });
    });
}

// delete item
function queryDeleteItem(pool, id, email, s3, res, display) {
    pool.getConnection(function(err, connection) {
        if (err) {
            errorPage(res, err, 'connection pool');
            return;
        }
        
        var query = q_delItem;
        var q_getImageName = 'select image_paths from item where id = ?';

        query = query.replace('X', id);
        query = query.replace('X', connection.escape(email));

        connection.query(query, [email], function(err, result) {
            if (err) {
                errorPage(res, err, 'query');
                connection.end();
                return;
            }

            connection.query(q_getImageName, [id], function(err, rows, fields) {
                if (err) {
                    errorPage(res, err, 'query');
                    connection.end();
                    return;
                }

                if (rows.length == 1) {
                    s3.deleteFile(rows[0]['image_paths'], function(err, res) {
                        if (err) {
                            errorPage(res, err, 's3');
                            connection.end();
                            return;
                        }

                        console.log('sucessfully deleted image on s3');
                    });
                }
            });

            display(res, result);
            console.log('successfully deleted item');

            connection.end();
        });
    });
}

function queryPreviewItem(pool, zip, res, display) {
    // if zip returns no results, display random items preferably from near-by areas
    queryGetItem(pool, q_getItemPreview, zip, res, display);
}

function queryViewItem(pool, email, res, display) {
    queryGetItem(pool, q_getItem, email, res, display);
}

function queryViewMyItem(pool, email, res, display) {
    queryGetItem(pool, q_getMyItem, email, res, display);
}

function queryAddPasswordReset(pool, obj, res, display) {
    pool.getConnection(function(err, connection) {
        if (err) {
            errorPage(res, err, 'connection pool');
            return;
        }

        var query = q_addPwdReset;
        var q_countRequest = 'select email from password_reset where email = ?';
    
        connection.query(q_countRequest, [obj.email], function(err, rows, fields) {
            if (rows.length > 2) {
                display(res, 'You have too many outstanding requests');
            } else {
                connection.query(query, obj, function(err, result) {
                    if (err) {
                        errorPage(res, err, 'query');
                        connection.end();
                        return;
                    }

                    display(res, 'Thank you.  You will receive an email (password reset) from us shortly');
                    m.email('pwd', obj, null);
                });
            }

            connection.end();
        });
    });
}

function queryVerifyPasswordReset(pool, obj, res, display) {
    pool.getConnection(function(err, connection) {
        if (err) {
            errorPage(res, err, 'connection pool');
            return;
        }

        var query = q_verifyPwdReset;
    
        query = query.replace('X', connection.escape(obj.email));
        query = query.replace('X', connection.escape(obj.key));
        query = query.replace('X', connection.escape(obj.now));
    
        connection.query(query, function(err, rows, fields) {
            if (err) {
                errorPage(res, err, 'query');
                connection.end();
                return;
            }
    
            // verification successful
            if (rows.length == 1) {
                res.sendfile('public/html/editP.html');
            } else {
                display(res, "invalid attempt");
            }

            connection.end();
        });
    });
}

function queryProcessPasswordReset(pool, obj, res, display) {
    pool.getConnection(function(err, connection) {
        if (err) {
            errorPage(res, err, 'connection pool');
            return;
        }

        var query = q_processPwdReset;
    
        query = query.replace('X', connection.escape(obj.email));
        query = query.replace('X', connection.escape(obj.key));
        query = query.replace('X', connection.escape(obj.now));
    
        connection.query(query, function(err, rows, fields) {
            if (err) {
                errorPage(res, err, 'query');
                connection.end();
                return;
            }
            var success = 'Password reset successfully!';
            var fail = 'Password Reset: invalid attempt. incorrect email or time expired';
    
            // verification successful
            if (rows.length) {
                q_editPwd = q_editPwd.replace('X', connection.escape(obj.pwd));
                q_editPwd = q_editPwd.replace('X', connection.escape(obj.email));
    
                connection.query(q_editPwd, function(err, result) {
                    if (err) {
                        errorPage(res, err, 'query');
                        connection.end();
                        return;
                    }
                    if (result.changedRows == 1) {
                        display(res, success);
                    } else {
                        display(res, fail);
                    }
                });
            } else {
                display(res, regError);
            }

            connection.end();
        });
    });
}

function queryAuthenticate(pool, bcrypt, req, res, display) {
    pool.getConnection(function(err, connection) {
        if (err) {
            errorPage(res, err, 'connection pool');
            return;
        }

        var query = q_authenticate;
    
        query = query.replace('?', connection.escape(req.body.email));
    
        connection.query(query, function(err, rows, fields) {
            var q_addCookie = 'insert into cookie set ? on duplicate key update value = X, expire_time = X';
            var success = 'Authenticated';
            var fail = 'Authentication failed';
    
            if (err) {
                errorPage(res, err, 'query');
                connection.end();
                return;
            }
    
            if (rows.length > 0 && bcrypt.compareSync(req.body.pwd, rows[0]['pwd'])) {
                req.session.logged = true;
                req.session.email = req.body.email;
                req.session.company_location_id = rows[0]['company_location_id'];
                req.session.id = rows[0]['id'];

                for (var i=0; i<config.app.admin.length; i++) {
                    console.log(config.app.admin[i] + ' ' + req.session.email);
                    if (config.app.admin[i] == req.session.email) {
                        // synchronous
                        try {
                            adminkey = crypto.randomBytes(9).toString('hex');
                        } catch (ex) {
                            console.log('crypto failed');
                            errorPage(res, null, 'system');
                            connection.end();
                            return;
                        }

                        req.session.admin = adminkey;
                    }
                }
    
                // synchronous
                try {
                    var random = crypto.randomBytes(11).toString('hex');
                } catch (ex) {
                    console.log('crypto failed');
                    errorPage(res, null, 'system');
                    return;
                }
    
                // set or clear persistent cookie
                if (req.body.staysignedin) {
                    var obj = new Object();
    
                    obj.key = 'clID';
                    obj.value = random;
                    obj.user_id = rows[0]['id'];
                    obj.expire_time = Date.now() + 259200000;
    
                    q_addCookie = q_addCookie.replace('X', connection.escape(random));
                    q_addCookie = q_addCookie.replace('X', obj.expire_time);
    
                    // add to db
                    connection.query(q_addCookie, obj, function(err, result) {
                        if (err) {
                            errorPage(res, err, 'query');
                            connection.end();
                            return;
                        }

                        res.cookie('clID', random, { domain: '127.0.0.1', expires: new Date(obj.expire_time), httpOnly: true, signed: true });
                        console.log('cookie successfully added to db');
                    });
                } else {
                    res.clearCookie('clID');
                }

                // redirect based on referrer
                var ref = req.get('referrer');
    
                if (req.session.admin == adminkey)
                    res.redirect('/__admin_/'+adminkey);
                else if (endsWith(ref, 'vmi'))
                    res.redirect('/v/mi');
                else if (endsWith(ref, 'ai'))
                    res.redirect('/a/i');
                else if (endsWith(ref, 'eu'))
                    res.redirect('/e/u');
                else if (endsWith(ref, 'emi'))
                    res.redirect('/e/mi');
                else if (endsWith(ref, 'up'))
                    res.redirect('/u/p');
                else
                    res.redirect('/v/i');
            } else {
                display(res, fail);
            }

            connection.end();
        });
    });
}

function queryCookieAuthenticate(pool, req, res) {
    if (req.session.logged == true && req.session.email) {
        res.send('already logged in as ' + req.session.email);
        return;
    } else if (req.signedCookies.clID) {
        pool.getConnection(function(err, connection) {
            if (err) {
                errorPage(res, err, 'connection pool');
                return;
            }
    
            var query = q_cookieauth;
    
            connection.query(query, [req.signedCookies.clID], function(err, rows, fields) {
                if (err) {
                    errorPage(res, err, 'query');
                    connection.end();
                    return;
                }
    
                if (rows.length) {
                    req.session.logged = true;
                    req.session.email = rows[0]['email']
                    req.session.company_location_id = rows[0]['company_location_id']
                    req.session.id = rows[0]['user_id']
                }

                res.send('cookie: logged in as ' + req.session.email);
                connection.end();
            });
        });
    } else {
        res.sendfile('public/html/login.html');
    }
}

exports.queryAddItem = queryAddItem;
exports.queryVerifyItem = queryVerifyItem;
exports.queryVerifyAddItem = queryVerifyAddItem;
exports.queryAddImage = queryAddImage;
exports.queryVerifyAddImage = queryVerifyAddImage;
exports.queryResendItemVerification = queryResendItemVerification;

exports.queryAddRegistration = queryAddRegistration;
exports.queryVerifyRegistration = queryVerifyRegistration;
exports.queryProcessRegistration = queryProcessRegistration;

exports.queryEditUser = queryEditUser;
exports.queryEditItem = queryEditItem;

exports.queryPreviewItem = queryPreviewItem;
exports.queryViewItem = queryViewItem;
exports.queryViewMyItem = queryViewMyItem;

exports.queryAddPasswordReset = queryAddPasswordReset;
exports.queryVerifyPasswordReset = queryVerifyPasswordReset;
exports.queryProcessPasswordReset = queryProcessPasswordReset;

exports.queryAuthenticate = queryAuthenticate;
exports.queryCookieAuthenticate = queryCookieAuthenticate;
