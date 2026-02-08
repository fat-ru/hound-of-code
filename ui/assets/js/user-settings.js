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
        console.log('[UserSettings] Loading users...');

        Auth.getUsers()
            .then(function(data) {
                console.log('[UserSettings] Users loaded:', data);
                users = data.users || data || [];
                render();
            })
            .catch(function(err) {
                console.error('[UserSettings] Failed to load users:', err);
                container.innerHTML = '<div class="error">Failed to load users: ' + err.message + '</div>';
            });
    }

    function render() {
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
            '      <th>Created At</th>',
            '      <th>Actions</th>',
            '    </tr>',
            '  </thead>',
            ' <tbody id="userList"></tbody>',
            '</table>',
            '<div id="userModal"></div>'
        );

        container.innerHTML = html.join('');
        var tbody = document.getElementById('userList');

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No users found</td></tr>';
        } else {
            tbody.innerHTML = users.map(function(user) {
                var badgeClass = 'badge-success';
                if (user.role === 'owner') badgeClass = 'badge-danger';
                else if (user.role === 'admin') badgeClass = 'badge-info';
                return '<tr>' +
                    '<td>' + user.id + '</td>' +
                    '<td>' + escapeHtml(user.username) + '</td>' +
                    '<td><span class="badge ' + badgeClass + '">' + escapeHtml(user.role) + '</span></td>' +
                    '<td>' + formatDate(user.createdAt) + '</td>' +
                    '<td class="actions">' +
                    '  <button class="btn-edit" data-id="' + user.id + '">Edit</button>' +
                    '  <button class="btn-delete" data-id="' + user.id + '">Delete</button>' +
                    '</td>' +
                    '</tr>';
            }).join('');
        }

        // Set up event listeners using event delegation
        console.log('[UserSettings] Rendering complete, setting up event delegation');
        setupEventListeners();
    }

    function setupEventListeners() {
        console.log('[UserSettings] Setting up event delegation');

        var searchInput = document.getElementById('userSearch');
        if (searchInput) {
            console.log('[UserSettings] Found userSearch input, adding input listener');
            searchInput.addEventListener('input', function(e) {
                filterUsers(e.target.value);
            });
        }

        // Use event delegation on container for edit/delete buttons
        console.log('[UserSettings] Adding click listener to container');
        container.addEventListener('click', function(e) {
            console.log('[UserSettings] Container clicked, target:', e.target);
            var target = e.target;
            if (target.classList.contains('btn-edit')) {
                console.log('[UserSettings] Edit button clicked, id:', target.getAttribute('data-id'));
                var id = parseInt(target.getAttribute('data-id'));
                var user = users.find(function(u) { return u.id === id; });
                console.log('[UserSettings] Found user for id:', id, user);
                if (user) {
                    console.log('[UserSettings] Calling showUserModal for user:', user.username);
                    showUserModal(user);
                } else {
                    console.log('[UserSettings] User not found for id:', id);
                }
            } else if (target.classList.contains('btn-delete')) {
                console.log('[UserSettings] Delete button clicked, id:', target.getAttribute('data-id'));
                var id = parseInt(target.getAttribute('data-id'));
                if (confirm('Are you sure you want to delete this user?')) {
                    deleteUser(id);
                }
            } else {
                console.log('[UserSettings] Clicked on container but not on edit/delete button');
            }
        });
    }

    function filterUsers(query) {
        var filtered = users.filter(function(user) {
            return user.username.toLowerCase().indexOf(query.toLowerCase()) !== -1 ||
                user.role.toLowerCase().indexOf(query.toLowerCase()) !== -1;
        });

        var tbody = document.getElementById('userList');
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No matching users</td></tr>';
        } else {
            tbody.innerHTML = filtered.map(function(user) {
                var badgeClass = 'badge-success';
                if (user.role === 'owner') badgeClass = 'badge-danger';
                else if (user.role === 'admin') badgeClass = 'badge-info';
                return '<tr>' +
                    '<td>' + user.id + '</td>' +
                    '<td>' + escapeHtml(user.username) + '</td>' +
                    '<td><span class="badge ' + badgeClass + '">' + escapeHtml(user.role) + '</span></td>' +
                    '<td>' + formatDate(user.createdAt) + '</td>' +
                    '<td class="actions">' +
                    '  <button class="btn-edit" data-id="' + user.id + '">Edit</button>' +
                    '  <button class="btn-delete" data-id="' + user.id + '">Delete</button>' +
                    '</td>' +
                    '</tr>';
            }).join('');
        }

        console.log('[UserSettings] Filtered users, count:', filtered.length);
    }

    function showUserModal(user) {
        var isEdit = !!user;
        var modalHtml = [
            '<div class="modal-overlay">',
            '  <div class="modal">',
            '    <h2>' + (isEdit ? 'Edit User' : 'Add User') + '</h2>',
            '    <div id="userFormMessage"></div>',
            '    <form id="userForm">',
            '      <input type="hidden" name="id" value="' + (user ? user.id : '') + '">',
            '      <div class="form-group">',
            '        <label for="username">Username</label>',
            '        <input type="text" id="username" name="username" value="' + (user ? escapeHtml(user.username) : '') + '" required minlength="3">',
            '      </div>',
            '      <div class="form-group">',
            '        <label for="password">Password' + (isEdit ? ' (leave blank to keep current)' : '') + '</label>',
            '        <input type="password" id="password" name="password" ' + (isEdit ? '' : 'required') + ' minlength="6">',
            '      </div>',
            '      <div class="form-group">',
            '        <label for="role">Role</label>',
            '        <select id="role" name="role">',
            '          <option value="member"' + (user && user.role === 'member' ? ' selected' : '') + '>Member</option>',
            '          <option value="admin"' + (user && user.role === 'admin' ? ' selected' : '') + '>Admin</option>',
            '        </select>',
            '      </div>',
            '      <div class="modal-footer">',
            '        <button type="button" class="btn-cancel" id="cancelUserBtn">Cancel</button>',
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

        document.getElementById('cancelUserBtn').addEventListener('click', function() {
            modalContainer.innerHTML = '';
        });

        form.addEventListener('submit', function(e) {
            e.preventDefault();

            var formData = {
                username: document.getElementById('username').value,
                role: document.getElementById('role').value
            };

            var password = document.getElementById('password').value;
            if (password) {
                formData.password = password;
            }

            var promise;
            if (isEdit) {
                promise = Auth.updateUser(user.id, formData);
            } else {
                promise = Auth.createUser(formData.username, password || formData.password, formData.role);
            }

            promise
                .then(function() {
                    modalContainer.innerHTML = '';
                    loadUsers();
                })
                .catch(function(err) {
                    messageDiv.innerHTML = '<div class="error">' + err.message + '</div>';
                });
        });
    }

    function deleteUser(id) {
        Auth.deleteUser(id)
            .then(function() {
                loadUsers();
            })
            .catch(function(err) {
                alert('Failed to delete user: ' + err.message);
            });
    }

    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        try {
            var date = new Date(dateStr);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        } catch (e) {
            return dateStr;
        }
    }

    return {
        init: init
    };
})();
