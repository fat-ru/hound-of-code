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

        Auth.getUsers()
            .then(function(response) {
                users = response.users || [];
                render();
            })
            .catch(function(err) {
                container.innerHTML = '<div class="error">Failed to load users: ' + err.message + '</div>';
            });
    }

    function render() {
        var html = [
            '<div class="toolbar">',
            '  <div class="search-box">',
            '    <input type="text" id="userSearch" placeholder="Search users...">',
            '  </div>',
            '  <button class="btn-primary" id="addUserBtn">Add User</button>',
            '</div>',
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
            '  <tbody id="userList"></tbody>',
            '</table>',
            '<div id="userModal"></div>'
        ].join('\n');

        container.innerHTML = html;

        var tbody = document.getElementById('userList');
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No users found</td></tr>';
        } else {
            tbody.innerHTML = users.map(function(user) {
                return '<tr>' +
                    '<td>' + user.id + '</td>' +
                    '<td>' + escapeHtml(user.username) + '</td>' +
                    '<td><span class="badge ' + (user.role === 'admin' ? 'badge-info' : 'badge-success') + '">' + escapeHtml(user.role) + '</span></td>' +
                    '<td>' + formatDate(user.createdAt) + '</td>' +
                    '<td class="actions">' +
                    '  <button class="btn-edit" data-id="' + user.id + '">Edit</button>' +
                    '  <button class="btn-delete" data-id="' + user.id + '">Delete</button>' +
                    '</td>' +
                    '</tr>';
            }).join('');
        }

        // Event listeners
        document.getElementById('addUserBtn').addEventListener('click', function() {
            showUserModal();
        });

        document.getElementById('userSearch').addEventListener('input', function(e) {
            filterUsers(e.target.value);
        });

        tbody.querySelectorAll('.btn-edit').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var id = parseInt(this.getAttribute('data-id'));
                var user = users.find(function(u) { return u.id === id; });
                if (user) showUserModal(user);
            });
        });

        tbody.querySelectorAll('.btn-delete').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var id = parseInt(this.getAttribute('data-id'));
                if (confirm('Are you sure you want to delete this user?')) {
                    deleteUser(id);
                }
            });
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
                return '<tr>' +
                    '<td>' + user.id + '</td>' +
                    '<td>' + escapeHtml(user.username) + '</td>' +
                    '<td><span class="badge ' + (user.role === 'admin' ? 'badge-info' : 'badge-success') + '">' + escapeHtml(user.role) + '</span></td>' +
                    '<td>' + formatDate(user.createdAt) + '</td>' +
                    '<td class="actions">' +
                    '  <button class="btn-edit" data-id="' + user.id + '">Edit</button>' +
                    '  <button class="btn-delete" data-id="' + user.id + '">Delete</button>' +
                    '</td>' +
                    '</tr>';
            }).join('');
        }
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
            '        '<input type="password" id="password" name="password" ' + (isEdit ? '' : 'required') + ' minlength="6">',
            '      </div>',
            '      <div class="form-group">',
            '        <label for="role">Role</label>',
            '        <select id="role" name="role">',
            '          <option value="user"' + (user && user.role === 'user' ? ' selected' : '') + '>User</option>',
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
        return Common.escapeHtml(text);
    }

    function formatDate(dateStr) {
        return Common.formatDate(dateStr);
    }

    return {
        init: init
    };
})();
