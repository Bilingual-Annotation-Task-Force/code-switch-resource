//Basic setup
var express = require('express');
var router = express.Router();

//View engine for dynamic compiling
var jade = require('jade');
var path = require("path");
var fs = require('fs');

//TODO find r-script library for use, or use child-process to spawn R-threads

//For file uploads
var multer  = require('multer');
var upload = multer({ dest: 'uploads/' });

//Database info
var userdbname = 'userlist';
var corporadbname = 'corporalist';

//Cookie names
var sessioncookie = 'logintoken';

//Generated templates
var searchFn = false;
var sidebarFn = false;
generateFn();
function generateFn() {
    console.log("Generating client-side jade javascript functions.");
    var templatePath = path.normalize(path.join(__dirname.substr(0, __dirname.lastIndexOf(path.sep)), 'views', 'app-search-entry.jade'));
    fs.readFile(templatePath, "ASCII", function (err, data) {
        console.log("Generating client-side search entry templates.");
        if (err !== null) console.log("Error from file read:", err);
        else searchFn = jade.compileClient(data, null);
    });
    templatePath = path.normalize(path.join(__dirname.substr(0, __dirname.lastIndexOf(path.sep)), 'views', 'sidebar-entry.jade'));
    fs.readFile(templatePath, "ASCII", function (err, data) {
        console.log("Generating client-side sidebar entry templates.");
        if (err !== null) console.log("Error from file read:", err);
        else sidebarFn = jade.compileClient(data, null);
    });
}

/* Home page */
//GET home page
router.get('/', function(req, res, next) {
    res.render('index', { title: 'BATs Force Analysis Tools' });
});

/* Web app screens */
//GET client/search, search screen of the thing
router.get('/client/search', function(req, res, next) {
    res.render('app-search', {title: "Search", page_data: "Search", entryTemplate: searchFn, sidebarEntryTemplate: sidebarFn});
});
//GET client/analyze, result screen
router.get('/client/analyze', function(req, res, next) {
    res.render('app-analyze', {title: "Analyze", page_data: "Analyze", sidebarEntryTemplate: sidebarFn});
});
//GET client/my-corpora, list of owned corpora
router.get('/client/my-corpora', function(req, res, next) {
    res.render('app-my-corpora', {title: "My Corpora", page_data: "My Corpora", sidebarEntryTemplate: sidebarFn});
});
//GET client/my-profile, profile of self
router.get('/client/my-profile', function(req, res, next) {
    res.render('app-profile', {title: "My Profile", page_data: "My Profile", sidebarEntryTemplate: sidebarFn});
});
//GET profile and corpora data, no webpage reload, AJAX queries
router.get('/client/profile/', function(req, res, next) {
    //Do nothing
    res.send("");
});
router.get('/client/corpus/simple/', function (req, res, next) {
    //Do nothing
    res.send("");
});
router.get('/client/corpora/simple/', function (req, res, next) {
    res.send("");
});
router.get('/client/profile/:profileId', function(req, res, next) {
    //TODO Login with cookies
    console.log(req.cookies);
    console.log("Login token:", req.cookies[sessioncookie]);
    console.log("Profile id:", req.params.profileId);
    if (req.params.profileId === req.cookies[sessioncookie]) {
        res.redirect('/client/my-profile');
    } else {
        console.log("Querying profile ", req.params.profileId);
        req.db.collection(userdbname).find({"_id": req.params.profileId}, {}, function (e, docs) {
            console.log(e);
            console.log(docs);
            if (docs.length !== 1) {
                res.redirect(404, '/');
            } else {
                res.render('app-profile', {title: "My Profile", page_data: "No profile", profile: docs[0], sidebarEntryTemplate: sidebarFn});
            }
        });
    }
});
router.get('/client/corpus/simple/:corpusId', function (req, res, next) {
    req.db.collection(corporadbname).find({"_id": req.params.corpusId}, {}, function (e, docs) {
        console.log(e);
        console.log(docs);
        if (docs === undefined || docs === null || docs.size === 0) {
            res.send('{}');
        } else {
            res.send(docs[0]);
        }
    });
});
router.get('/client/corpora/simple/:corpusIdList', function (req, res, next) {
    req.db.collection(corporadbname).find({_id: { $in: req.params.corpusIdList.split(',') }}, {}, function (e, docs) {
        console.log(docs);
        res.send(docs);
    });
});


