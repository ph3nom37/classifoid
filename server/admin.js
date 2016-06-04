var q_addCompanyLocation = 'insert into company_location set ?';
var q_addUser            = 'insert into user set ?';

function queryAddCompanyLocation(pool, obj, res) {
    pool.getConnection(function(err, connection) {
        if (err) throw err;

        var query = q_addCompanyLocation;

        connection.query(query, obj, function(err, result) {
            if (err) {
                if (err.code == 'ER_DUP_ENTRY') {
                    res.send('Duplicate entry detected');
                } else {
                    throw err;
                }
            } else {
                console.log("inserted id " + result.insertId);
                display(res, result);
            }

            connection.end();
        });
    });
}

function queryAddUser(pool, obj, query, res, display) {
    pool.getConnection(function(err, connection) {
        if (err) throw err;

        var query = q_addUser;

        connection.query(query, obj, function(err, result) {
            if (err) {
                if (err.code == 'ER_DUP_ENTRY') {
                    res.send('Duplicate entry detected');
                } else {
                    throw err;
                }
            } else {
                console.log("inserted id " + result.insertId);
                display(res, result);
            }

            connection.end();
        });
    });
}

module.exports = function(app, pool) {

    // add user
    app.get('/a/u', function(req, res) {
        if (req.session.logged == true && req.session.email != null
            && req.session.admin == adminkey) {
            res.sendfile('public/html/addU.html');
        } else {
            res.send('error page SERVED here');
        }
    });

    app.post('/a/u', function(req, res) {
        if (req.session.logged == true && req.session.email != null
            && req.session.admin == adminkey) {
            var user = new Object();
    
            user.email = req.body.email;
            user.pwd = bcrypt.hashSync(req.body.pwd, 8);
            user.name = req.body.name;
            user.company_location_id = 1;
            user.dept = req.body.dept;
            user.position = req.body.position;
            user.phone = req.body.phone;
            user.active_cnt = 1;
        
            console.log('add user ' + user.pwd);
            q.queryAddUser(pool, user, res, display.general);
        } else {
            res.send('error page SERVED here');
        }
    });
 
    // add company location
    app.get('/a/cl', function(req, res) {
        if (req.session.logged == true && req.session.email != null
            && req.session.admin == adminkey) {
            res.sendfile('public/html/addCL.html');
        } else {
            res.send('error page SERVED here');
        }
    }); 

    app.post('/a/cl', function(req, res) {
        if (req.session.logged == true && req.session.email != null
            && req.session.admin == adminkey) {
            var company = new Object();
    
            company.name = req.body.name;
            company.street = req.body.street;
            company.city = req.body.city;
            company.state = req.body.state;
            company.zip = req.body.zip;
            company.country = 'USA';
    
            q.queryAddCompanyLocation(pool, company, res);
        } else {
            res.send('error page SERVED here');
        }
    });
}
