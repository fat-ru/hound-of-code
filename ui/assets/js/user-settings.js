var UserSettings = (function() {
    var container;
    var users = [];

    function init(el) {
        container = el;
        loadUsers();
    }

    function loadUsers() {
        Auth.getUsers().then(function(data) {
            if (!data) data = {};
            if (Array.isArray(data)) {
                users = data;
            } else if (Array.isArray(data.users)) {
                users = data.users;
            } else {
                users = [];
            }
            render();
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
        var row = document.createElement('tr');
        ['ID','Username','Role','Created','Actions'].forEach(function(t) {
            var th = document.createElement('th');
            th.textContent = t;
            row.appendChild(th);
        });
        thead.appendChild(row);
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
        if (users.length) {
            var tr = document.createElement('tr');
            var td = document.createElement('td');
            td.colSpan = 5;
            td.textContent = 'No users';
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }
        users.forEach(function(user) {
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
        });
    }

    function setupEventListeners() {
        var s = document.getElementById('userSearch');
        if(s) s.addEventListener('input',function(e){filterUsers(e.target.value)});
        container.addEventListener('click',function(e){
            var t = e.target;
            if(t.tagName==='BUTTON'){
                var id = parseInt(t.getAttribute('data-id'));
                if(t.textContent==='Edit') console.log('Edit',id);
                if(t.textContent==='Delete' && confirm('Delete?')) deleteUser(id);
                if(t.textContent==='Add User') showAddUserModal();
            }
        });
    }

    function filterUsers(q) {
        users = users.filter(function(u){return u.username.toLowerCase().indexOf(q.toLowerCase())>=0});
        renderUserList();
    }

    function deleteUser(id) {
        Auth.deleteUser(id).then(loadUsers);
    }

    function showAddUserModal() {
        var modalDiv = document.getElementById('userModal');
        modalDiv.innerHTML = '';
        var overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        var modal = document.createElement('div');
        modal.className = 'modal';
        var h2 = document.createElement('h2');
        h2.textContent = 'Add User';
        modal.appendChild(h2);
        var closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.onclick = function() {
            modalDiv.innerHTML = '';
        };
        modal.appendChild(closeBtn);
        overlay.appendChild(modal);
        modalDiv.appendChild(overlay);
    }

    return {init:init};
})();
