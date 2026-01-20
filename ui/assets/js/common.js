export function EscapeRegExp(regexp) {
    return regexp.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&');
}

export function ExpandVars(template, values) {
    for (var name in values) {
        template = template.replace('{' + name + '}', values[name]);
    }
    return template;
};

export function UrlParts(repo, path, line, rev) {
    var url = repo.url.replace(/\.git$/, ''),
        pattern = repo['url-pattern'],
        hostname = '',
        project = '',
        repoName = '',
        path = path || '',
        port = '',
        filename = path.substring(path.lastIndexOf('/') + 1),
        anchor = line ? ExpandVars(pattern.anchor, { line : line, filename : filename }) : '';

    // Determine if the URL passed is a GitHub wiki
    var wikiUrl = /\.wiki$/.exec(url);
    if (wikiUrl) {
        url = url.replace(/\.wiki/, '/wiki')
        path = path.replace(/\.md$/, '')
        anchor = '' // wikis do not support direct line linking
    }

    // Hacky solution to fix _some more_ of the 404's when using SSH style URLs.
    // This works for both github style URLs (git@github.com:username/Foo.git) and
    // bitbucket style URLs (ssh://hg@bitbucket.org/username/Foo).

    // Regex explained: Match either `git` or `hg` followed by an `@`.
    // Next, slurp up the hostname by reading until either a `:` or `/` is found.
    // If a port is specified, slurp that up too. Finally, grab the project and
    // repo names.
    var sshParts = /(git|hg)@(.*?)(:[0-9]+)?(:|\/)(.*)(\/)(.*)/.exec(url);
    if (sshParts) {
        hostname = '//' + sshParts[2]
        project = sshParts[5]
        repoName = sshParts[7]
        // Port is omitted in most cases. Bitbucket Server is special:
        // ssh://git@bitbucket.atlassian.com:7999/ATLASSIAN/jira.git
        if(sshParts[3]){
            port = sshParts[3]
        }
        url = hostname + port + '/' + project + '/' + repoName;
    }

    return {
        url : url,
        hostname: hostname,
        port: port,
        project: project,
        'repo': repoName,
        path: path,
        rev: rev,
        anchor: anchor
    };
}

export function UrlToRepo(repo, path, line, rev) {
    var urlParts = UrlParts(repo, path, line, rev),
        pattern = repo['url-pattern']

    // I'm sure there is a nicer React/jsx way to do this:
    return ExpandVars(pattern['base-url'], urlParts);
}

// Common functions for non-module scripts (settings pages)
window.Common = {
    escapeHtml: function(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    formatDate: function(dateStr) {
        if (!dateStr) return '-';
        try {
            var date = new Date(dateStr);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        } catch (e) {
            return dateStr;
        }
    }
};

// Navigation bar setup
window.initNavBar = function() {
    var navBar = document.getElementById('navBar');
    if (!navBar) return;

    var user = Auth.getUser();
    var isLoggedIn = Auth.isLoggedIn();

    var html = '<div class="top-nav">' +
        '<a href="/" class="brand">Hound</a>' +
        '<div class="nav-links">' +
        '<a href="/">Search</a>' +
        '<a href="/settings" id="settingsLink">Settings</a>' +
        '</div>';

    if (isLoggedIn && user) {
        html += '<div class="user-info">' +
            '<span class="username">' + Common.escapeHtml(user.username) + '</span> ' +
            '<span class="role">(' + user.role + ')</span> ' +
            '<a href="#" id="logoutBtn" style="margin-left: 10px; opacity: 0.8;">Logout</a>' +
            '</div>';
    } else {
        html += '<div class="nav-links">' +
            '<a href="/login">Login</a>' +
            '<a href="/register">Register</a>' +
            '</div>';
    }

    html += '</div>';

    navBar.innerHTML = html;

    // Settings link handler - redirect to login if not logged in
    var settingsLink = document.getElementById('settingsLink');
    if (settingsLink) {
        settingsLink.addEventListener('click', function(e) {
            if (!isLoggedIn) {
                e.preventDefault();
                window.location.href = '/login';
            }
        });
    }

    // Logout handler
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            Auth.logout();
            window.location.href = '/';
        });
    }
};

