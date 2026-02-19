var UserSettings = (function() {
    var container;
    var users = [];
    var originalUsers = [];
    var currentPage = 1;
    var pageSize = 10;
    var searchQuery = '';

    function init(el) {
        container = el;
        loadUsers();
    }

    function loadUsers() {
        container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading users...</p></div>';
        Auth.getUsers().then(function(response) {
            users = response.users || [];
            originalUsers = users.slice();
            if (!Array.isArray(users)) {
                users = [];
                originalUsers = [];
            }
            currentPage = 1;
            render();
        }).catch(function(err) {
            container.innerHTML = 'Error: ' + err.message;
        });
    }

    function render() {
        var html = [
            '<div class="toolbar">',
            '  <div class="search-box">',
            '    <input type="text" id="userSearch" placeholder="Search users..." value="' + escapeHtml(searchQuery) + '">',
            '  </div>',
            '  <button class="btn-primary" id="addUserBtn">Add User</button>',
            '</div>',
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
            '<div id="userPagination" class="pagination"></div>',
            '<div id="userModal"></div>'
        ].join('\n');

        container.innerHTML = html;
        renderUserList();
        renderPagination();
        setupEventListeners();
    }

    function getFilteredUsers() {
        if (!searchQuery) {
            return originalUsers;
        }
        return originalUsers.filter(function(user) {
            var username = (user.username || user.name || '').toLowerCase();
            var role = (user.role || '').toLowerCase();
            var q = searchQuery.toLowerCase();
            return username.indexOf(q) >= 0 || role.indexOf(q) >= 0;
        });
    }

    function renderUserList() {
        var tbody = document.getElementById('userList');
        var filtered = getFilteredUsers();

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No users found</td></tr>';
            return;
        }

        var startIndex = (currentPage - 1) * pageSize;
        var endIndex = startIndex + pageSize;
        var pageUsers = filtered.slice(startIndex, endIndex);

        tbody.innerHTML = pageUsers.map(function(user) {
            return '<tr>' +
                '<td>' + escapeHtml(user.id) + '</td>' +
                '<td>' + escapeHtml(user.username || user.name || '') + '</td>' +
                '<td>' + escapeHtml(user.role || '') + '</td>' +
                '<td>' + escapeHtml(user.createdAt || user.created || '-') + '</td>' +
                '<td class="actions">' +
                '  <button class="btn-edit" data-id="' + user.id + '">Edit</button>' +
                '  <button class="btn-delete" data-id="' + user.id + '">Delete</button>' +
                '</td>' +
                '</tr>';
        }).join('');
    }

    function renderPagination() {
        var paginationDiv = document.getElementById('userPagination');
        var filtered = getFilteredUsers();
        var totalCount = filtered.length;
        var totalPages = Math.ceil(totalCount / pageSize);

        if (totalCount === 0) {
            paginationDiv.innerHTML = '';
            return;
        }

        var startItem = (currentPage - 1) * pageSize + 1;
        var endItem = Math.min(currentPage * pageSize, totalCount);

        var html = [
            '<div class="pagination-info">',
            '  <span>Showing ' + startItem + '-' + endItem + ' of ' + totalCount + ' items</span>',
            '</div>',
            '<div class="pagination-controls">',
            '  <label>Items per page:</label>',
            '  <select id="userPageSize">',
            '    <option value="5"' + (pageSize === 5 ? ' selected' : '') + '>5</option>',
            '    <option value="10"' + (pageSize === 10 ? ' selected' : '') + '>10</option>',
            '    <option value="20"' + (pageSize === 20 ? ' selected' : '') + '>20</option>',
            '    <option value="50"' + (pageSize === 50 ? ' selected' : '') + '>50</option>',
            '    <option value="100"' + (pageSize === 100 ? ' selected' : '') + '>100</option>',
            '  </select>',
            '  <button class="btn-page" id="userPrevPage"' + (currentPage === 1 ? ' disabled' : '') + '>Previous</button>',
            '  <span class="page-info">Page ' + currentPage + ' of ' + totalPages + '</span>',
            '  <button class="btn-page" id="userNextPage"' + (currentPage >= totalPages ? ' disabled' : '') + '>Next</button>',
            '</div>'
        ].join('');

        paginationDiv.innerHTML = html;
    }

    function setupEventListeners() {
        // Search input handler
        var searchInput = document.getElementById('userSearch');
        if (searchInput) {
            searchInput.addEventListener('input', function(e) {
                searchQuery = e.target.value;
                currentPage = 1;
                renderUserList();
                renderPagination();
            });
        }

        // Add User button handler
        var addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', function(e) {
                showUserModal(null);
            });
        }

        // Use event delegation for pagination and action buttons
        container.addEventListener('click', function(e) {
            var target = e.target;
            var id = target.id;

            // Page size selector - use change event instead
            if (id === 'userPageSize') {
                return;
            }

            // Previous page button
            if (id === 'userPrevPage') {
                e.preventDefault();
                e.stopPropagation();
                if (currentPage > 1) {
                    currentPage--;
                    renderUserList();
                    renderPagination();
                }
                return;
            }

            // Next page button
            if (id === 'userNextPage') {
                e.preventDefault();
                e.stopPropagation();
                var filtered = getFilteredUsers();
                var totalPages = Math.ceil(filtered.length / pageSize);
                if (currentPage < totalPages) {
                    currentPage++;
                    renderUserList();
                    renderPagination();
                }
                return;
            }

            // Edit button
            if (target && target.classList && target.classList.contains('btn-edit')) {
                e.stopPropagation();
                var userId = parseInt(target.getAttribute('data-id'));
                var user = originalUsers.find(function(u) { return u.id === userId; });
                if (user) {
                    showUserModal(user);
                }
                return;
            }

            // Delete button
            if (target && target.classList && target.classList.contains('btn-delete')) {
                e.stopPropagation();
                var userId = parseInt(target.getAttribute('data-id'));
                if (confirm('Are you sure you want to delete this user?')) {
                    deleteUser(userId);
                }
                return;
            }
        });

        // Page size selector - use event delegation with change event
        container.addEventListener('change', function(e) {
            var target = e.target;
            if (target.id === 'userPageSize') {
                pageSize = parseInt(target.value);
                currentPage = 1;
                renderUserList();
                renderPagination();
            }
        });
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
            '        <label for="username">Username *</label>',
            '        <input type="text" id="username" name="username" value="' + (user ? escapeHtml(user.username || user.name || '') : '') + '" required>',
            '      </div>',
            '      <div class="form-group">',
            '        <label for="password">' + (isEdit ? 'New Password (leave blank to keep current)' : 'Password *') + '</label>',
            '        <input type="password" id="password" name="password"' + (isEdit ? '' : ' required') + '>',
            '      </div>',
            '      <div class="form-group">',
            '        <label for="role">Role *</label>',
            '        <select id="role" name="role">',
            '          <option value="member"' + (user && user.role === 'member' ? ' selected' : '') + '>Member</option>',
            '          <option value="admin"' + (user && user.role === 'admin' ? ' selected' : '') + '>Admin</option>',
            '          <option value="owner"' + (user && user.role === 'owner' ? ' selected' : '') + '>Owner</option>',
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

        // Close modal when clicking outside
        modalContainer.querySelector('.modal-overlay').addEventListener('click', function(e) {
            if (e.target === this) {
                modalContainer.innerHTML = '';
            }
        });

        form.addEventListener('submit', function(e) {
            e.preventDefault();

            var formData = {
                username: document.getElementById('username').value,
                password: document.getElementById('password').value,
                role: document.getElementById('role').value
            };

            var promise;
            if (isEdit) {
                promise = Auth.updateUser(user.id, formData);
            } else {
                promise = Auth.createUser(formData.username, formData.password, formData.role);
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
        if (Auth.deleteUser) {
            Auth.deleteUser(id).then(loadUsers);
        }
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
