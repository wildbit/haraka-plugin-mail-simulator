## Mail Simulator

### What is it?
Mail Simulator allows you to configure a haraka instance in a way
that allows you to script specific SMTP-level responses, such as:

- transient bounces
- hard bounces
- ESMTP response codes
- "null routing" of email (a mail sink for testing).

These behaviors can be scripted via email address arguments so that you can use any mail client to test them.

### Installation

Install the plugin (not currently on npm.org)

```
$ npm install https://github.com/wildbit/haraka-plugin-mail-simulator
```

Add the plugin to your haraka config `plugins` file:

```
mail-simulator
```

[Optional] Create a `mail-simulator.ini` file, and add your server's FQDN to it:

```
base_domain=testing.example.com
```

Run your haraka instance. Connect and issue the "INFORMATION" command to see what mail-simulator can do:

```
telnet localhost 25
EHLO asdf
INFORMATION
QUIT
```
