//region Imports

//Basic setup
const express = require('express');
const router = express.Router();

//View engine for dynamic compiling
const jade = require('pug');

//Path and fs for launching systems
const path = require("path");
const fs = require('fs');

//Spawn additional threads for heavy number crunching
const childProcess = require('child_process');
const cmd = require('node-cmd');

//For file uploads -- Node does the IO issue well
const multer = require('multer');

//endregion

//region Database constants

//Database names
const userdbname = 'userlist';
const corporadbname = 'corporalist';
//Cookie names
const sessioncookie = 'logintoken';

//endregion

//region Template functions

//Generated templates
let searchFn = false;
let sidebarFn = false;
let profileOwnedFn = false;
let profileSubscribedFn = false;
//TODO refactor out the repeated code
function genTemplates() {
    console.log("Generating client-side jade javascript functions.");
    let templatePath = path.normalize(path.join(__dirname.substr(0, __dirname.lastIndexOf(path.sep)), 'views', 'app-search-entry.pug'));
    fs.readFile(templatePath, "ASCII", function (err, data) {
        console.log("Generating client-side search entry templates.");
        if (err !== null) console.log("Error from file read:", err);
        else searchFn = jade.compileClient(data, null);
    });
    templatePath = path.normalize(path.join(__dirname.substr(0, __dirname.lastIndexOf(path.sep)), 'views', 'app-sidebar-entry.pug'));
    fs.readFile(templatePath, "ASCII", function (err, data) {
        console.log("Generating client-side sidebar entry templates.");
        if (err !== null) console.log("Error from file read:", err);
        else sidebarFn = jade.compileClient(data, null);
    });
    templatePath = path.normalize(path.join(__dirname.substr(0, __dirname.lastIndexOf(path.sep)), 'views', 'app-profile-owned-entry.pug'));
    fs.readFile(templatePath, "ASCII", function (err, data) {
        console.log("Generating client-side sidebar entry templates.");
        if (err !== null) console.log("Error from file read:", err);
        else profileOwnedFn = jade.compileClient(data, null);
    });
    templatePath = path.normalize(path.join(__dirname.substr(0, __dirname.lastIndexOf(path.sep)), 'views', 'app-profile-subscribed-entry.pug'));
    fs.readFile(templatePath, "ASCII", function (err, data) {
        console.log("Generating client-side sidebar entry templates.");
        if (err !== null) console.log("Error from file read:", err);
        else profileSubscribedFn = jade.compileClient(data, null);
    });
}
genTemplates();

//endregion

//region Login and sign up account methods

