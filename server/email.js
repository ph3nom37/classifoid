var nodemailer = require("nodemailer");
var mOptions = require("./email_types.json");

// create reusable transport method (opens pool of SMTP connections)
var smtpTransport = nodemailer.createTransport("SMTP", {
    service: config.app.mail.service,
    auth: {
        user: config.app.mail.account,
        pass: config.app.mail.pwd
    }
});

function email(type, obj, massEmails) {
    // serialize so there won't be references
    var mOption = JSON.parse(JSON.stringify(mOptions[type]));

    // template these
    if (type == 'item') {
        console.log(obj);
        mOption.to = obj.email;
        mOption.text += new Buffer(obj.email).toString('base64');
        mOption.text += '/';
        mOption.text += obj.id;
        mOption.text += '/';
        mOption.text += obj.key;
    } else if (type == 'reg' || type == 'pwd') {
        mOption.to = obj.email;
        mOption.text += new Buffer(obj.email).toString('base64');
        mOption.text += '/';
        mOption.text += obj.key;
    } else if (type == 'GAE') {
        mOption.to = massEmails;

    } else if (type == 'mreg') {
        // registration - manual intervention required

        console.log('recipient: ' + mOption.to);
        // send email to support@classifoid.com
        mOption.text += obj.email;
    }

    smtpTransport.sendMail(mOption, function(err, response) {
        if (err) {
            console.log(err);
        } else {
            console.log('Message sent: ' + response.message);
        }
    });
}

exports.email = email;

// shut down the connection pool, no more messages
// smtpTransport.close();
