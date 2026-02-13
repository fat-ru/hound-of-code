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
        container.innerHTML = '';
        var toolbar = document.createElement('div');
        toolbar.className = 'toolbar';
        var searchBox = document.createElement('div');
        searchBox.className = 'search-box';
        var searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.id = 'userSearch';
        searchInput.placeholder = 'Search users...';
        searchBox.appendChild(searchInput);
        var addBtn = document.createElement('button');
        addBtn.className = 'btn-primary';
        addBtn.id = 'addUserBtn';
        addBtn.textContent = 'Add User';
        toolbar.appendChild(searchBox);
        toolbar.appendChild(addBtn);
        container.appendChild(toolbar);
        var table = document.createElement('table');
        table.className = 'data-table';
        var thead = document.createElement('thead');
        var headerRow = document.createElement('tr');
        var headers = ['ID', 'Username', 'Role', 'Created', 'Actions'];
        for (var i = 0; i < headers.length; i++) {
            var th = document.createElement('th');
            th.textContent = headers[i];
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);
        var tbody = document.createElement('tbody');
        tbody.id = 'userList';
        table.appendChild(tbody);
        container.appendChild(table);
        var modalDiv = document.createElement('div');
        modalDiv.id = 'userModal';
        container.appendChild(modalDiv);
        setupEventListeners();
        renderUserList();
    }

    function renderUserList() {
        var tbody = document.getElementById('userList');
        tbody.innerHTML = '';
        if (!users.length) {
            var tr = document.createElement('tr');
            var td = document.createElement('td');
            td.colSpan = 5;
            td.textContent = 'No users';
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }
        for (var i = 0; i < users.length; i++) {
            var user = users[i];
            var tr = document.createElement('tr');
            var idTd = document.createElement('td');
            idTd.textContent = user.id || '';
            tr.appendChild(idTd);
            var usernameTd = document.createElement('td');
            usernameTd.textContent = user.username || '';
            tr.appendChild(usernameTd);
            var roleTd = document.createElement('td');
            roleTd.textContent = user.role || '';
            tr.appendChild(roleTd);
            var createdTd = document.createElement('td');
            createdTd.textContent = user.createdAt || '-';
            tr.appendChild(createdTd);
            var actionsTd = document.createElement('td');
            var editBtn = document.createElement('button');
            editBtn.textContent = 'Edit';
            editBtn.setAttribute('data-id', user.id);
            actionsTd.appendChild(editBtn);
            var deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.setAttribute('data-id', user.id);
            actionsTd.appendChild(deleteBtn);
            tr.appendChild(actionsTd);
            tbody.appendChild(tr);
        }
    }

    function setupEventListeners() {
        var s = document.getElementById('userSearch');
        if (s) {
            s.addEventListener('input', function(e) {
                filterUsers(e.target.value);
            });
        }
        container.addEventListener('click', function(e) {
            var t = e.target;
            if (t && t.tagName === 'BUTTON') {
                var id = parseInt(t.getAttribute('data-id'));
                if (t.textContent === 'Edit') {
                    console.log('Edit', id);
                }
                if (t.textContent === 'Delete' && confirm('Delete this user?')) {
                    deleteUser(id);
                }
            }
        });
    }

    function filterUsers(q) {
        if (!users || !Array.isArray(users)) {
            return;
        }
        var filtered = [];
        for (var i = 0; i < users.length; i++) {
            var u = users[i];
            var username = u.username || '';
            var role = u.role || '';
            if (username.toLowerCase().indexOf(q.toLowerCase()) >= 0 || role.toLowerCase().indexOf(q.toLowerCase()) >= 0) {
                filtered.push(u);
            }
        }
        users = filtered;
        renderUserList();
    }

    function deleteUser(id) {
        if (Auth.deleteUser) {
            Auth.deleteUser(id).then(function() {
                loadUsers();
            });
        }
    }

    return {
        init: init
    };
})();
