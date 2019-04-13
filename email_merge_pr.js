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
var forceExit = false;

/**
 * Send email function
 * @param ses: SES object
 * @param ses_mail: Email content
 * @param email: To email
 * @param fromEmail: From email
 */
var sendEmail = function (ses, ses_mail, email, fromEmail) {
    ses.sendRawEmail({
        RawMessage: {Data: new Buffer(ses_mail)},
        Destinations: [email],
        Source: "'Managing with digital technology' <" + fromEmail + ">'"
    }, function (err, data) {
        if (err) {
            console.log("Sending email failed");
            console.log(err);
            process.exit(1);
        }
        if (forceExit) {
            process.exit(1);
        }
    });
};

/**
 * Create base content for email
 * @param fromEmail: from email
 * @param email: To email
 * @param foundIssues: True if there are any issues
 * @returns {string}: Return base email content
 */
var getEmailContent = function (fromEmail, email, foundIssues) {
    var ses_mail = "From: 'Managing with digital technology' <" + fromEmail + ">\n";
    ses_mail = ses_mail + "To: " + email + "\n";
    ses_mail = ses_mail + "Subject: " + (!foundIssues ? "PR accepted  \n" : "Issues found in pull request  \n");
    ses_mail = ses_mail + "MIME-Version: 1.0\n";
    ses_mail = ses_mail + "Content-Type: multipart/mixed; boundary=\"NextPart\"\n\n";
    ses_mail = ses_mail + "--NextPart\n";
    ses_mail = ses_mail + "Content-Type: text/html; charset=us-ascii\n\n";
    ses_mail = ses_mail + "PR Link:  " + PR_LINK + "\n\n";
    return ses_mail
};

