"use strict";
///<reference types="Haraka"/>
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const fs = require("fs");
var helpContent = '';
var config = {};
var plugin;
//this will be required in once the plugin is loaded.
var DSN;
function register() {
    plugin = this;
    plugin.load_config();
    DSN = plugin.core_require('dsn');
}
exports.register = register;
;
function load_config() {
    config = plugin.config.get('mail-simulator.ini', () => plugin.load_config());
    helpContent = fs.readFileSync(path_1.join(__dirname, '..', 'help.txt'), 'utf8').replace(/\[\[base_domain]]/g, config.base_domain || 'localhost');
}
exports.load_config = load_config;
var behavior_params_finder = /(!([^!=]+)=([^!=]+))+$/;
function hook_capabilities(next, connection) {
    return __awaiter(this, void 0, void 0, function* () {
        connection.capabilities.push('INFORMATION');
        next();
    });
}
exports.hook_capabilities = hook_capabilities;
function hook_unrecognized_command(next, connection, params) {
    if (params[0].toUpperCase() == 'INFORMATION') {
        connection.respond(220, helpContent, () => { next(OK); });
    }
    else {
        next();
    }
}
exports.hook_unrecognized_command = hook_unrecognized_command;
function hook_rcpt(next, connection, recipients) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            var specializedRecipient = recipients.find(k => behavior_params_finder.test(k.user));
            if (specializedRecipient) {
                var rawCommands = specializedRecipient.user.match(behavior_params_finder)[0].replace(/^(\+?!)|(!$)/g, '');
                var commands = {};
                rawCommands.split('!').forEach(l => {
                    var kv = l.split('=');
                    commands[kv[0]] = kv[1];
                });
                var until_date = parseInt(commands.bounce_until || '0') * 1000;
                var until_expired = false;
                if (until_date > 0) {
                    var ud = new Date(until_date);
                    var execdate = new Date();
                    until_expired = ud < execdate;
                    connection.logcrit(`Bounce until: ${ud}, current: ${execdate}, ${until_expired}`);
                }
                if (until_expired) {
                    next(OK);
                }
                else if (commands.base_code || commands.extended_code) {
                    var extended_code = (commands.extended_code || "4.0.0").split('.');
                    var top = extended_code.shift();
                    var base_code = parseInt(top) * 100 + 50;
                    if (commands.base_code) {
                        base_code = parseInt(commands.base_code);
                    }
                    if (base_code >= 400 && base_code <= 499) {
                        var dsnResult = new DSN.create(base_code, commands.reason, ...extended_code);
                        next(DENYSOFT, dsnResult);
                    }
                    else if (base_code >= 500) {
                        var dsnResult = new DSN.create(base_code, commands.reason, ...extended_code);
                        next(DENY, dsnResult);
                    }
                    else if (base_code < 400) {
                        next(OK);
                    }
                    else {
                        next(DENY);
                    }
                }
                else {
                    next(OK);
                }
            }
            else if (recipients.find(k => /\+hard-bounce$/i.test(k.user))) {
                next(DENY, "This mailbox does not exist.");
            }
            else if (recipients.find(k => /\+transient-bounce$/i.test(k.user))) {
                next(DENYSOFT, "Mailbox currently unavailable, please try again later.");
            }
            else if (recipients.find(k => /\+blackhole$/i.test(k.user)) ||
                //blackhole anything with the domain "blackhole" in it.    
                recipients.find(k => /blackhole/i.test(k.host))) {
                next(OK, "Just so you know, I'll send this message to the void.");
            }
            else {
                //hard bounce 'em outta here.
                next(DENY);
            }
        }
        catch (error) {
            connection.loginfo(error.message);
            next(DENY);
        }
    });
}
exports.hook_rcpt = hook_rcpt;
;
function hook_queue(next, connection) {
    return __awaiter(this, void 0, void 0, function* () {
        // we're black-holing these messages, so don't do anything, just return ok.
        connection.loginfo(`Black-holing messages from ${connection.transaction.mail_from.original}`);
        next(OK, "Your message has been disappeared!");
    });
}
exports.hook_queue = hook_queue;
//# sourceMappingURL=mail_simulator.js.map