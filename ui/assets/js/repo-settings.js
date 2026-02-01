/**
 * Repository Settings Page Module
 */
var RepoSettings = (function() {
    var container;
    var repos = [];
    var user = null;

    function init(el) {
        container = el;
        loadRepos();
    }

    function getCurrentUser() {
        if (!user) {
            user = Auth.getUser();
        }
        return user;
    }

    function canAddRepo() {
        user = getCurrentUser();
        if (!user) return false;
        return user.role === 'owner' || user.role === 'admin';
    }

    function canEditRepo(repo) {
        user = getCurrentUser();
        if (!user) return false;
        if (user.role === 'owner') return true; // owner can edit any repo
        if (user.role === 'admin') return repo.userId === user.id; // admin can only edit own repos
        return false; // member cannot edit
    }

    function canDeleteRepo(repo) {
        user = getCurrentUser();
        if (!user) return false;
        if (user.role === 'owner') return true; // owner can delete any repo
        if (user.role === 'admin') return repo.userId === user.id; // admin can only delete own repos
        return false; // member cannot delete
    }

    function loadRepos() {
        container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading repositories...</p></div>';

        Auth.getRepoConfigs()
            .then(function(response) {
                repos = response.repoConfigs || [];
                render();
            })
            .catch(function(err) {
                container.innerHTML = '<div class="error">Failed to load repositories: ' + err.message + '</div>';
            });
    }

    function render() {
        var user = getCurrentUser();
        var canAdd = canAddRepo();

        var html = [
            '<div class="toolbar">',
            '  <div class="search-box">',
            '    <input type="text" id="repoSearch" placeholder="Search repositories...">',
            '  </div>'
        ];
        if (canAdd) {
            html.push('  <button class="btn-primary" id="addRepoBtn">Add Repository</button>');
        }
        html.push('</div>');
        html.push(
            '<table class="data-table">',
            '  <thead>',
            '    <tr>',
            '      <th>Name</th>',
            '      <th>URL</th>',
            '      <th>Branch</th>',
            '      <th>Type</th>',
            '      <th>Status</th>',
            '      <th>Actions</th>',
            '    </tr>',
            '  </thead>',
            '  <tbody id="repoList"></tbody>',
            '</table>',
            '<div id="repoModal"></div>'
        );

        container.innerHTML = html.join('\n');

        var tbody = document.getElementById('repoList');
        if (repos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No repositories configured. Click "Add Repository" to add one.</td></tr>';
        } else {
            tbody.innerHTML = repos.map(function(repo) {
                var canEdit = canEditRepo(repo);
                var canDelete = canDeleteRepo(repo);
                var actionsHtml = '';
                if (canEdit) {
                    actionsHtml += '  <button class="btn-edit" data-id="' + repo.id + '">Edit</button>';
                }
                if (canDelete) {
                    actionsHtml += '  <button class="btn-delete" data-id="' + repo.id + '">Delete</button>';
                }
                if (!actionsHtml) {
                    actionsHtml = '<span style="color: #888;">-</span>';
                }
                return '<tr>' +
                    '<td>' + escapeHtml(repo.name) + '</td>' +
                    '<td>' + escapeHtml(repo.url) + '</td>' +
                    '<td>' + escapeHtml(repo.branch) + '</td>' +
                    '<td>' + escapeHtml(repo.vcsType || 'git') + '</td>' +
                    '<td><span class="badge ' + (repo.enabled ? 'badge-success' : 'badge-warning') + '">' + (repo.enabled ? 'Enabled' : 'Disabled') + '</span></td>' +
                    '<td class="actions">' + actionsHtml + '</td>' +
                    '</tr>';
            }).join('');
        }

        // Event listeners
        var addRepoBtn = document.getElementById('addRepoBtn');
        if (addRepoBtn) {
            addRepoBtn.addEventListener('click', function() {
                showRepoModal();
            });
        }

        document.getElementById('repoSearch').addEventListener('input', function(e) {
            filterRepos(e.target.value);
        });

        tbody.querySelectorAll('.btn-edit').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var id = parseInt(this.getAttribute('data-id'));
                var repo = repos.find(function(r) { return r.id === id; });
                if (repo) showRepoModal(repo);
            });
        });

        tbody.querySelectorAll('.btn-delete').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var id = parseInt(this.getAttribute('data-id'));
                if (confirm('Are you sure you want to delete this repository configuration?')) {
                    deleteRepo(id);
                }
            });
        });
    }

    function filterRepos(query) {
        var filtered = repos.filter(function(repo) {
            var searchStr = (repo.name + ' ' + repo.url + ' ' + repo.displayName).toLowerCase();
            return searchStr.indexOf(query.toLowerCase()) !== -1;
        });

        var tbody = document.getElementById('repoList');
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No matching repositories</td></tr>';
        } else {
            tbody.innerHTML = filtered.map(function(repo) {
                var canEdit = canEditRepo(repo);
                var canDelete = canDeleteRepo(repo);
                var actionsHtml = '';
                if (canEdit) {
                    actionsHtml += '  <button class="btn-edit" data-id="' + repo.id + '">Edit</button>';
                }
                if (canDelete) {
                    actionsHtml += '  <button class="btn-delete" data-id="' + repo.id + '">Delete</button>';
                }
                if (!actionsHtml) {
                    actionsHtml = '<span style="color: #888;">-</span>';
                }
                return '<tr>' +
                    '<td>' + escapeHtml(repo.name) + '</td>' +
                    '<td>' + escapeHtml(repo.url) + '</td>' +
                    '<td>' + escapeHtml(repo.branch) + '</td>' +
                    '<td>' + escapeHtml(repo.vcsType || 'git') + '</td>' +
                    '<td><span class="badge ' + (repo.enabled ? 'badge-success' : 'badge-warning') + '">' + (repo.enabled ? 'Enabled' : 'Disabled') + '</span></td>' +
                    '<td class="actions">' + actionsHtml + '</td>' +
                    '</tr>';
            }).join('');
        }
    }

    function showRepoModal(repo) {
        var isEdit = !!repo;
        var modalHtml = [
            '<div class="modal-overlay">',
            '  <div class="modal">',
            '    <h2>' + (isEdit ? 'Edit Repository' : 'Add Repository') + '</h2>',
            '    <div id="repoFormMessage"></div>',
            '    <form id="repoForm">',
            '      <input type="hidden" name="id" value="' + (repo ? repo.id : '') + '">',
            '      <div class="form-group">',
            '        <label for="name">Name * (alphanumeric, dash, underscore)</label>',
            '        <input type="text" id="name" name="name" value="' + (repo ? escapeHtml(repo.name) : '') + '" required pattern="[a-zA-Z0-9_-]+">',
            '      </div>',
            '      <div class="form-group">',
            '        <label for="url">URL *</label>',
            '        <input type="text" id="url" name="url" value="' + (repo ? escapeHtml(repo.url) : '') + '" required placeholder="https://github.com/user/repo.git">',
            '      </div>',
            '      <div class="form-group">',
            '        <label for="displayName">Display Name</label>',
            '        <input type="text" id="displayName" name="displayName" value="' + (repo && repo.displayName ? escapeHtml(repo.displayName) : '') + '" placeholder="My Repository">',
            '      </div>',
            '      <div class="form-group">',
            '        <label for="branch">Branch</label>',
            '        <input type="text" id="branch" name="branch" value="' + (repo ? escapeHtml(repo.branch) : 'main') + '" placeholder="main">',
            '      </div>',
            '      <div class="form-group">',
            '        <label for="vcsType">VCS Type</label>',
            '        <select id="vcsType" name="vcsType">',
            '          <option value="git"' + (repo && repo.vcsType === 'git' ? ' selected' : '') + '>Git</option>',
            '          <option value="hg"' + (repo && repo.vcsType === 'hg' ? ' selected' : '') + '>Mercurial</option>',
            '          <option value="svn"' + (repo && repo.vcsType === 'svn' ? ' selected' : '') + '>Subversion</option>',
            '          <option value="bzr"' + (repo && repo.vcsType === 'bzr' ? ' selected' : '') + '>Bazaar</option>',
            '        </select>',
            '      </div>',
            '      <div class="form-group">',
            '        <div class="checkbox-group">',
            '          <input type="checkbox" id="enabled" name="enabled"' + (repo && !repo.enabled ? '' : ' checked') + '>',
            '          <label for="enabled">Enabled</label>',
            '        </div>',
            '      </div>',
            '      <div class="modal-footer">',
            '        <button type="button" class="btn-cancel" id="cancelRepoBtn">Cancel</button>',
            '        <button type="submit" class="btn-primary">' + (isEdit ? 'Update' : 'Create') + '</button>',
            '      </div>',
            '    </form>',
            '  </div>',
            '</div>'
        ].join('\n');

        var modalContainer = document.getElementById('repoModal');
        modalContainer.innerHTML = modalHtml;

        var form = document.getElementById('repoForm');
        var messageDiv = document.getElementById('repoFormMessage');

        document.getElementById('cancelRepoBtn').addEventListener('click', function() {
            modalContainer.innerHTML = '';
        });

        form.addEventListener('submit', function(e) {
            e.preventDefault();

            var formData = {
                name: document.getElementById('name').value,
                url: document.getElementById('url').value,
                displayName: document.getElementById('displayName').value,
                branch: document.getElementById('branch').value || 'main',
                vcsType: document.getElementById('vcsType').value,
                enabled: document.getElementById('enabled').checked
            };

            var promise;
            if (isEdit) {
                promise = Auth.updateRepoConfig(repo.id, formData);
            } else {
                promise = Auth.createRepoConfig(formData);
            }

            promise
                .then(function() {
                    modalContainer.innerHTML = '';
                    loadRepos();
                    // Refresh the page to update the search index and repo list
                    // This ensures the new repo is indexed and available for searching
                    setTimeout(function() {
                        window.location.reload();
                    }, 1000);
                })
                .catch(function(err) {
                    messageDiv.innerHTML = '<div class="error">' + err.message + '</div>';
                });
        });
    }

    function deleteRepo(id) {
        Auth.deleteRepoConfig(id)
            .then(function() {
                loadRepos();
            })
            .catch(function(err) {
                alert('Failed to delete repository: ' + err.message);
            });
    }

    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    return {
        init: init
    };
})();