request(commit_email_options, function (error, response, body) {
    if (!error && response.statusCode == 200) {
        const info = JSON.parse(body),
            fromEmail = process.env.FROM_EMAIL,
            email = info[0].commit.author.email;
        console.log("Auther Email " + email);
        aws.config.loadFromPath(__dirname + '/../aws-credentials.json');
        var ses = new aws.SES(),
            ses_mail;
        console.log("Fetching PR");
        request(pr_options, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                const prInfo = JSON.parse(body),
                    status = prInfo[0].state;
                console.log("PR status " + status);
                if (status != "closed" && process.env.GITHUB_PR_STATE == 'OPEN') {
                    var currentBranch = process.env.GITHUB_PR_SOURCE_BRANCH,
                        targetBranch = process.env.GITHUB_PR_TARGET_BRANCH,
                        addTimeStamp = [];
                    if (targetBranch == "master") {
                        shell.exec("git checkout master", {shell: '/bin/bash'});
                        shell.exec("git pull 'https://jakubkrajcovic:" + process.env.GITHUB_PASSWORD + "@github.com/jakubkrajcovic/Managing-with-Digital-Technology.git' master", {shell: '/bin/bash'});
                        shell.exec("git checkout " + currentBranch, {shell: '/bin/bash'});
                        shell.exec("git pull 'https://jakubkrajcovic:" + process.env.GITHUB_PASSWORD + "@github.com/jakubkrajcovic/Managing-with-Digital-Technology.git'  " + currentBranch, {shell: '/bin/bash'});
                        var changed_files_extra = shell.exec("git diff " + currentBranch + "..master --name-only", {shell: '/bin/bash'}).stdout.split(/\r?\n|\r/g);
                        console.log("Changed Files");
                        console.log(changed_files_extra);
                        var changed_files = [];
                        changed_files_extra.forEach(function (fileName) {
                            if (fileName) {
                                changed_files.push(fileName)
                            }
                        });
                        changed_files.forEach(function (value) {
                            if (value && value.indexOf("mbax9154") != -1 && value.indexOf("html") != -1) {
                                addTimeStamp.push(value)
                            }
                        });
                        console.log("Changed Files to be updated");
                        console.log(addTimeStamp);
                        if (addTimeStamp.length == changed_files.length && changed_files.length == 1) {
                            if (process.env.MERGE_PR) {
                                addTimeStamp.forEach(function (fileName) {
                                    try {
                                        if (fs.existsSync(fileName)) {
                                            fs.appendFileSync(fileName, "<div>File published on " + datetime.create().format("m/d/Y H:M:S") + " by " + email + "</div>");
                                            shell.exec("git add " + fileName, {shell: '/bin/bash'});
                                        }
                                    } catch (err) {
                                        console.error(err)
                                    }
                                });
                                shell.exec("git commit -m 'Pre publishing commit' ", {shell: '/bin/bash'});
                                shell.exec("git push 'https://jakubkrajcovic:" + process.env.GITHUB_PASSWORD + "@github.com/jakubkrajcovic/Managing-with-Digital-Technology.git'  " + currentBranch, {shell: '/bin/bash'});
                                setTimeout(function () {
                                    console.log("Merging PR");
                                    request(merge_pr_options, function (error, response, body) {
                                        if (!error && response.statusCode == 200) {
                                            console.log("Successfully merged the PR");
                                            ses_mail = getEmailContent(fromEmail, email, false);
                                            ses_mail = ses_mail + "--NextPart\n";
                                            sendEmail(ses, ses_mail, email, fromEmail);
                                        } else {
                                            console.log("Failed to merged the PR");
                                            console.log(error);
                                            process.exit(1);
                                        }
                                    });
                                }, 10000)
                            } else {
                                fs.readFile(__dirname + "/output", 'utf8', function (err, data) {
                                    if (err) {
                                        console.log(err);
                                        process.exit(1);
                                    }
                                    ses_mail = getEmailContent(fromEmail, email, true);
                                    if (process.env.ERRORINFILE == addTimeStamp[0]) {
                                        ses_mail = ses_mail + "Error File: " + process.env.ERRORINFILE + "  \n\n";
                                    }
                                    ses_mail = ses_mail + "--NextPart\n";
                                    ses_mail = ses_mail + "Content-Type: text/plain;\n";
                                    ses_mail = ses_mail + "Content-Disposition: attachment; filename=\"output\"\n\n";
                                    ses_mail = ses_mail + data + "\n\n";
                                    ses_mail = ses_mail + "--NextPart--";
                                    forceExit = true;
                                    sendEmail(ses, ses_mail, email, fromEmail);
                                });
                            }
                        } else {
                            if (addTimeStamp.length == 0 && changed_files.length == 0) {
                                console.log("No changes detected between base branch and feature branch");
                                process.exit(1);
                            } else {
                                ses_mail = getEmailContent(fromEmail, email, true);
                                ses_mail = ses_mail + "PR errors:  \n\n";
                                if (addTimeStamp.length != changed_files.length) {
                                    ses_mail = ses_mail + "Files outside mbax9154 folder have been edited or files dont have an html extension \n\n";
                                }
                                if (addTimeStamp.length != 1) {
                                    ses_mail = ses_mail + "More than one file have been edited  \n\n";
                                }
                                ses_mail = ses_mail + "--NextPart\n";
                                forceExit = true;
                                sendEmail(ses, ses_mail, email, fromEmail);
                            }
                        }
                    } else {
                        ses_mail = getEmailContent(fromEmail, email, true);
                        ses_mail = ses_mail + "PR errors:  Target Branch is not master\n\n";
                        ses_mail = ses_mail + "--NextPart\n";
                        forceExit = true;
                        sendEmail(ses, ses_mail, email, fromEmail);
                    }
                } else {
                    console.log("PR status is not open");
                    process.exit(1);
                }
            } else {
                console.log("Failed to fetch PR");
                console.log(error);
                console.log(response);
                console.log(body);
                process.exit(1);
            }
        });
    } else {
        console.log("Failed to fetch commits");
        console.log(error);
        console.log(response);
        console.log(body);
        process.exit(1);
    }
});