function signup(db, enteredAccount, response) {
    const users = db.collection(userdbname);
    console.log("Searching database for accounts with this email or username.");
    users.find({ $or : [{"username" : enteredAccount.username}, {"email" : enteredAccount.email}]}, {}, function(e, docs) {
        console.log("Sign up query completed.\n\tErrors: ", e,
            "\n\tEntries found during signup: \n\t" + ((JSON.stringify(docs, undefined, "\t")).replace(/\n/g, "\n\t")));
        if (docs.length === 0) {
            console.log("Putting record", enteredAccount, "into user database.");
            users.insert(enteredAccount, null, function () {
                console.log("Completed user insertion.");
            });
            //force login
            console.log("Force login for new account.");
            login(enteredAccount, undefined, response, true);
            response.redirect('/landing');
        } else {
            console.log("Submitted record is a duplicate.");
            logout(response);
            console.log("Redirecting to the signup page.");
            response.redirect('/signup?r=d');
        }
    });
}
function login(acct, pass, res, force) {
    console.log("Attempting to log into account", acct, "with password \"" + pass + "\".");
    if (acct === null || acct === undefined) {
        console.log("Login failed, no account found.");
        res.redirect('/login?r=u');
    }
    if (!force) { //Forced only from successful sign up
        //Password check
        console.log("Checking password.");
        res.clearCookie('failed');
        if (!checkPass(acct.password, pass)) {
            console.log("Login failed, password did not align.");
            res.redirect('/login?r=p');
        }
    }
    //No return, so login
    console.log("Credentials verified. Logging out of old account and logging in.");
    logout(res);
    res.cookie(sessioncookie, acct._id, {path : '/'});
    res.redirect('/landing');
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
function checkIfLoggedIn(request, successCallback, failCallback) {
    console.log("Assessing account state.");
    if (request.cookies[sessioncookie] === undefined || request.cookies[sessioncookie] === null) {
        console.log("Account is not logged in.", "No token passed with request");
        callback();
    } else {
        findAccount(request.db, {_id: request.cookies[sessioncookie]}, function (docs) {
            if (docs.length === 1) {
                console.log("Account is logged in.");
                if (successCallback !== undefined || successCallback !== null) {
                    successCallback();
                }
            } else {
                console.log("Attempt to access account failed.",
                    docs.length === 0 ? "No account found." : "Multiple accounts found.");
                logout();
                if (failCallback !== undefined || failCallback !== null) {
                    failCallback();
                }
            }
        });
    }
}
function findAccount(db, query, callback) {
    db.collection(userdbname).find(query, {}, function (e, docs) {
        console.log("Account search query completed.\n\tErrors: ", e,
            "\n\tEntries found during signup: \n\t" + ((JSON.stringify(docs, undefined, "\t")).replace(/\n/g, "\n\t")));
        if (e === undefined || e === null) {
            callback(docs);
        }
    })
}

//endregion

//region Testing routes

//Testing database
router.get('/accounts', function(request, response) {
    const dbusers = request.db.collection(userdbname);
    dbusers.find(request.query, {}, function (e, docs) { //docs: document data, e: last entry...?
        console.log("Database error: ", e);
        console.log("Located records: ", docs);
        response.send("<pre>" + JSON.stringify({"get":request.query, "post":request.body, "db" : docs}, null, 4) + "</pre>");
    });
});

//endregion

//region Routes
//region Home

router.get('/', function(req, res, next){
    res.render('index', { title: 'BATs Force Analysis Tools' });
});

//endregion

//region Signing up and logging into the website

//TODO utilize AJAX here
router.get('/signup', function (req, res) {
    if (req.cookies[sessioncookie] !== null && req.cookies[sessioncookie] !== undefined) {
        console.log("User already has a token.");
        //Redirect to landing if already logged in
        checkIfLoggedIn(req, function() {
            console.log("User is already logged in! Ignore the query.");
            res.redirect('/landing');
        }, function() {
            console.log("User provided token is faulty. Remove it.");
            logout(res);
            res.render('signup', {title: 'Sign Up', failed: false});
        });
    } else {
        //Consider failed signups and such details
        if (req.query !== undefined && req.query !== null && req.query.r !== undefined) {
            console.log("Failed sign up due to", "'" + req.query.r + "'", "error.");
            //TODO convert to AJAX
            res.render('signup', {title: 'Sign Up', failed: true});
        } else {
            res.render('signup', {title: 'Sign Up', failed: false});
        }
    }
});
router.post('/signup', function(req, res){
    console.log("Submitted details for new account:", req.body);
    signup(req.db, req.body, res);
});
router.get('/login', function(req, res){
    if (req.cookies[sessioncookie] !== null && req.cookies[sessioncookie] !== undefined) {
        console.log("User already has a token.");
        //Redirect to landing if already logged in
        checkIfLoggedIn(req, function() {
            console.log("User is already logged in! Ignore the query.");
            res.redirect('/landing');
        }, function() {
            console.log("User provided token is faulty. Remove it.");
            logout(res);
            res.render('login', {title: 'Login', failed: false});
        });
    } else {
        //Consider failed signups and such details
        if (req.query !== undefined && req.query !== null && req.query.r !== undefined) {
            console.log("Failed login due to", "'" + req.query.r + "'", "error.");
            //TODO convert to AJAX
            res.render('login', {title: 'Login', failed: true});
        } else {
            res.render('login', {title: 'Login', failed: false});
        }
    }
});
router.post('/login', function(req, res){
    console.log("Attempting login with credentials:", req.body);
    findAccount(req.db, {username : req.body.username}, function (docs) {
        if (docs.length === 1) {
            login(docs[0], req.body.password, res, false);
        } else {
            res.redirect('/login');
        }
    });
});
router.get('/landing', function(req, res){
    if (req.cookies[sessioncookie] !== null && req.cookies[sessioncookie] !== undefined) {
        req.db.collection(userdbname).find({_id : req.cookies[sessioncookie]}, {}, function(e, docs) {
            if (docs.length === 1) {
                res.redirect('/client/search');
            } else {
                res.clearCookie(sessioncookie);
                res.render('login', {title: 'Login'});
            }
        });
    } else {
        res.render('login', {title: 'Login'});
    }
});
router.get('/logout', function(req, res){
    logout(res);
    res.redirect('/');
});

//endregion

//region Client paths
//region Client login check

router.use('/client', function (req, res, next) {
    console.log("Currently within client. Checking login.");
    checkIfLoggedIn(req, next);
});

//endregion
//region Corpora search

router.get('/client/search', function(req, res){
    res.render('app-search', {title: "Search", page_data: "Search", entryTemplate: searchFn, sidebarEntryTemplate: sidebarFn});
});
router.get('/client/search/corpora', function(req, res){
    //TODO improve searches
    let query = {};
    if (req.query.main_input !== undefined && req.query.main_input !== null) {
        query.name = req.query.main_input;
    } else {
        query = {};
    }
    req.db.collection(corporadbname).find(query, {} , function (e, docs) {
        res.send(JSON.stringify(docs));
    });
});

//endregion
//region Corpora analysis

router.get('/client/analyze', function(req, res, next){
    res.render('app-analyze', {title: "Analyze", page_data: "Analyze", sidebarEntryTemplate: sidebarFn});
});
router.get('/client/analyze/:corpusId/:rScriptId/simple/', function(req, res, next){
    //TODO Run python to wrap the R script -- text processing is simpler
    //TODO run R scripts on the input data when analysis requested
    //TODO glean results when script finishes running
});
/*router.get('/client/testcmd', (req, res, next) => {
    const ls = childProcess.spawn('ls', ['./', '-lh']);
    ls.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
    });
    ls.stderr.on('data', (data) => {
        console.log(`stderr: ${data}`);
    });
    ls.on('close', (code) => {
        console.log(`child process exited with code ${code}`);
    });
    ls.on('error', (err) => {
        console.log(`Failed to start child process, ${err}.`);
    });
    const pyProcess = cmd.get('C:\\Users\\benbe\\AppData\\Local\\Programs\\Python\\Python35-32\\pythonw.exe' +
        ' C:\\Users\\benbe\\Documents\\code-switch-resource\\route-generator.py',
        function (data, err, stderr) {
            if (!err) {
                console.log("data from python script " + data)
            } else {
                console.log("python script cmd error: " + err)
            }
        }
    );
    res.end("Yah, k");
});*/

//endregion
//region Owned and subscribed corpora

router.get('/client/my-corpora', function(req, res){
    res.render('app-my-corpora', {title: "My Corpora", page_data: "My Corpora", sidebarEntryTemplate: sidebarFn});
});
router.post('/client/my-corpora/upload', multer({dest: './uploads'}).single('corpus_data'), function(req, res){
    console.log(req.body); //form fields
    console.log(req.file); //form files
    if (req.file !== undefined && req.file !== null) {
        var corpus = {
            //TODO parse data
            owner: req.cookies[sessioncookie],
            filename: req.file.filename
        };
        console.log(corpus);
        req.db.collection(corporadbname).insert(corpus, null, function () {
            console.log(corpus, "inserted.");
            req.db.collection(corporadbname).find({filename: req.file.filename}, {}, function (e, docs) {
                console.log("Corpus found.\n\tErrors: ", e,
                    "\n\tFound corpora: \n\t" + JSON.stringify(docs, undefined, "\t").replace(/\n/g, "\n\t"));
                req.db.collection(userdbname).update({_id: req.cookies[sessioncookie]}, {$addToSet: {owned: docs[0]['_id']}}, function (e, docs) {
                    console.log("User updated for ownership.");
                });
            });
        });

        //TODO spawn a process to run all the scripts on the file
    }
    //Terminate wait
    res.status(204).end();
});

//endregion
//region User profile -- static page for profile

router.get('/client/my-profile', function(req, res){
    req.db.collection(userdbname).find({_id: req.cookies[sessioncookie]}, {}, function (e, docs) {
        console.log("Account query completed.\n\tErrors: ", e,
            "\n\tEntries found during page view: \n\t" + ((JSON.stringify(docs, undefined, "\t")).replace(/\n/g, "\n\t")));
        res.render('app-profile', {title: "My Profile", page_data: "My Profile",
            account: docs[0],
            sidebarEntryTemplate: sidebarFn,
            profileSubscribedEntryTemplate: profileSubscribedFn,
            profileOwnedEntryTemplate: profileOwnedFn,
            profile: docs[0]});
    });
});
router.post('/client/my-profile', function(req, res){
    req.db.collection(userdbname).updateOne({_id: req.cookies[sessioncookie]}, {$set: req.body}, function (e) {
        if (e === undefined || e === null) {
            console.log("Record updated.");
            res.status(204).end();
        } else {
            console.log(e);
        }
    })
});
router.get('/client/my-profile/corpora/owned/simple', function (req, res) {
    req.db.collection(userdbname).find({_id: req.cookies[sessioncookie]}, {}, function (e, docs) {
        console.log("Account query completed.\n\tErrors: ", e,
            "\n\tEntries found during request for owned: \n\t" + ((JSON.stringify(docs, undefined, "\t")).replace(/\n/g, "\n\t")));
        if (docs[0].owned !== null && docs[0].owned !== undefined) {
            req.db.collection(corporadbname).find({_id : {$in : docs[0].owned}}, {}, function (e, docs) {
                console.log("Subscribed corpora query completed.\n\tErrors: ", e,
                    "\n\tEntries found during upload search: \n\t" + ((JSON.stringify(docs, undefined, "\t")).replace(/\n/g, "\n\t")));
                if (docs !== undefined && docs !== null) {
                    res.send(JSON.stringify(docs));
                } else {
                    res.send("");
                }
            });
        }
    });
});
router.get('/client/my-profile/corpora/subscribed/simple', function (req, res) {
    req.db.collection(userdbname).find({_id: req.cookies[sessioncookie]}, {}, function (e, docs) {
        console.log("Account query completed.\n\tErrors: ", e,
            "\n\tEntries found during signup: \n\t" + ((JSON.stringify(docs, undefined, "\t")).replace(/\n/g, "\n\t")));
        if (docs[0].subscribed !== null && docs[0].subscribed !== undefined) {
            req.db.collection(corporadbname).find({_id : {$in : docs[0].subscribed}}, {}, function (e, docs) {
                console.log("Subscribed corpora query completed.\n\tErrors: ", e,
                    "\n\tEntries found during subscription search: \n\t" + ((JSON.stringify(docs, undefined, "\t")).replace(/\n/g, "\n\t")));
                if (docs !== undefined && docs !== null) {
                    res.send(JSON.stringify(docs));
                } else {
                    res.send("");
                }
            });
        } else {
            res.send("");
        }
    });
});

//endregion
//region Profile access

router.get('/client/profile', function(req, res){
    //Do nothing
    res.send("");
});
router.get('/client/profile/:profileId', function(req, res){
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
                res.render('app-profile', {title: "Profile", page_data: "No profile", profile: docs[0],
                    sidebarEntryTemplate: sidebarFn,
                    profileSubscribedEntryTemplate: profileSubscribedFn,
                    profileOwnedEntryTemplate: profileOwnedFn
                });
            }
        });
    }
});
router.get('/client/profile/simple/:profileId', function(req, res, next){
    req.db.collection(userdbname).find({"_id": req.params.profileId}, {}, function (e, docs) {
        if (docs.length !== 1) {
            res.redirect(404, '/');
        } else {
            res.send(JSON.stringify(docs[0]));
        }
    });
});