/* Login and account creation */
//GET landing
router.get('/landing', function(req, res, next) {
    res.redirect('/client/search');
});
//GET login
router.get('/login', function(req, res, next) {
    console.log(req.cookies);
    if (req.cookies[sessioncookie] !== null && req.cookies[sessioncookie] !== undefined) {
        req.db.collection(userdbname).find({_id : req.cookies[sessioncookie]}, {}, function(e, docs) {
            if (docs.length === 1) {
                res.redirect('/landing');
            } else {
                res.clearCookie(sessioncookie);
                res.render('login', {title: 'Login'});
            }
        });
    } else {
        res.render('login', {title: 'Login'});
    }
});
//GET signup
router.get('/signup', function(req, res, next) {
    if (req.cookies[sessioncookie] !== null && req.cookies[sessioncookie] !== undefined) {
        req.db.collection(userdbname).find({_id : req.cookies[sessioncookie]}, {}, function(e, docs) {
            if (docs.length === 1) {
                res.redirect('/landing');
            } else {
                res.clearCookie(sessioncookie);
                res.render('signup', {title: 'Signup'});
            }
        });
    } else {
        res.render('signup', {title: 'Signup'});
    }
});
//GET logout
router.get('/logout', function (req, res, next) {
    logout(res);
    res.redirect('/');
});
//POST login
router.post('/login-check', function(req, res, next) {
    console.log("Attempting login with credentials:", req.body);
    var users = req.db.collection(userdbname);
    users.find({"username" : req.body.username}, {}, function(e, docs) {
        console.log("User db accessed.");
        console.log("Database access error: ", e);
        console.log("Accessed records: ", docs);
        if (docs.length === 1 && login(docs[0], req.body.password, res)) {
            res.redirect('/landing');
        } else {
            res.redirect('/login-failed');
        }
    });
});
//POST signup
router.post('/signup-check', function(req, res, next) {
    console.log(req.body);
    signup(req.body, req.db, res);
});
//GET failed login
router.get('/login-failed', function(req, res, next) {
    res.redirect('/login');
});
//GET failed login
router.get('/signup-failed', function(req, res, next) {
    res.redirect('/signup');
});

/* Login and sign up account methods */
function signup(entrydata, db, response) {
    //TODO Find a way to shrink the 2 db queries into a single or query
    var users = db.collection(userdbname);
    console.log("Searching database for duplicates.");
    users.find({ $or : [{"username" : entrydata.username}, {"email" : entrydata.email}]}, {}, function(e, docs) {
        console.log("Errors: ", e);
        console.log("Entries found during signup: ", docs);
        if (docs.length === 0) {
            console.log("Putting record ", entrydata);
            users.insert(entrydata, null, function () {
                console.log("Completed.");
            });

            login(entrydata, undefined, response);
            response.redirect('/landing');
        } else {
            response.cookie('failed', JSON.stringify(docs), {});
            //TODO add failed var to cookie
            logout(response);
            response.redirect('/signup-failed');
        }
    });
}
function login(docs, password, response) { //Account, Entered password
    console.log("Attempting to log into account", docs, " with password \"" + password + "\".");
    if (docs === null || docs === undefined) {
        console.log("Login failed, there was no account.");
        response.cookie('failed', "noaccount", {});
        return false;
    }
    if (!(password === undefined || password === null)) { //Password should only be null when entering from signup route
        //Password check
        console.log("Checking password.");
        response.clearCookie('failed');
        if (!checkPass(docs['password'], password)) {
            console.log("Login failed, password did not align.");
            response.cookie('failed', "wrongpass", {});
            return false;
        }
    }
    //No return, so login
    console.log("Credentials verified. Logging out of old accounts (should be impossible) and logging in.");
    logout(response);
    response.cookie(sessioncookie, docs._id, {path : '/'});
    return true;
}
function checkPass(password, entered) {
    //TODO hashing
    return password === entered;
}
function logout(response) {
    console.log("Clearing cookies.");
    response.clearCookie(sessioncookie);
    response.clearCookie('failed');
    response.clearCookie('stored');
    console.log("Cookies cleared, now logged out.");
}

router.get('/client/analyse/simple/:corpusId/:rscript', function(req, res, next){
    //TODO run r-scripts on the input data when analysis requested
});

//Searching
router.get('/client/search/search-corpora', function(req, res, next){
    //TODO improve searches
    var query = {};
    if (req.query.main_input) {
        query.name = req.query.main_input;
    } else {
        query = {};
    }
    req.db.collection(corporadbname).find(query, {} , function (e, docs) {
        res.send(JSON.stringify(docs));
    });
});

//TODO file uploads
router.post('/my-corpora/upload', upload.single('corpus'), function (req, res, next) {
    //TODO log multer data to db, save as a corpus with the provided form dat (check form data)
});


//TODO form routes


//Testing database
router.get('/accounts', function(request, response) {
    var dbusers = request.db.collection(userdbname);
    dbusers.find(request.query, {}, function (e, docs) { //docs: document data, e: last entry...?
        console.log("Database error: ", e);
        console.log("Located records: ", docs);
        response.send("<pre>" + JSON.stringify({"get":request.query, "post":request.body, "db" : docs}, null, 4) + "</pre>");
    });
});

module.exports = router;
