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
            users = response.users || [];
            if (!Array.isArray(users)) users = [];
            render();
        }).catch(function(err) {
            container.innerHTML = 'Error: ' + err.message;
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
        toolbar.appendChild(searchBox);
        var addBtn = document.createElement('button');
        addBtn.className = 'btn-primary';
        addBtn.id = 'addUserBtn';
        addBtn.textContent = 'Add User';
        toolbar.appendChild(addBtn);
        container.appendChild(toolbar);
        var table = document.createElement('table');
        table.className = 'data-table';
        var thead = document.createElement('thead');
        var headerRow = document.createElement('tr');
        ['ID', 'Username', 'Role', 'Created', 'Actions'].forEach(function(text) {
            var th = document.createElement('th');
            th.textContent = text;
            headerRow.appendChild(th);
        });
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
            tr.innerHTML = '<td>' + (user.id || '') + '</td><td>' + (user.username || user.name || '') + '</td><td>' + (user.role || '') + '</td><td>' + (user.createdAt || user.created || '-') + '</td><td><button data-id="' + user.id + '">Edit</button> <button data-id="' + user.id + '">Delete</button></td>';
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
                if (t.textContent === 'Delete' && confirm('Delete this user?')) {
                    deleteUser(id);
                }
            }
        });
    }
    function filterUsers(q) {
        if (!users || !Array.isArray(users)) return;
        var filtered = [];
        for (var i = 0; i < users.length; i++) {
            var u = users[i];
            var username = u.username || u.name || '';
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
            Auth.deleteUser(id).then(loadUsers);
        }
    }
    return {init: init};
})();