//endregion
//region Corpora access

//Corpus
router.get('/client/corpus/simple', function(req, res){
    //Do nothing
    res.send("");
});
router.get('/client/corpus/:corpusId', function(req, res){
    req.db.collection(corporadbname).find(req.params.corpusId, {}, function (e, docs) {
        console.log("Corpus query completed.\n\tErrors: ", e,
            "\n\tEntries found during corpus search: \n\t" + ((JSON.stringify(docs, undefined, "\t")).replace(/\n/g, "\n\t")));
        //TODO render
        res.send("");
    });
});
router.get('/client/corpus/simple/:corpusId', function(req, res){
    req.db.collection(corporadbname).find(req.params.corpusId, {}, function (e, docs) {
        console.log("Corpus query (simple) completed.\n\tErrors: ", e,
            "\n\tEntries found during corpus search: \n\t" + ((JSON.stringify(docs, undefined, "\t")).replace(/\n/g, "\n\t")));
        res.send(docs);
    });
});
//Copora
router.get('/client/corpora/simple/:corpusIdList', function(req, res){
    req.db.collection(corporadbname).find({_id: { $in: req.params.corpusIdList.split(',') }}, {}, function (e, docs) {
        console.log("Corpora query (simple) completed.\n\tErrors: ", e,
            "\n\tEntries found during corpora list search: \n\t" + ((JSON.stringify(docs, undefined, "\t")).replace(/\n/g, "\n\t")));
        res.send(docs);
    });
});

