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
                // Handle different response formats
                if (!data) {
                    data = {};
                }
                // Check if data itself is the users array or contains a users property
                if (Array.isArray(data)) {
                    users = data;
                } else if (Array.isArray(data.users)) {
                    users = data.users;
                } else {
                    users = [];
                }

                if (!Array.isArray(users)) {
                    console.error('[UserSettings] Users is not an array:', users);
                    users = [];
                }

                // Filter out invalid user objects
                users = users.filter(function(user) {
                    return user && typeof user === 'object' && (user.username || user.id);
                });

                render();
            })
            .catch(function(err) {
                console.error('[UserSettings] Failed to load users:', err);
                container.innerHTML = '\u003cdiv class="error"\u003eFailed to load users: ' + err.message + '\u003c/div\u003e';
            });
    }

    function render() {
        console.log('[UserSettings] Rendering users, count:', users.length);

        var html = [
            '\u003cdiv class="toolbar"\u003e',
            '  \u003cdiv class="search-box"\u003e',
            '    \u003cinput type="text" id="userSearch" placeholder="Search users..." autocomplete="off"\u003e',
            '  \u003c/div\u003e',
            '  \u003cbutton class="btn-primary" id="addUserBtn"\u003eAdd User\u003c/button\u003e',
            '\u003c/div\u003e',
            '\u003ctable class="data-table"\u003e',
            '  \u003cthead\u003e',
            '    \u003ctr\u003e',
            '      \u003cth\u003eID\u003c/th\u003e',
            '      \u003cth\u003eUsername\u003c/th\u003e',
            '      \u003cth\u003eRole\u003c/th\u003e',
            '      \u003cth\u003eCreated At\u003c/th\u003e',
            '      \u003cth\u003eActions\u003c/th\u003e',
            '    \u003c/tr\u003e',
            '  \u003c/thead\u003e',
            '  \u003ctbody id="userList"\u003e\u003c/tbody\u003e',
            '\u003c/table\u003e',
            '\u003cdiv id="userModal"\u003e\u003c/div\u003e'
        ];

        container.innerHTML = html.join('\n');

        var tbody = document.getElementById('userList');
        if (!users || users.length === 0) {
            tbody.innerHTML = '\u003ctr\u003e\u003ctd colspan="5" class="empty-state"\u003eNo users found\u003c/td\u003e\u003c/tr\u003e';
        } else {
            tbody.innerHTML = users.map(function(user) {
                var badgeClass = 'badge-success';
                if (user.role === 'owner') badgeClass = 'badge-danger';
                else if (user.role === 'admin') badgeClass = 'badge-info';
                return '\u003ctr\u003e' +
                    '\u003ctd\u003e' + (user.id || '') + '\u003c/td\u003e' +
                    '\u003ctd\u003e' + escapeHtml(user.username) + '\u003c/td\u003e' +
                    '\u003ctd\u003e\u003cspan class="badge ' + badgeClass + '"\u003e' + escapeHtml(user.role) + '\u003c/span\u003e\u003c/td\u003e' +
                    '\u003ctd\u003e' + formatDate(user.createdAt) + '\u003c/td\u003e' +
                    '\u003ctd class="actions"\u003e' +
                    '  \u003cbutton class="btn-edit" data-id="' + user.id + '"\u003eEdit\u003c/button\u003e' +
                    '  \u003cbutton class="btn-delete" data-id="' + user.id + '"\u003eDelete\u003c/button\u003e' +
                    '\u003c/td\u003e' +
                    '\u003c/tr\u003e';
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
        if (!users || !Array.isArray(users)) {
            console.log('[UserSettings] No users to filter');
            return;
        }

        var filtered = users.filter(function(user) {
            var username = user.username || '';
            var role = user.role || '';
            return username.toLowerCase().indexOf(query.toLowerCase()) !== -1 ||
                role.toLowerCase().indexOf(query.toLowerCase()) !== -1;
        });

        var tbody = document.getElementById('userList');
        if (filtered.length === 0) {
            tbody.innerHTML = '\u003ctr\u003e\u003ctd colspan="5" class="empty-state"\u003eNo matching users\u003c/td\u003e\u003c/tr\u003e';
        } else {
            tbody.innerHTML = filtered.map(function(user) {
                var badgeClass = 'badge-success';
                if (user.role === 'owner') badgeClass = 'badge-danger';
                else if (user.role === 'admin') badgeClass = 'badge-info';
                return '\u003ctr\u003e' +
                    '\u003ctd\u003e' + (user.id || '') + '\u003c/td\u003e' +
                    '\u003ctd\u003e' + escapeHtml(user.username) + '\u003c/td\u003e' +
                    '\u003ctd\u003e\u003cspan class="badge ' + badgeClass + '"\u003e' + escapeHtml(user.role) + '\u003c/span\u003e\u003c/td\u003e' +
                    '\u003ctd\u003e' + formatDate(user.createdAt) + '\u003c/td\u003e' +
                    '\u003ctd class="actions"\u003e' +
                    '  \u003cbutton class="btn-edit" data-id="' + user.id + '"\u003eEdit\u003c/button\u003e' +
                    '  \u003cbutton class="btn-delete" data-id="' + user.id + '"\u003eDelete\u003c/button\u003e' +
                    '\u003c/td\u003e' +
                    '\u003c/tr\u003e';
            }).join('');
        }

        console.log('[UserSettings] Filtered users, count:', filtered.length);
    }

    function showUserModal(user) {
        var isEdit = !!user;
        var modalHtml = [
            '\u003cdiv class="modal-overlay"\u003e',
            '  \u003cdiv class="modal"\u003e',
            '    \u003ch2\u003e' + (isEdit ? 'Edit User' : 'Add User') + '\u003c/h2\u003e',
            '    \u003cdiv id="userFormMessage"\u003e\u003c/div\u003e',
            '    \u003cform id="userForm"\u003e',
            '      \u003cinput type="hidden" name="id" value="' + (user ? user.id : '') + '"\u003e',
            '      \u003cdiv class="form-group"\u003e',
            '        \u003clabel for="username"\u003eUsername\u003c/label\u003e',
            '        \u003cinput type="text" id="username" name="username" value="' + (user ? escapeHtml(user.username) : '') + '" required minlength="3"\u003e',
            '      \u003c/div\u003e',
            '      \u003cdiv class="form-group"\u003e',
            '        \u003clabel for="password"\u003ePassword' + (isEdit ? ' (leave blank to keep current)' : '') + '\u003c/label\u003e',
            '        \u003cinput type="password" id="password" name="password" ' + (isEdit ? '' : 'required') + ' minlength="6"\u003e',
            '      \u003c/div\u003e',
            '      \u003cdiv class="form-group"\u003e',
            '        \u003clabel for="role"\u003eRole\u003c/label\u003e',
            '        \u003cselect id="role" name="role"\u003e',
            '          \u003coption value="member"' + (user && user.role === 'member' ? ' selected' : '') + '\u003eMember\u003c/option\u003e',
            '          \u003coption value="admin"' + (user && user.role === 'admin' ? ' selected' : '') + '\u003eAdmin\u003c/option\u003e',
            '        \u003c/select\u003e',
            '      \u003c/div\u003e',
            '      \u003cdiv class="modal-footer"\u003e',
            '        \u003cbutton type="button" class="btn-cancel" id="cancelUserBtn"\u003eCancel\u003c/button\u003e',
            '        \u003cbutton type="submit" class="btn-primary"\u003e' + (isEdit ? 'Update' : 'Create') + '\u003c/button\u003e',
            '      \u003c/div\u003e',
            '    \u003c/form\u003e',
            '  \u003c/div\u003e',
            '\u003c/div\u003e'
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
                    messageDiv.innerHTML = '\u003cdiv class="error"\u003e' + err.message + '\u003c/div\u003e';
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
