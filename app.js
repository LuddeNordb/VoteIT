var express = require('express');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var utils = require('./src/utils.js');
var VoteSessionFactory = require('./src/voteSessionFactory');
var VoteManager = require('./src/voteManager');
var CodeManager = require('./src/codeManager');
var VoteCounter = require('./src/voteCounter');
var app = express();

app.set('port', (process.env.PORT || 10000));
app.set('password', (process.env.PASSWORD || "sektmote2023"));
app.set('users', parseInt(process.env.NUM_USERS, 10) || 20);
app.set('codesPerUser', parseInt(process.env.CODES_PER_USER, 10) || 20);


if (!app.get('password')) {
    throw "PASSWORD NOT SET!";
}

var vote = {};
var voteManager = null;
var codeManager = new CodeManager();
var adminToken = null;
var latestResult = {
    votesCount: [],
    winners: [],
    rawVotes: []
};

var numberOfInvalidVotes = 0;
var numberOfAdminLoginTries = 0;

var conf = {
    pass: app.get('password'),
    users: app.get('users'),
    lengthOfCodes: 9,
    nbrOfCodesPerUser: app.get('codesPerUser')
};

// Tell user to use HTTPS
app.use(function(req, res, next) {
    if(req.headers['x-forwarded-proto']!='https') {
        next(); //För testning endast
        //return res.end('Please visit the site with HTTPS');
    } else {
        next();
    }
});

app.use(function(req, res, next) {
    if (numberOfInvalidVotes > 50000 || numberOfAdminLoginTries > 1000) {
        return res.status(429).end('Server down, too many requests');
    } else {
        next();
    }
});

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
app.use(cookieParser());
app.use(express.static('public'));

app.set('views', __dirname + '/public');
app.set('view engine', 'ejs');

app.engine('html', require('ejs').renderFile);

var POSSIBLE_STATES = {
    noVote: "noVote",
    vote: "vote",
    result: "result"
};

function isAuthenticated(req, res) {
    var header = req.header('Authorization');

    if (adminToken === null || header === null || header.substring(6) !== adminToken) {
        numberOfAdminLoginTries++;
        res.status(401).end();
        return false;
    }
    return true;
}

app.locals.POSSIBLE_STATES = POSSIBLE_STATES;
app.locals.CURRENT_STATE = POSSIBLE_STATES.noVote;

app.get('/health-check', function(req, res) {
    res.json({
        codesGenerated: codeManager && codeManager.codesGenerated
    }).end();
});

app.get('/status', function(req, res) {
    switch (app.locals.CURRENT_STATE) {
        case POSSIBLE_STATES.noVote:
            res.json({
                sessionNumber: codeManager.currentSession,
                state: app.locals.CURRENT_STATE,
                codesGenerated: codeManager.codesGenerated
            });
            break;
        case POSSIBLE_STATES.vote:
            res.json({
                sessionNumber: codeManager.currentSession,
                state: app.locals.CURRENT_STATE,
                maximumNbrOfVotes: vote.maximumNbrOfVotes,
                codesGenerated: codeManager.codesGenerated,
                candidates: vote.options.shuffle(),
                vacants: vote.vacantOptions,
                votesReceived: voteManager.getTotalVoteCount(),
                codeLength: conf.lengthOfCodes
            });
            break;
        case POSSIBLE_STATES.result:
            res.json({
                sessionNumber: codeManager.currentSession,
                state: app.locals.CURRENT_STATE,
                codesGenerated: codeManager.codesGenerated,
                winners: vote.winners.shuffle()
            });
    }
    res.end();
});

app.post('/login', function(req, res) {
    if (req.body.pass === conf.pass) {
        adminToken = utils.randomToken(30);
        res
            .set('Authorization', 'token ' + adminToken)
            .end();
    } else {
        numberOfAdminLoginTries++;
        res.status(403).end();
    }
});

app.post('/vote', function(req, res) {
    var voteData = req.body.vote;
    var code = req.body.code;

    try {
        if (app.locals.CURRENT_STATE !== POSSIBLE_STATES.vote) {
            throw 'Voting is closed';
        }

        if (!codeManager.isValidCode(code)) {
            throw 'Invalid code';
        }

        voteManager.castVote(voteData);

        codeManager.invalidateCode(code);
    } catch (e) {
        res.status(400).send('FAIL: ' + e);
        numberOfInvalidVotes++;
    }

    res.end();
});

app.get('/admin/print', function(req, res) {
    if (isAuthenticated(req, res)) {
        var codes = codeManager.generateCodes(conf.users, conf.nbrOfCodesPerUser, conf.lengthOfCodes);

        res.json({
            codes: codes.transpose()
        }).end();
    }
});

app.post('/admin/invcode', function(req, res) {
    if (isAuthenticated(req, res)) {
        var code = req.body.code;

        try {
            codeManager.banCode(code);
        } catch (e) {
            res.status(400).send('FAIL: ' + e);
            numberOfInvalidVotes++;
        }

        res.end();
    }
});

app.post('/createVoteSession', function(req, res) {
    if (isAuthenticated(req, res)) {

        try {
            codeManager.nextSession();
            var candidates = req.body.candidates.map(c => c.trim()).filter(c => c !== '');

            var vacantEnabled = req.body.vacant;
            var maxCandidates = parseInt(req.body.max_candidates, 10);

            latestResult.votesCount = [];
            latestResult.winners = [];
            latestResult.rawVotes = [];

            vote = VoteSessionFactory.createVoteSession(candidates, vacantEnabled, maxCandidates);

            voteManager = new VoteManager(vote.options,
                                          vote.vacantOptions,
                                          vote.maximumNbrOfVotes);


            app.locals.CURRENT_STATE = POSSIBLE_STATES.vote;

        } catch (e) {
            res.status(400).send('FAIL: ' + e);
        }
        res.end();
    }
});

app.post('/admin/complete', function(req, res) {
    if (isAuthenticated(req, res)) {
        var votesCount = voteManager.closeVotingSession();
        vote.winners = VoteCounter.countVotes(votesCount, vote.maximumNbrOfVotes);

        latestResult.votesCount = votesCount;
        latestResult.winners = vote.winners;
        latestResult.rawVotes = voteManager.getRawVotes();

        app.locals.CURRENT_STATE = POSSIBLE_STATES.result;

        res.end();
    }
});

app.get('/admin/result', function(req, res) {
  if (isAuthenticated(req, res)) {
      res.json(latestResult);
      res.end();
  }
})

app.get(['/', '/admin', '/admin/*'], function(req, res) {
    res.render('index.html');
});


var server = app.listen(app.get('port'), function() {
    var host = server.address().address;
    var port = server.address().port;

    console.log('VoteIT listening at http://%s:%s', host, port);
});
