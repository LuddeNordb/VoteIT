var utils = require("./utils");

function CodeManager() {
    this.codes = [];
    this.bannedCodes = [];
    this.currentSession = -1;
    this.codesGenerated = false;
}

CodeManager.prototype.nextSession = function() {
    if (!this.codesGenerated) {
        throw "No codes generated";
    }

    if (this.codes[this.currentSession + 1]) {
        this.currentSession++;
    } else {
        this.currentSession = -1;
        throw "Out of generated codes";
    }
};

CodeManager.prototype.banCode = function(code) {
    this.bannedCodes.push(code);
};

CodeManager.prototype.generateCodes = function(nbrOfUsers, nbrOfCodesPerUser, lengthOfCodes) {
    this.codesGenerated = true;
    return this.codes = utils.generateCodes(nbrOfUsers, nbrOfCodesPerUser, lengthOfCodes);
};

CodeManager.prototype.currentSessionCodes = function() {
    return this.codes[this.currentSession];
};

CodeManager.prototype.isValidCode = function(code) {
    if (this.bannedCodes.indexOf(code) !== -1) { //Säger nej när vi försöker använda en bannad kod
        return false;
    }
    return this.currentSessionCodes().indexOf(code) !== -1;
};

CodeManager.prototype.invalidateCode = function(code) {
    var previousLength = this.currentSessionCodes().length;
    this.codes[this.currentSession] = this.currentSessionCodes().filter(function(sessionCode) {
        return sessionCode !== code;
    });

    return previousLength - 1 === this.currentSessionCodes().length;
};

module.exports = CodeManager;
