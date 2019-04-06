const PR_NUMBER = process.env.GITHUB_PR_NUMBER,
    API_TOKEN = process.env.API_TOKEN,
    COMMITS_URL = 'https://api.github.com/repos/jakubkrajcovic/Managing-with-Digital-Technology/pulls/' + PR_NUMBER + '/commits?access_token=' + API_TOKEN,
    MERGE_URL = 'https://api.github.com/repos/jakubkrajcovic/Managing-with-Digital-Technology/pulls/' + PR_NUMBER + '/merge?access_token=' + API_TOKEN,
    request = require('request'),
    commit_email_options = {
        url: COMMITS_URL,
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1'
        }
    },
    merge_pr_options = {
        url: MERGE_URL,
        method: 'PUT',
        headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1'
        }
    };
request(commit_email_options, function (error, response, body) {
    if (!error && response.statusCode == 200) {
        const info = JSON.parse(body);
        process.env.COMMITER_EMAIL = info[0].commit.author.email;
        // TODO setup sending the email
    }
});
if (process.env.MERGE_PR) {
    request(merge_pr_options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log("Successfully merged the PR")
        } else {
            // TODO implement build failure
            console.log("Failed to merged the PR")
        }
    });
}
