function homePage(res, param) {
    res.render('index',
        { title: param }
    );
}

function general(res, result) {
    //res.send(JSON.stringify(result));
    res.send(result);
}

function editItem(res, result) {
    console.log('displayEditItem called');
    result = result + '<br>Links to edit item will be included';
    res.send(result);
}

function adminPage(res, param) {
    res.render('admin',
        { title: param }
    );
}

function errorPage(res, errObj, param) {
    switch(param) {
        case 'connection':
            break;
        case 'query':
            // addItem and addUser need this check
            if (errObj.code == 'ER_DUP_ENTRY') {
                res.send('not allowed. duplicate entry detected');
            } else {
                res.render('error',
                    { type: param,
                      msg: errObj }
                );
            }
            break;
        case 's3':
            break;
        case 'system':
            break;
        default:
    }

}


exports.homePage = homePage;
exports.general = general;
exports.editItem = editItem;
exports.adminPage = adminPage;
exports.errorPage = errorPage;
