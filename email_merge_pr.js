const PR_NUMBER = process.env.GITHUB_PR_NUMBER,
    API_TOKEN = process.env.API_TOKEN,
    user_agent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1',
    PR_API_LINK = "https://api.github.com/repos/jakubkrajcovic/Managing-with-Digital-Technology/pulls/" + PR_NUMBER + '/commits?access_token=' + API_TOKEN,
    PR_LINK = "https://github.com/jakubkrajcovic/Managing-with-Digital-Technology/pull/" + PR_NUMBER,
    COMMITS_URL = 'https://api.github.com/repos/jakubkrajcovic/Managing-with-Digital-Technology/pulls/' + PR_NUMBER + '/commits?access_token=' + API_TOKEN,
    MERGE_URL = 'https://api.github.com/repos/jakubkrajcovic/Managing-with-Digital-Technology/pulls/' + PR_NUMBER + '/merge?access_token=' + API_TOKEN,
    request = require('request'),
    aws = require('aws-sdk'),
    fs = require("fs"),
    datetime = require('node-datetime'),
    shell = require('shelljs'),
    commit_email_options = {
        url: COMMITS_URL,
        method: 'GET',
        headers: {
            'User-Agent': user_agent
        }
    },
    pr_options = {
        url: PR_API_LINK,
        method: 'GET',
        headers: {
            'User-Agent': user_agent
        }
    },
    merge_pr_options = {
        url: MERGE_URL,
        method: 'PUT',
        headers: {
            'User-Agent': user_agent
        }
    };

request(commit_email_options, function (error, response, body) {
    if (!error && response.statusCode == 200) {
        const info = JSON.parse(body),
            fromEmail = process.env.FROM_EMAIL,
            email = info[0].commit.author.email;
        aws.config.loadFromPath(__dirname + '/../aws-credentials.json');
        var ses = new aws.SES();
        var ses_mail = "From: 'Managing with digital technology' <" + fromEmail + ">\n";
        ses_mail = ses_mail + "To: " + email + "\n";
        ses_mail = ses_mail + "Subject: " + (process.env.MERGE_PR ? "PR accepted  \n" : "Issues found in pull request  \n");
        ses_mail = ses_mail + "MIME-Version: 1.0\n";
        ses_mail = ses_mail + "Content-Type: multipart/mixed; boundary=\"NextPart\"\n\n";
        ses_mail = ses_mail + "--NextPart\n";
        ses_mail = ses_mail + "Content-Type: text/html; charset=us-ascii\n\n";
        ses_mail = ses_mail + "PR Link:  " + PR_LINK + "\n\n";
        ses_mail = ses_mail + "--NextPart\n";
        if (process.env.MERGE_PR) {
            request(pr_options, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    const prInfo = JSON.parse(body),
                        status = prInfo[0].state;
                    if (status != "closed") {
                        var currentBranch = process.env.GITHUB_PR_SOURCE_BRANCH,
                            targetBranch = process.env.GITHUB_PR_TARGET_BRANCH,
                            addTimeStamp = [];
                        if (targetBranch == "master") {
                            shell.exec("git checkout master", {shell: '/bin/bash'});
                            shell.exec("git pull 'https://jakubkrajcovic:" + process.env.GITHUB_PASSWORD + "@github.com/jakubkrajcovic/Managing-with-Digital-Technology.git' master", {shell: '/bin/bash'});
                            shell.exec("git checkout " + currentBranch, {shell: '/bin/bash'});
                            shell.exec("git pull 'https://jakubkrajcovic:" + process.env.GITHUB_PASSWORD + "@github.com/jakubkrajcovic/Managing-with-Digital-Technology.git'  " + currentBranch, {shell: '/bin/bash'});
                            var changed_files = shell.exec("git diff " + currentBranch + "..master --name-only", {shell: '/bin/bash'}).stdout.split(/\r?\n|\r/g);
                            changed_files.forEach(function (value) {
                                if (value && value.indexOf("mbax9154") != -1 && value.indexOf("html") != -1) {
                                    addTimeStamp.push(value)
                                }
                            });
                            addTimeStamp.forEach(function (fileName) {
                                try {
                                    if (fs.existsSync(fileName)) {
                                        fs.appendFileSync(fileName, "\nFile published on " + datetime.create().format("m/d/Y H:M:S") + " by " + email);
                                        shell.exec("git add " + fileName, {shell: '/bin/bash'});
                                    }
                                } catch (err) {
                                    console.error(err)
                                }
                            });
                            shell.exec("git commit -m 'Pre publishing commit' ", {shell: '/bin/bash'});
                            shell.exec("git push 'https://jakubkrajcovic:" + process.env.GITHUB_PASSWORD + "@github.com/jakubkrajcovic/Managing-with-Digital-Technology.git'  " + currentBranch, {shell: '/bin/bash'});
                            setTimeout(function () {
                                request(merge_pr_options, function (error, response, body) {
                                    if (!error && response.statusCode == 200) {
                                        console.log("Successfully merged the PR");
                                        ses.sendRawEmail({
                                            RawMessage: {Data: new Buffer(ses_mail)},
                                            Destinations: [email],
                                            Source: "'Managing with digital technology' <" + fromEmail + ">'"
                                        }, function (err, data) {
                                            if (err) {
                                                console.log(err);
                                                process.exit(1);
                                            }
                                        });
                                    } else {
                                        console.log("Failed to merged the PR");
                                        console.log(error);
                                        process.exit(1);
                                    }
                                });
                            }, 10000)
                        }
                    }
                }
            });
        } else {
            fs.readFile(__dirname + "/output", 'utf8', function (err, data) {
                if (err) {
                    console.log(err);
                    process.exit(1);
                }
                ses_mail = ses_mail + "Content-Type: text/plain;\n";
                ses_mail = ses_mail + "Content-Disposition: attachment; filename=\"output\"\n\n";
                ses_mail = ses_mail + data + "\n\n";
                ses_mail = ses_mail + "--NextPart--";
                ses.sendRawEmail({
                    RawMessage: {Data: new Buffer(ses_mail)},
                    Destinations: [email],
                    Source: "'Managing with digital technology' <" + fromEmail + ">'"
                }, function (err, data) {
                    if (err) {
                        console.log(err);
                        process.exit(1);
                    }
                });
            });
        }
    } else {
        console.log(error);
        process.exit(1);
    }
});
