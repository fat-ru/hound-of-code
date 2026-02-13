/**
 * User Settings Page Module
 */
var UserSettings = (function() {
    var container;
    var users = [];

    function init(el) {
        container = el;
        loadUsers();
    }

    function loadUsers() {
        container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading users...</p></div>';
        Auth.getUsers().then(function(response) {
            users = response.users || response.repoConfigs || [];
            if (!Array.isArray(users)) {
                users = [];
            }
            render();
        }).catch(function(err) {
            container.innerHTML = '<div class="error">Failed to load users: ' + err.message + '</div>';
        });
    }

    function render() {
        var canAdd = true;

        var html = [
            '<div class="toolbar">',
            '  <div class="search-box">',
            '    <input type="text" id="userSearch" placeholder="Search users...">',
            '  </div>'
        ];
        html.push('  <button class="btn-primary" id="addUserBtn">Add User</button>');
        html.push('</div>');
        html.push(
            '<table class="data-table">',
            '  <thead>',
            '    <tr>',
            '      <th>ID</th>',
            '      <th>Username</th>',
            '      <th>Role</th>',
            '      <th>Created</th>',
            '      <th>Actions</th>',
            '    </tr>',
            '  </thead>',
            '  <tbody id="userList"></tbody>',
            '</table>',
            '<div id="userModal"></div>'
        );

        container.innerHTML = html.join('');

        var tbody = document.getElementById('userList');
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No users configured. Click "Add User" to add one.</td></tr>';
        } else {
            tbody.innerHTML = users.map(function(user) {
                var canEdit = true;
                var canDelete = true;
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
                    '<td>' + escapeHtml(user.id || user.username || '') + '</td>' +
                    '<td>' + escapeHtml(user.username || user.name || '') + '</td>' +
                    '<td>' + escapeHtml(user.role || '') + '</td>' +
                    '<td>' + escapeHtml(user.createdAt || user.created || '-') + '</td>' +
                    '<td class="actions">' + actionsHtml + '</td>' +
                    '</tr>';
            }).join('');
        }

        setupEventListeners();
    }

    function setupEventListeners() {
        var searchInput = document.getElementById('userSearch');
        if (searchInput) {
            searchInput.addEventListener('input', function(e) {
                filterUsers(e.target.value);
            });
        }
        container.addEventListener('click', function(e) {
            var target = e.target;
            if (target.classList.contains('btn-edit')) {
                var id = parseInt(target.getAttribute('data-id'));
                console.log('Edit user', id);
            } else if (target.classList.contains('btn-delete')) {
                var id = parseInt(target.getAttribute('data-id'));
                if (confirm('Are you sure you want to delete this user?')) {
                    deleteUser(id);
                }
            }
        });
    }

    function filterUsers(query) {
        var filtered = users.filter(function(user) {
            var username = user.username || user.name || '';
            var role = user.role || '';
            var searchStr = (username + ' ' + role).toLowerCase();
            return searchStr.indexOf(query.toLowerCase()) !== -1;
        });
        var tbody = document.getElementById('userList');
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No matching users</td></tr>';
        } else {
            tbody.innerHTML = filtered.map(function(user) {
                var canEdit = true;
                var canDelete = true;
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
                    '<td>' + escapeHtml(user.id || user.username || '') + '</td>' +
                    '<td>' + escapeHtml(user.username || user.name || '') + '</td>' +
                    '<td>' + escapeHtml(user.role || '') + '</td>' +
                    '<td>' + escapeHtml(user.createdAt || user.created || '-') + '</td>' +
                    '<td class="actions">' + actionsHtml + '</td>' +
                    '</tr>';
            }).join('');
        }
    }

    function deleteUser(id) {
        if (Auth.deleteUser) {
            Auth.deleteUser(id).then(function() {
                loadUsers();
            }).catch(function(err) {
                alert('Failed to delete user: ' + err.message);
            });
        }
    }

    return {
        init: init
    };
})();