//endregion
//region Subscription

router.put('/client/subscribe/:corpusId', function (req, res) {
    req.db.collection(userdbname).update({_id: req.cookies[sessioncookie]}, {$addToSet: {subscribed: req.params.corpusId}}, function (e, docs) {
        console.log("Subscription addition completed.\n\tErrors: ", e,
            "\n\tEntries found during subscription search: \n\t" + ((JSON.stringify(docs, undefined, "\t")).replace(/\n/g, "\n\t")));
    });
    req.db.collection(corporadbname).update({_id: req.params.corpusId}, {$addToSet: {subscribed: req.cookies[sessioncookie]}}, function (e, docs) {
        console.log("Subscription addition completed.\n\tErrors: ", e,
            "\n\tEntries found during subscription search: \n\t" + ((JSON.stringify(docs, undefined, "\t")).replace(/\n/g, "\n\t")));
    });
    res.status(204).end();
});
router.delete('/client/subscribe/:corpusId', function(req, res){
    console.log("Removing", req.params.corpusId, "from account", req.cookies[sessioncookie]);

    req.db.collection(userdbname).update({_id: req.cookies[sessioncookie]}, {$pull: {subscribed: req.params.corpusId}}, function (e, docs) {
        console.log("Subscription removal completed.\n\tErrors: ", e,
            "\n\tEntries found during subscription search: \n\t" + ((JSON.stringify(docs, undefined, "\t")).replace(/\n/g, "\n\t")));
    });
    req.db.collection(corporadbname).update({_id: req.params.corpusId}, {$pull: {subscribed: req.cookies[sessioncookie]}}, function (e, docs) {
        console.log("Subscription removal completed.\n\tErrors: ", e,
            "\n\tEntries found during subscription search: \n\t" + ((JSON.stringify(docs, undefined, "\t")).replace(/\n/g, "\n\t")));
    });
    res.status(204).end();
});

//endregion
//endregion
//endregion

module.exports = router;
