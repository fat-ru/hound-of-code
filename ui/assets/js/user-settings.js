var UserSettings = (function() {
    var container;
    var users = [];

    function init(el) {
        container = el;
        loadUsers();
    }

    function loadUsers() {
        Auth.getUsers().then(function(data) {
            console.log("[UserSettings] Data:", data);
            if (\data) data = {};
            if (Array.isArray(data)) {
                users = data;
            } else if (Array.isArray(data.users)) {
                users = data.users;
            } else {
                users = [];
            }
            render();
        }).catch(function(err) {
            console.error("[UserSettings] Error:", err);
        });
    }

    function render() {
        console.log("[UserSettings] Rendering");
        var html = "";
        html += "<div class=toolbar>";
        html += "  <div class=search-box>";
        html += "    <input type=text id=userSearch placeholder=Search users...>";
        html += "  </div>";
        html += "  <button class=btn-primary id=addUserBtnAdd User/button";
        html += "</div>";
        html += "<table class=data-table>";
        html += "  <thead><tr><th>ID</th><th>Username</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead>";
        html += "  <tbody id=userList></tbody>";
        html += "</table>";
        html += "<div id=userModal></div>";
        container.innerHTML = html;
        setupEventListeners();
    }

    function setupEventListeners() {
        var input = document.getElementById("userSearch");
        if (input) {
            input.addEventListener("input", function(e) {
                filterUsers(e.target.value);
            });
        }
    }

    function filterUsers(query) {
        var filtered = users.filter(function(u) {
            return u.username.toLowerCase().indexOf(query.toLowerCase()) >= 0;
        });
        var tbody = document.getElementById("userList");
        tbody.innerHTML = filtered.map(function(u) {
            return "<tr><td>" + u.id + "</td><td>" + u.username + "</td><td>" + u.role + "</td><td>" + (u.createdAt || "-") + "</td></tr>";
        }).join("");
    }

    return {init:init};
})();
