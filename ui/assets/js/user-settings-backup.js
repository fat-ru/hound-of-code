/**
 * User Settings Page Module
 */
var UserSettings = (function() {
    var container;
    var users = [];
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

    function canEditRepo(user) {
        user = getCurrentUser();
        if (!user) return false;
        if (user.role === 'owner') return true; // owner can edit any user
        if (user.role === 'admin') return user.userId === user.id; // admin can only edit own users
        return false; // member cannot edit
    }

    function canDeleteRepo(user) {
        user = getCurrentUser();
        if (!user) return false;
        if (user.role === 'owner') return true; // owner can delete any user
        if (user.role === 'admin') return user.userId === user.id; // admin can only delete own users
        return false; // member cannot delete
    }

    function loadRepos() {
        container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading usersitories...</p></div>';

        Auth.getRepoConfigs()
            .then(function(response) {
                users = response.userConfigs || [];
                render();
            })
            .catch(function(err) {
                container.innerHTML = '<div class="error">Failed to load usersitories: ' + err.message + '</div>';
            });
    }

    function render() {
        var user = getCurrentUser();
        var canAdd = canAddRepo();

        var html = [
            '<div class="toolbar">',
            '  <div class="search-box">',
            '    <input type="text" id="userSearch" placeholder="Search usersitories...">',
            '  </div>'
        ];
        if (canAdd) {
            html.push('  <button class="btn-primary" id="addRepoBtn">Add User</button>');
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
            '  <tbody id="userList"></tbody>',
            '</table>',
            '<div id="userModal"></div>'
        );

        container.innerHTML = html.join('\n');

        var tbody = document.getElementById('userList');
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No usersitories configured. Click "Add User" to add one.</td></tr>';
        } else {
            tbody.innerHTML = users.map(function(user) {
                var canEdit = canEditRepo(user);
                var canDelete = canDeleteRepo(user);
                var actionsHtml = '';
                if (canEdit) {
                    actionsHtml += '  <button class="btn-edit" data-id="' + user.id + '">Edit</button>';
                }
                if (canDelete) {
                    actionsHtml += '  <button class="btn-delete" data-id="' + user.id + '">Delete</button>';
                }
                if (!actionsHtml) {
                    actionsHtml = '<span style="color: #888;">-</span>';
                }
                return '<tr>' +
                    '<td>' + escapeHtml(user.name) + '</td>' +
                    '<td>' + escapeHtml(user.url) + '</td>' +
                    '<td>' + escapeHtml(user.branch) + '</td>' +
                    '<td>' + escapeHtml(user.vcsType || 'git') + '</td>' +
                    '<td><span class="badge ' + (user.enabled ? 'badge-success' : 'badge-warning') + '">' + (user.enabled ? 'Enabled' : 'Disabled') + '</span></td>' +
                    '<td class="actions">' + actionsHtml + '</td>' +
                    '</tr>';
            }).join('');
        }

        // Set up event listeners after rendering
        console.log('[UserSettings] Rendering complete, setting up event delegation');
        setupEventListeners();
    }

    // Use event delegation for edit and delete buttons (handles dynamically added buttons)
    function setupEventListeners() {
        console.log('[UserSettings] Setting up event delegation');

        // Use event delegation on container for edit/delete buttons
        var searchInput = document.getElementById('userSearch');
        if (searchInput) {
            console.log('[UserSettings] Found userSearch input, adding input listener');
            searchInput.addEventListener('input', function(e) {
                console.log('[UserSettings] Search input changed, filtering users');
                filterRepos(e.target.value);
            });
        }

        // Use event delegation on container for edit/delete buttons
        console.log('[UserSettings] Adding click listener to container');
        container.addEventListener('click', function(e) {
            var target = e.target;
            console.log('[UserSettings] Container click detected, target:', target);
            if (target && target.classList && target.classList.contains('btn-edit')) {
                console.log('[UserSettings] Edit button clicked, data-id:', target.getAttribute('data-id'));
                var id = parseInt(target.getAttribute('data-id'));
                var user = users.find(function(r) { return r.id === id; });
                console.log('[UserSettings] Found user for id:', id, user);
                if (user) {
                    console.log('[UserSettings] Calling showRepoModal');
                    showRepoModal(user);
                } else {
                    console.log('[UserSettings] Repo not found for id:', id);
                }
            } else if (target && target.classList && target.classList.contains('btn-delete')) {
                console.log('[UserSettings] Delete button clicked, data-id:', target.getAttribute('data-id'));
                var id = parseInt(target.getAttribute('data-id'));
                if (confirm('Are you sure you want to delete this usersitory configuration?')) {
                    deleteRepo(id);
                }
            } else {
                console.log('[UserSettings] Click on container but not on edit or delete button');
            }
        });
    }

    function filterRepos(query) {
        var filtered = users.filter(function(user) {
            var displayName = user.displayName || '';
            var searchStr = (user.name + ' ' + user.url + ' ' + displayName).toLowerCase();
            return searchStr.indexOf(query.toLowerCase()) !== -1;
        });

        var tbody = document.getElementById('userList');
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No matching usersitories</td></tr>';
        } else {
            tbody.innerHTML = filtered.map(function(user) {
                var canEdit = canEditRepo(user);
                var canDelete = canDeleteRepo(user);
                var actionsHtml = '';
                if (canEdit) {
                    actionsHtml += '  <button class="btn-edit" data-id="' + user.id + '">Edit</button>';
                }
                if (canDelete) {
                    actionsHtml += '  <button class="btn-delete" data-id="' + user.id + '">Delete</button>';
                }
                if (!actionsHtml) {
                    actionsHtml = '<span style="color: #888;">-</span>';
                }
                return '<tr>' +
                    '<td>' + escapeHtml(user.name) + '</td>' +
                    '<td>' + escapeHtml(user.url) + '</td>' +
                    '<td>' + escapeHtml(user.branch) + '</td>' +
                    '<td>' + escapeHtml(user.vcsType || 'git') + '</td>' +
                    '<td><span class="badge ' + (user.enabled ? 'badge-success' : 'badge-warning') + '">' + (user.enabled ? 'Enabled' : 'Disabled') + '</span></td>' +
                    '<td class="actions">' + actionsHtml + '</td>' +
                    '</tr>';
            }).join('');
        }

        // Set up event listeners after rendering
        console.log('[UserSettings] Filtering complete, re-setting up event delegation');
        setupEventListeners();
    }

    function showRepoModal(user) {
        var isEdit = !!user;
        var modalHtml = [
            '<div class="modal-overlay">',
            '  <div class="modal">',
            '    <h2>' + (isEdit ? 'Edit User' : 'Add User') + '</h2>',
            '    <div id="userFormMessage"></div>',
            '    <form id="userForm">',
            '      <input type="hidden" name="id" value="' + (user ? user.id : '') + '">',
            '      <div class="form-group">',
            '        <label for="name">Name * (alphanumeric, dash, underscore)</label>',
            '        <input type="text" id="name" name="name" value="' + (user ? escapeHtml(user.name) : '') + '" required pattern="[a-zA-Z0-9_-]+">',
            '      </div>',
            '      <div class="form-group">',
            '        <label for="url">URL *</label>',
            '        <input type="text" id="url" name="url" value="' + (user ? escapeHtml(user.url) : '') + '" required placeholder="https://github.com/user/user.git">',
            '      </div>',
            '      <div class="form-group">',
            '        <label for="displayName">Display Name</label>',
            '        <input type="text" id="displayName" name="displayName" value="' + (user && user.displayName ? escapeHtml(user.displayName) : '') + '" placeholder="My User">',
            '      </div>',
            '      <div class="form-group">',
            '        <label for="branch">Branch</label>',
            '        <input type="text" id="branch" name="branch" value="' + (user ? escapeHtml(user.branch) : 'main') + '" placeholder="main">',
            '      </div>',
            '      <div class="form-group">',
            '        <label for="vcsType">VCS Type</label>',
            '        <select id="vcsType" name="vcsType">',
            '          <option value="git"' + (user && user.vcsType === 'git' ? ' selected' : '') + '>Git</option>',
            '          <option value="hg"' + (user && user.vcsType === 'hg' ? ' selected' : '') + '>Mercurial</option>',
            '          <option value="svn"' + (user && user.vcsType === 'svn' ? ' selected' : '') + '>Subversion</option>',
            '          <option value="bzr"' + (user && user.vcsType === 'bzr' ? ' selected' : '') + '>Bazaar</option>',
            '        </select>',
            '      </div>',
            '      <div class="form-group">',
            '        <div class="checkbox-group">',
            '          <input type="checkbox" id="enabled" name="enabled"' + (user && !user.enabled ? '' : ' checked') + '>',
            '          <label for="enabled">Enabled</label>',
            '      </div>',
            '      </div>',
            '      <div class="modal-footer">',
            '        <button type="button" class="btn-cancel" id="cancelRepoBtn">Cancel</button>',
            '        <button type="submit" class="btn-primary">' + (isEdit ? 'Update' : 'Create') + '</button>',
            '      </div>',
            '    </form>',
            '  </div>',
            '</div>'
        ].join('\n');

        var modalContainer = document.getElementById('userModal');
        modalContainer.innerHTML = modalHtml;

        var form = document.getElementById('userForm');
        var messageDiv = document.getElementById('userFormMessage');

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
                promise = Auth.updateRepoConfig(user.id, formData);
            } else {
                promise = Auth.createRepoConfig(formData);
            }

            promise
                .then(function() {
                    modalContainer.innerHTML = '';
                    loadRepos();
                    // Refresh the page to update the search index and user list
                    // This ensures that new user is indexed and available for searching
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
                alert('Failed to delete usersitory: ' + err.message);
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