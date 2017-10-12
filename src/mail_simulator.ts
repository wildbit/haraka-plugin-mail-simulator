///<reference types="Haraka"/>

import { join } from 'path';
import  *  as fs from 'fs';

var helpContent = '';


var config:any = {};
var plugin;

//this will be required in once the plugin is loaded.
var DSN;
export function register() {
    plugin = this;
    plugin.load_config();
    DSN =  plugin.core_require('dsn');
};

export function load_config() {
    config = plugin.config.get('mail-simulator.ini', () => plugin.load_config());
    helpContent = fs.readFileSync(join(__dirname, '..', 'help.txt'), 'utf8').replace(/\[\[base_domain]]/g, config.base_domain || 'localhost');
}

var behavior_params_finder = /(!([^!=]+)=([^!=]+))+$/;

export async function hook_capabilities(next, connection: haraka.Connection) {
    connection.capabilities.push('INFORMATION');
    next();
}

export function hook_unrecognized_command(next, connection: haraka.Connection, params: string[]) {
    if (params[0].toUpperCase() == 'INFORMATION') {
        (<any>connection).respond(220, helpContent, () => { next(OK); });
    } else {
        next();
    }
}

export async function hook_rcpt(next, connection: haraka.Connection, recipients: haraka.Address[]) {
    
    try {
        var specializedRecipient = recipients.find(k => behavior_params_finder.test(k.user));
        if (specializedRecipient) {
            var rawCommands = specializedRecipient.user.match(behavior_params_finder)[0].replace(/^(\+?!)|(!$)/g,'');
            var commands = <any>{};
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
                    next(DENYSOFT, dsnResult)
                } else if (base_code >= 500) {
                    var dsnResult = new DSN.create(base_code, commands.reason, ...extended_code);
                    next(DENY, dsnResult);
                } else if(base_code < 400){
                    next(OK);
                } else {
                    next(DENY);
                }
            } else {
                next(OK);
            }
        }
        else if (recipients.find(k => /\+hard-bounce$/i.test(k.user))) {
            next(DENY, "This mailbox does not exist.");
        } else if (recipients.find(k => /\+transient-bounce$/i.test(k.user))) {
            next(DENYSOFT, "Mailbox currently unavailable, please try again later.");
        } else if (recipients.find(k => /\+blackhole$/i.test(k.user)) ||
            //blackhole anything with the domain "blackhole" in it.    
            recipients.find(k => /blackhole/i.test(k.host))) {
            next(OK, "Just so you know, I'll send this message to the void.");
        } else {
            //hard bounce 'em outta here.
            next(DENY);
        }
    } catch (error) {
        connection.loginfo(error.message);
        next(DENY);
    }    
};

export async function hook_queue(next, connection: haraka.Connection) {
    // we're black-holing these messages, so don't do anything, just return ok.
    connection.loginfo(`Black-holing messages from ${connection.transaction.mail_from.original}`);
    next(OK, "Your message has been disappeared!");
}